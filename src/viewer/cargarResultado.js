/**
 * Módulo de carga y confirmación de resultados
 * Maneja la lógica de estados y transiciones
 */

import { getMensajeResultado } from '../utils/mensajesResultado.js';
import { trackCargaResultado } from '../tracking/trackingService.js';

/**
 * Carga o actualiza un resultado de partido (versión con sets)
 * @param {Object} supabase - Cliente de Supabase
 * @param {String} partidoId - ID del partido
 * @param {Object} sets - Objeto con sets: { set1: {setA, setB}, set2: {setA, setB}, set3?: {setA, setB} }
 * @param {Number} numSets - Número de sets del partido (2 o 3, default 3)
 * @param {Object} identidad - Identidad del usuario
 * @returns {Object} Resultado de la operación
 */
export async function cargarResultadoConSets(supabase, partidoId, sets, numSets, identidad) {
  try {
    // 1. Obtener estado actual del partido
    const { data: partido, error: fetchError } = await supabase
      .from('partidos')
      .select('*')
      .eq('id', partidoId)
      .single();

    if (fetchError) throw fetchError;

    // Validar que sea uno de los participantes
    if (partido.pareja_a_id !== identidad.parejaId && partido.pareja_b_id !== identidad.parejaId) {
      return { ok: false, mensaje: 'No podés cargar resultados de otros partidos.' };
    }

    const estado = partido.estado || 'pendiente';
    const soyA = partido.pareja_a_id === identidad.parejaId;

    // Mapear sets según si soy pareja A o B
    const set1A = soyA ? sets.set1?.setA : sets.set1?.setB;
    const set1B = soyA ? sets.set1?.setB : sets.set1?.setA;
    const set2A = soyA ? sets.set2?.setA : sets.set2?.setB;
    const set2B = soyA ? sets.set2?.setB : sets.set2?.setA;
    const set3A = sets.set3 ? (soyA ? sets.set3?.setA : sets.set3?.setB) : null;
    const set3B = sets.set3 ? (soyA ? sets.set3?.setB : sets.set3?.setA) : null;

    // Preparar objeto de actualización
    const updateData = {
      set1_a: set1A,
      set1_b: set1B,
      set2_a: set2A,
      set2_b: set2B,
      num_sets: numSets || 3,
      updated_at: new Date().toISOString()
    };

    if (numSets === 3 && set3A !== null && set3B !== null) {
      updateData.set3_a = set3A;
      updateData.set3_b = set3B;
    } else {
      updateData.set3_a = null;
      updateData.set3_b = null;
    }

    // 2. Lógica según estado actual
    if (estado === 'pendiente') {
      updateData.estado = 'a_confirmar';
      updateData.cargado_por_pareja_id = identidad.parejaId;

      const { error: updateError } = await supabase
        .from('partidos')
        .update(updateData)
        .eq('id', partidoId);

      if (updateError) throw updateError;

      trackCargaResultado(supabase, identidad, partidoId, null, null)
        .catch(err => console.warn('Error tracking carga:', err));

      return {
        ok: true,
        mensaje: '✅ Resultado cargado. Esperando confirmación de la otra pareja.',
        nuevoEstado: 'a_confirmar'
      };
    }

    if (estado === 'a_confirmar') {
      if (partido.cargado_por_pareja_id === identidad.parejaId) {
        // Editar mi propia carga
        const { error: updateError } = await supabase
          .from('partidos')
          .update(updateData)
          .eq('id', partidoId);

        if (updateError) throw updateError;

        trackCargaResultado(supabase, identidad, partidoId, null, null)
          .catch(err => console.warn('Error tracking carga:', err));

        return {
          ok: true,
          mensaje: '✅ Resultado actualizado. Esperando confirmación.',
          nuevoEstado: 'a_confirmar'
        };
      } else {
        // Segunda pareja confirmando - comparar sets
        const coinciden = 
          partido.set1_a === set1A && partido.set1_b === set1B &&
          partido.set2_a === set2A && partido.set2_b === set2B &&
          (numSets === 2 || (partido.set3_a === set3A && partido.set3_b === set3B));

        if (coinciden) {
          const { error: updateError } = await supabase
            .from('partidos')
            .update({
              estado: 'confirmado',
              updated_at: new Date().toISOString()
            })
            .eq('id', partidoId);

          if (updateError) throw updateError;

          trackCargaResultado(supabase, identidad, partidoId, null, null)
            .catch(err => console.warn('Error tracking carga:', err));

          return {
            ok: true,
            mensaje: '🎉 ¡Resultado confirmado! Ambas parejas coinciden.',
            nuevoEstado: 'confirmado'
          };
        } else {
          // NO COINCIDEN - Pasar a revisión
          const { error: updateError } = await supabase
            .from('partidos')
            .update({
              estado: 'en_revision',
              set1_temp_a: set1A,
              set1_temp_b: set1B,
              set2_temp_a: set2A,
              set2_temp_b: set2B,
              set3_temp_a: set3A,
              set3_temp_b: set3B,
              updated_at: new Date().toISOString()
            })
            .eq('id', partidoId);

          if (updateError) throw updateError;

          trackCargaResultado(supabase, identidad, partidoId, null, null)
            .catch(err => console.warn('Error tracking carga:', err));

          return {
            ok: true,
            mensaje: '⚠️ Los resultados no coinciden. El partido pasó a revisión.',
            nuevoEstado: 'en_revision'
          };
        }
      }
    }

    if (estado === 'en_revision') {
      const esParejaCargadora = partido.cargado_por_pareja_id === identidad.parejaId;

      if (esParejaCargadora) {
        // Actualizo el resultado original
        const { error: updateError } = await supabase
          .from('partidos')
          .update(updateData)
          .eq('id', partidoId);

        if (updateError) throw updateError;
      } else {
        // Actualizo el resultado temporal
        const { error: updateError } = await supabase
          .from('partidos')
          .update({
            set1_temp_a: set1A,
            set1_temp_b: set1B,
            set2_temp_a: set2A,
            set2_temp_b: set2B,
            set3_temp_a: set3A,
            set3_temp_b: set3B,
            updated_at: new Date().toISOString()
          })
          .eq('id', partidoId);

        if (updateError) throw updateError;
      }

      trackCargaResultado(supabase, identidad, partidoId, null, null)
        .catch(err => console.warn('Error tracking carga:', err));

      return {
        ok: true,
        mensaje: '✅ Tu resultado actualizado. Sigue en revisión.',
        nuevoEstado: 'en_revision'
      };
    }

    if (estado === 'confirmado') {
      return {
        ok: false,
        mensaje: 'Este resultado ya está confirmado. No se puede modificar.'
      };
    }

    return { ok: false, mensaje: 'Estado desconocido.' };

  } catch (error) {
    console.error('Error cargando resultado:', error);
    return {
      ok: false,
      mensaje: 'Error al guardar. Revisá la consola.',
      error
    };
  }
}

/**
 * Carga o actualiza un resultado de partido (versión legacy con games)
 * @param {Object} supabase - Cliente de Supabase
 * @param {String} partidoId - ID del partido
 * @param {Number} gamesA - Games de pareja A
 * @param {Number} gamesB - Games de pareja B
 * @param {Object} identidad - Identidad del usuario
 * @returns {Object} Resultado de la operación
 */
export async function cargarResultado(supabase, partidoId, gamesA, gamesB, identidad) {
  // Versión legacy - mantiene compatibilidad con código existente
  // Convierte games a sets simples (1 set con el resultado total)
  // Esto es para mantener compatibilidad mientras migramos a sets
  const sets = {
    set1: { setA: gamesA, setB: gamesB },
    set2: { setA: gamesA, setB: gamesB }
  };
  return cargarResultadoConSets(supabase, partidoId, sets, 2, identidad);
  try {
    // 1. Obtener estado actual del partido
    const { data: partido, error: fetchError } = await supabase
      .from('partidos')
      .select('*')
      .eq('id', partidoId)
      .single();

    if (fetchError) throw fetchError;

    // Validar que sea uno de los participantes
    if (partido.pareja_a_id !== identidad.parejaId && partido.pareja_b_id !== identidad.parejaId) {
      return { ok: false, mensaje: 'No podés cargar resultados de otros partidos.' };
    }

    const estado = partido.estado || 'pendiente';

    // 2. Lógica según estado actual
    if (estado === 'pendiente') {
      // Primera pareja en cargar
      const { error: updateError } = await supabase
        .from('partidos')
        .update({
          games_a: gamesA,
          games_b: gamesB,
          estado: 'a_confirmar',
          cargado_por_pareja_id: identidad.parejaId,
          updated_at: new Date().toISOString()
        })
        .eq('id', partidoId);

      if (updateError) throw updateError;

      // Tracking automático de carga de resultado
      trackCargaResultado(supabase, identidad, partidoId, gamesA, gamesB)
        .catch(err => console.warn('Error tracking carga:', err));

      return {
        ok: true,
        mensaje: '✅ Resultado cargado. Esperando confirmación de la otra pareja.',
        nuevoEstado: 'a_confirmar'
      };
    }

    if (estado === 'a_confirmar') {
      if (partido.cargado_por_pareja_id === identidad.parejaId) {
        // Editar mi propia carga (antes de que confirmen)
        const { error: updateError } = await supabase
          .from('partidos')
          .update({
            games_a: gamesA,
            games_b: gamesB,
            updated_at: new Date().toISOString()
          })
          .eq('id', partidoId);

        if (updateError) throw updateError;

        // Tracking automático de actualización de resultado
        trackCargaResultado(supabase, identidad, partidoId, gamesA, gamesB)
          .catch(err => console.warn('Error tracking carga:', err));

        return {
          ok: true,
          mensaje: '✅ Resultado actualizado. Esperando confirmación.',
          nuevoEstado: 'a_confirmar'
        };
      } else {
        // Segunda pareja confirmando
        if (partido.games_a === gamesA && partido.games_b === gamesB) {
          // COINCIDEN - Confirmar
          const { error: updateError } = await supabase
            .from('partidos')
            .update({
              estado: 'confirmado',
              updated_at: new Date().toISOString()
            })
            .eq('id', partidoId);

          if (updateError) throw updateError;

          // Tracking automático de confirmación de resultado
          trackCargaResultado(supabase, identidad, partidoId, gamesA, gamesB)
            .catch(err => console.warn('Error tracking carga:', err));

          return {
            ok: true,
            mensaje: '🎉 ¡Resultado confirmado! Ambas parejas coinciden.',
            nuevoEstado: 'confirmado'
          };
        } else {
          // NO COINCIDEN - Pasar a revisión
          const { error: updateError } = await supabase
            .from('partidos')
            .update({
              estado: 'en_revision',
              resultado_temp_a: gamesA,
              resultado_temp_b: gamesB,
              updated_at: new Date().toISOString()
            })
            .eq('id', partidoId);

          if (updateError) throw updateError;

          // Tracking automático de carga con conflicto
          trackCargaResultado(supabase, identidad, partidoId, gamesA, gamesB)
            .catch(err => console.warn('Error tracking carga:', err));

          return {
            ok: true,
            mensaje: '⚠️ Los resultados no coinciden. El partido pasó a revisión.',
            nuevoEstado: 'en_revision',
            conflicto: {
              primerResultado: `${partido.games_a}-${partido.games_b}`,
              segundoResultado: `${gamesA}-${gamesB}`
            }
          };
        }
      }
    }

    if (estado === 'en_revision') {
      // Actualizar mi resultado en conflicto
      const esParejaCargadora = partido.cargado_por_pareja_id === identidad.parejaId;

      if (esParejaCargadora) {
        // Actualizo el resultado original
        const { error: updateError } = await supabase
          .from('partidos')
          .update({
            games_a: gamesA,
            games_b: gamesB,
            updated_at: new Date().toISOString()
          })
          .eq('id', partidoId);

        if (updateError) throw updateError;
      } else {
        // Actualizo el resultado temporal
        const { error: updateError } = await supabase
          .from('partidos')
          .update({
            resultado_temp_a: gamesA,
            resultado_temp_b: gamesB,
            updated_at: new Date().toISOString()
          })
          .eq('id', partidoId);

        if (updateError) throw updateError;
      }

      // Tracking automático de actualización en revisión
      trackCargaResultado(supabase, identidad, partidoId, gamesA, gamesB)
        .catch(err => console.warn('Error tracking carga:', err));

      return {
        ok: true,
        mensaje: '✅ Tu resultado actualizado. Sigue en revisión.',
        nuevoEstado: 'en_revision'
      };
    }

    if (estado === 'confirmado') {
      return {
        ok: false,
        mensaje: 'Este resultado ya está confirmado. No se puede modificar.'
      };
    }

    return { ok: false, mensaje: 'Estado desconocido.' };

  } catch (error) {
    console.error('Error cargando resultado:', error);
    return {
      ok: false,
      mensaje: 'Error al guardar. Revisá la consola.',
      error
    };
  }
}

/**
 * Acepta el resultado de la otra pareja (resuelve conflicto)
 */
export async function aceptarOtroResultado(supabase, partidoId, identidad) {
  try {
    const { data: partido, error: fetchError } = await supabase
      .from('partidos')
      .select('*')
      .eq('id', partidoId)
      .single();

    if (fetchError) throw fetchError;

    if (partido.estado !== 'en_revision') {
      return { ok: false, mensaje: 'Este partido no está en revisión.' };
    }

    const esParejaCargadora = partido.cargado_por_pareja_id === identidad.parejaId;

    if (esParejaCargadora) {
      // Acepto el resultado temporal (de la otra pareja)
      const updateData = {
        set1_a: partido.set1_temp_a,
        set1_b: partido.set1_temp_b,
        set2_a: partido.set2_temp_a,
        set2_b: partido.set2_temp_b,
        estado: 'confirmado',
        set1_temp_a: null,
        set1_temp_b: null,
        set2_temp_a: null,
        set2_temp_b: null,
        set3_temp_a: null,
        set3_temp_b: null,
        resultado_temp_a: null,
        resultado_temp_b: null,
        notas_revision: null,
        updated_at: new Date().toISOString()
      };

      if (partido.set3_temp_a !== null && partido.set3_temp_b !== null) {
        updateData.set3_a = partido.set3_temp_a;
        updateData.set3_b = partido.set3_temp_b;
      }

      const { error: updateError } = await supabase
        .from('partidos')
        .update(updateData)
        .eq('id', partidoId);

      if (updateError) throw updateError;
    } else {
      // Acepto el resultado original
      const { error: updateError } = await supabase
        .from('partidos')
        .update({
          estado: 'confirmado',
          set1_temp_a: null,
          set1_temp_b: null,
          set2_temp_a: null,
          set2_temp_b: null,
          set3_temp_a: null,
          set3_temp_b: null,
          resultado_temp_a: null,
          resultado_temp_b: null,
          notas_revision: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', partidoId);

      if (updateError) throw updateError;
    }

    return {
      ok: true,
      mensaje: '🎉 ¡Conflicto resuelto! Resultado confirmado.',
      nuevoEstado: 'confirmado'
    };

  } catch (error) {
    console.error('Error aceptando resultado:', error);
    return {
      ok: false,
      mensaje: 'Error al aceptar resultado. Revisá la consola.',
      error
    };
  }
}

/**
 * Agrega nota solicitando ayuda del admin
 */
export async function pedirAyudaAdmin(supabase, partidoId, identidad, nota = '') {
  try {
    const mensaje = nota || `${identidad.parejaNombre} solicita ayuda para resolver este conflicto.`;

    const { error } = await supabase
      .from('partidos')
      .update({
        notas_revision: mensaje,
        updated_at: new Date().toISOString()
      })
      .eq('id', partidoId);

    if (error) throw error;

    return {
      ok: true,
      mensaje: '📨 Solicitud enviada al admin. Te contactará para resolver el conflicto.'
    };

  } catch (error) {
    console.error('Error enviando solicitud:', error);
    return {
      ok: false,
      mensaje: 'Error al enviar solicitud.',
      error
    };
  }
}

/**
 * Muestra modal/UI para cargar resultado con sets
 */
export function mostrarModalCargarResultado(partido, identidad, onSubmit) {
  const oponente = partido.pareja_a?.id === identidad.parejaId 
    ? partido.pareja_b?.nombre 
    : partido.pareja_a?.nombre;

  const miNombre = identidad.parejaNombre;
  const soyA = partido.pareja_a?.id === identidad.parejaId;
  
  // Determinar número de sets
  // Si num_sets está explícitamente definido (2 o 3), usarlo. Si no, usar modo legacy (games)
  const numSets = (partido.num_sets !== null && partido.num_sets !== undefined) ? partido.num_sets : null;
  
  // Obtener valores previos de sets (si existen)
  const tieneSets = partido.set1_a !== null || partido.set1_b !== null;
  
  // Usar modo sets solo si:
  // 1. Ya hay sets cargados, O
  // 2. El partido está configurado explícitamente para sets (num_sets = 2 o 3)
  // Si num_sets es null/undefined y no hay sets cargados, usar modo legacy (games)
  const usarModoSets = tieneSets || (numSets !== null && (numSets === 2 || numSets === 3));
  
  // Si usamos modo sets, determinar cuántos sets mostrar
  // Si numSets es null pero tenemos sets cargados, asumir 3 sets
  // Si numSets está definido, usarlo
  // Si no usamos modo sets, este valor no se usa
  const numSetsParaUI = usarModoSets ? (numSets !== null ? numSets : (tieneSets ? 3 : 3)) : 2;
  
  // Valores iniciales para cada set
  const getSetValue = (setNum, isA) => {
    const setField = `set${setNum}_${isA ? 'a' : 'b'}`;
    const tempField = `set${setNum}_temp_${isA ? 'a' : 'b'}`;
    
    if (partido.estado === 'en_revision' && partido[tempField] !== null) {
      return partido[tempField];
    }
    if (partido[setField] !== null) {
      return partido[setField];
    }
    return '';
  };

  const set1Mis = soyA ? getSetValue(1, true) : getSetValue(1, false);
  const set1Rival = soyA ? getSetValue(1, false) : getSetValue(1, true);
  const set2Mis = soyA ? getSetValue(2, true) : getSetValue(2, false);
  const set2Rival = soyA ? getSetValue(2, false) : getSetValue(2, true);
  const set3Mis = usarModoSets && numSetsParaUI === 3 ? (soyA ? getSetValue(3, true) : getSetValue(3, false)) : '';
  const set3Rival = usarModoSets && numSetsParaUI === 3 ? (soyA ? getSetValue(3, false) : getSetValue(3, true)) : '';
  
  // Fallback a games si no hay sets
  const gamesAPrevia = partido.games_a;
  const gamesBPrevia = partido.games_b;
  const valorInicialMisGames = !tieneSets ? (soyA ? (gamesAPrevia !== null ? gamesAPrevia : '') : (gamesBPrevia !== null ? gamesBPrevia : '')) : '';
  const valorInicialRivalGames = !tieneSets ? (soyA ? (gamesBPrevia !== null ? gamesBPrevia : '') : (gamesAPrevia !== null ? gamesAPrevia : '')) : '';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Cargar resultado</h2>
        <button class="btn-close" id="modal-close">✕</button>
      </div>
      
      <div class="modal-body">
        <div class="match-info">
          <div class="match-team es-mio">
            <div class="team-label">Vos</div>
            <div class="team-name">${escapeHtml(miNombre)}</div>
          </div>
          
          <div class="match-vs">vs</div>
          
          <div class="match-team">
            <div class="team-label">${escapeHtml(oponente)}</div>
            <div class="team-name">${escapeHtml(oponente)}</div>
          </div>
        </div>

        <div class="score-inputs" id="score-inputs-container">
          ${usarModoSets ? `
            <!-- Modo Sets -->
            <div class="sets-container">
              <div class="set-input-group">
                <label class="set-label">Set 1</label>
                <div class="set-inputs-row">
                  <div class="set-input-wrapper">
                    <input 
                      type="number" 
                      id="input-set1-mis" 
                      class="input-score-modal input-set"
                      min="0" 
                      max="7"
                      value="${set1Mis}"
                      placeholder=""
                    />
                  </div>
                  <span class="set-separator">-</span>
                  <div class="set-input-wrapper">
                    <input 
                      type="number" 
                      id="input-set1-rival" 
                      class="input-score-modal input-set"
                      min="0" 
                      max="7"
                      value="${set1Rival}"
                      placeholder=""
                    />
                  </div>
                </div>
              </div>
              
              <div class="set-input-group">
                <label class="set-label">Set 2</label>
                <div class="set-inputs-row">
                  <div class="set-input-wrapper">
                    <input 
                      type="number" 
                      id="input-set2-mis" 
                      class="input-score-modal input-set"
                      min="0" 
                      max="7"
                      value="${set2Mis}"
                      placeholder=""
                    />
                  </div>
                  <span class="set-separator">-</span>
                  <div class="set-input-wrapper">
                    <input 
                      type="number" 
                      id="input-set2-rival" 
                      class="input-score-modal input-set"
                      min="0" 
                      max="7"
                      value="${set2Rival}"
                      placeholder=""
                    />
                  </div>
                </div>
              </div>
              
              ${usarModoSets && numSetsParaUI === 3 ? `
                <div class="set-input-group">
                  <label class="set-label">Set 3 <span class="set-optional">(opcional si ya ganaron 2)</span></label>
                  <div class="set-inputs-row">
                    <div class="set-input-wrapper">
                      <input 
                        type="number" 
                        id="input-set3-mis" 
                        class="input-score-modal input-set"
                        min="0" 
                        max="7"
                        value="${set3Mis}"
                        placeholder=""
                      />
                    </div>
                    <span class="set-separator">-</span>
                    <div class="set-input-wrapper">
                      <input 
                        type="number" 
                        id="input-set3-rival" 
                        class="input-score-modal input-set"
                        min="0" 
                        max="7"
                        value="${set3Rival}"
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          ` : `
            <!-- Modo Legacy (solo games) - para compatibilidad -->
            <div class="score-group" id="score-group-mis-games">
              <label for="input-mis-games">Tus games</label>
              <input 
                type="number" 
                id="input-mis-games" 
                class="input-score-modal"
                min="0" 
                max="20"
                value="${valorInicialMisGames}"
                placeholder=""
              />
            </div>
            
            <div class="score-group" id="score-group-rival-games">
              <label for="input-rival-games">Games de ${escapeHtml(oponente)}</label>
              <input 
                type="number" 
                id="input-rival-games" 
                class="input-score-modal"
                min="0" 
                max="20"
                value="${valorInicialRivalGames}"
                placeholder=""
              />
            </div>
          `}
        </div>
        
        <div id="error-validation" class="error-validation"></div>
        <div id="mensaje-preview" class="mensaje-preview"></div>

        ${gamesAPrevia !== null ? `
          <div class="helper-info">
            Resultado anterior: ${soyA ? gamesAPrevia : gamesBPrevia} - ${soyA ? gamesBPrevia : gamesAPrevia}
          </div>
        ` : ''}
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" id="modal-cancel">Cancelar</button>
        <button class="btn-primary" id="modal-submit">Guardar resultado</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners
  const close = () => {
    modal.remove();
  };

  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('modal-cancel').addEventListener('click', close);
  
  // Importar validarSet una sola vez
  const { validarSet } = await import('../carga/scores.js');

  // Actualizar preview cuando cambien los valores
  const actualizarPreview = () => {
    const mensajeDiv = document.getElementById('mensaje-preview');
    mensajeDiv.innerHTML = '';

    if (usarModoSets) {
      // Modo sets
      const set1Mis = parseInt(document.getElementById('input-set1-mis')?.value || '');
      const set1Rival = parseInt(document.getElementById('input-set1-rival')?.value || '');
      const set2Mis = parseInt(document.getElementById('input-set2-mis')?.value || '');
      const set2Rival = parseInt(document.getElementById('input-set2-rival')?.value || '');
      const set3Mis = numSetsParaUI === 3 ? parseInt(document.getElementById('input-set3-mis')?.value || '') : null;
      const set3Rival = numSetsParaUI === 3 ? parseInt(document.getElementById('input-set3-rival')?.value || '') : null;

      // Validar y mostrar feedback por cada set
      const set1Completo = !isNaN(set1Mis) && !isNaN(set1Rival) && set1Mis >= 0 && set1Rival >= 0;
      const set2Completo = !isNaN(set2Mis) && !isNaN(set2Rival) && set2Mis >= 0 && set2Rival >= 0;
      const set3Completo = numSetsParaUI === 3 && !isNaN(set3Mis) && !isNaN(set3Rival) && set3Mis >= 0 && set3Rival >= 0;

      // Validar cada set individualmente y mostrar feedback
      let mensajesSets = [];
      let hayErrores = false;
      const sets = [];

      if (set1Completo) {
        const validacion = validarSet(set1Mis, set1Rival);
        sets.push({ setA: set1Mis, setB: set1Rival });
        if (!validacion.ok) {
          mensajesSets.push(`<strong>Set 1:</strong> ${validacion.msg}`);
          hayErrores = true;
        } else {
          const ganador = set1Mis > set1Rival ? 'Vos' : oponente;
          const resultado = `${set1Mis > set1Rival ? set1Mis : set1Rival}-${set1Mis > set1Rival ? set1Rival : set1Mis}`;
          mensajesSets.push(`<strong>Set 1:</strong> ${ganador} ganaste ${resultado}`);
        }
      }

      if (set2Completo) {
        const validacion = validarSet(set2Mis, set2Rival);
        sets.push({ setA: set2Mis, setB: set2Rival });
        if (!validacion.ok) {
          mensajesSets.push(`<strong>Set 2:</strong> ${validacion.msg}`);
          hayErrores = true;
        } else {
          const ganador = set2Mis > set2Rival ? 'Vos' : oponente;
          const resultado = `${set2Mis > set2Rival ? set2Mis : set2Rival}-${set2Mis > set2Rival ? set2Rival : set2Mis}`;
          mensajesSets.push(`<strong>Set 2:</strong> ${ganador} ganaste ${resultado}`);
        }
      }

      if (set3Completo) {
        const validacion = validarSet(set3Mis, set3Rival);
        sets.push({ setA: set3Mis, setB: set3Rival });
        if (!validacion.ok) {
          mensajesSets.push(`<strong>Set 3:</strong> ${validacion.msg}`);
          hayErrores = true;
        } else {
          const ganador = set3Mis > set3Rival ? 'Vos' : oponente;
          const resultado = `${set3Mis > set3Rival ? set3Mis : set3Rival}-${set3Mis > set3Rival ? set3Rival : set3Mis}`;
          mensajesSets.push(`<strong>Set 3:</strong> ${ganador} ganaste ${resultado}`);
        }
      }

      // Mostrar mensajes de sets individuales
      if (mensajesSets.length > 0) {
        const claseMensaje = hayErrores ? 'mensaje-empate' : 'mensaje-victoria';
        mensajeDiv.innerHTML = `<div class="${claseMensaje}" style="font-size: 13px; text-align: left; padding: 8px 12px;">${mensajesSets.join('<br>')}</div>`;
      }

      // Calcular sets ganados y mostrar resultado final si está completo
      let setsGanadosMis = 0;
      let setsGanadosRival = 0;

      for (const set of sets) {
        if (set.setA > set.setB) setsGanadosMis++;
        else if (set.setB > set.setA) setsGanadosRival++;
      }

      const setsNecesarios = numSetsParaUI === 2 ? 2 : 2;
      const partidoCompleto = sets.length >= setsNecesarios && (setsGanadosMis >= setsNecesarios || setsGanadosRival >= setsNecesarios);
      
      if (partidoCompleto && !hayErrores) {
        const yoGano = setsGanadosMis >= setsNecesarios;
        const resultado = getMensajeResultado(yoGano ? 2 : 0, yoGano ? 0 : 2, true);
        const clase = resultado.tipo === 'victoria' ? 'mensaje-victoria' : 'mensaje-derrota';
        const mensajeFinal = mensajesSets.length > 0 
          ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1); font-weight: 800;">${resultado.mensaje}</div>`
          : `<div class="${clase}" style="font-weight: 800;">${resultado.mensaje}</div>`;
        mensajeDiv.innerHTML = mensajesSets.length > 0 
          ? `<div class="${claseMensaje}" style="font-size: 13px; text-align: left; padding: 8px 12px;">${mensajesSets.join('<br>')}${mensajeFinal}</div>`
          : mensajeFinal;
      }
    } else {
      // Modo legacy (games)
      const inputMisGames = document.getElementById('input-mis-games');
      const inputRivalGames = document.getElementById('input-rival-games');
      const groupMisGames = document.getElementById('score-group-mis-games');
      const groupRivalGames = document.getElementById('score-group-rival-games');
      
      if (!inputMisGames || !inputRivalGames) return;
      
      const misGames = parseInt(inputMisGames.value);
      const rivalGames = parseInt(inputRivalGames.value);

      // Limpiar clases previas
      if (groupMisGames) groupMisGames.classList.remove('ganador', 'perdedor');
      if (groupRivalGames) groupRivalGames.classList.remove('ganador', 'perdedor');

      if (isNaN(misGames) || isNaN(rivalGames) || misGames < 0 || rivalGames < 0) {
        return;
      }

      const resultado = getMensajeResultado(misGames, rivalGames, true);
      
      if (resultado.tipo === 'empate') {
        mensajeDiv.innerHTML = `<div class="mensaje-empate">${resultado.mensaje}</div>`;
        return;
      }

      if (groupMisGames && groupRivalGames) {
        if (misGames > rivalGames) {
          groupMisGames.classList.add('ganador');
          groupRivalGames.classList.add('perdedor');
        } else {
          groupRivalGames.classList.add('ganador');
          groupMisGames.classList.add('perdedor');
        }
      }

      const clase = resultado.tipo === 'victoria' ? 'mensaje-victoria' : 'mensaje-derrota';
      mensajeDiv.innerHTML = `<div class="${clase}">${resultado.mensaje}</div>`;
    }
  };

  // Event listeners para sets
  if (usarModoSets) {
    ['set1', 'set2'].forEach(setNum => {
      document.getElementById(`input-${setNum}-mis`)?.addEventListener('input', actualizarPreview);
      document.getElementById(`input-${setNum}-rival`)?.addEventListener('input', actualizarPreview);
    });
    if (numSetsParaUI === 3) {
      document.getElementById('input-set3-mis')?.addEventListener('input', actualizarPreview);
      document.getElementById('input-set3-rival')?.addEventListener('input', actualizarPreview);
    }
  } else {
    // Modo legacy
    document.getElementById('input-mis-games')?.addEventListener('input', actualizarPreview);
    document.getElementById('input-rival-games')?.addEventListener('input', actualizarPreview);
  }
  
  const mostrarError = (mensaje) => {
    const errorDiv = document.getElementById('error-validation');
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
    
    // Animar entrada
    setTimeout(() => errorDiv.classList.add('show'), 10);
    
    // Auto-ocultar después de 3 segundos
    setTimeout(() => {
      errorDiv.classList.remove('show');
      setTimeout(() => errorDiv.style.display = 'none', 300);
    }, 3000);
  };

  document.getElementById('modal-submit').addEventListener('click', () => {
    if (usarModoSets) {
      // Modo sets
      const set1Mis = document.getElementById('input-set1-mis')?.value;
      const set1Rival = document.getElementById('input-set1-rival')?.value;
      const set2Mis = document.getElementById('input-set2-mis')?.value;
      const set2Rival = document.getElementById('input-set2-rival')?.value;
      const set3Mis = numSetsParaUI === 3 ? document.getElementById('input-set3-mis')?.value : null;
      const set3Rival = numSetsParaUI === 3 ? document.getElementById('input-set3-rival')?.value : null;

      // Validar sets
      const sets = [
        { setA: parseInt(set1Mis), setB: parseInt(set1Rival) },
        { setA: parseInt(set2Mis), setB: parseInt(set2Rival) }
      ];

      if (numSetsParaUI === 3 && set3Mis !== '' && set3Rival !== '') {
        sets.push({ setA: parseInt(set3Mis), setB: parseInt(set3Rival) });
      }

      // Importar validación
      import('../carga/scores.js').then(({ validarSets }) => {
        const validacion = validarSets(sets, numSetsParaUI);
        if (!validacion.ok) {
          mostrarError(validacion.msg);
          return;
        }

        // Preparar objeto de sets para onSubmit
        const setsObj = {
          set1: { setA: sets[0].setA, setB: sets[0].setB },
          set2: { setA: sets[1].setA, setB: sets[1].setB }
        };
        if (numSetsParaUI === 3 && sets.length > 2) {
          setsObj.set3 = { setA: sets[2].setA, setB: sets[2].setB };
        }

        onSubmit(setsObj, numSetsParaUI);
        close();
      });
    } else {
      // Modo legacy (games)
      const misGames = parseInt(document.getElementById('input-mis-games')?.value);
      const rivalGames = parseInt(document.getElementById('input-rival-games')?.value);

      if (isNaN(misGames) || isNaN(rivalGames)) {
        mostrarError('Por favor ingresá ambos resultados.');
        return;
      }

      if (misGames < 0 || rivalGames < 0) {
        mostrarError('Los resultados no pueden ser negativos.');
        return;
      }

      if (misGames === rivalGames) {
        mostrarError('No se puede empatar en pádel. Revisá el resultado.');
        return;
      }

      // Mapear los valores según si soy pareja A o B
      const gamesA = soyA ? misGames : rivalGames;
      const gamesB = soyA ? rivalGames : misGames;

      onSubmit(gamesA, gamesB);
      close();
    }
  });

  // Focus en primer input
  setTimeout(() => {
    document.getElementById('input-mis-games')?.focus();
    actualizarPreview(); // Actualizar si hay valores previos
  }, 100);
}

/**
 * Escapa HTML
 */
function escapeHtml(unsafe) {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
