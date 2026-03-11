/**
 * Módulo de carga y confirmación de resultados
 * Maneja la lógica de estados y transiciones
 */

import { getMensajeResultado } from '../utils/mensajesResultado.js';
import { getMensajeModalCarga } from '../utils/mensajesModalCarga.js';
import { trackCargaResultado } from '../tracking/trackingService.js';
import { validarSet } from '../carga/scores.js';

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
    const set2A = sets.set2 ? (soyA ? sets.set2.setA : sets.set2.setB) : null;
    const set2B = sets.set2 ? (soyA ? sets.set2.setB : sets.set2.setA) : null;
    const set3A = sets.set3 ? (soyA ? sets.set3.setA : sets.set3.setB) : null;
    const set3B = sets.set3 ? (soyA ? sets.set3.setB : sets.set3.setA) : null;

    // Preparar objeto de actualización
    const updateData = {
      set1_a: set1A,
      set1_b: set1B,
      set2_a: set2A,
      set2_b: set2B,
      num_sets: numSets,
      updated_at: new Date().toISOString()
    };

    if (set3A !== null && set3B !== null) {
      updateData.set3_a = set3A;
      updateData.set3_b = set3B;
    } else {
      updateData.set3_a = null;
      updateData.set3_b = null;
    }

    // 2. Lógica según estado actual
    // terminado = org marcó "finalizó" sin resultado; en_juego = en cancha. Ambos permiten primera carga.
    if (estado === 'pendiente' || estado === 'terminado' || estado === 'en_juego') {
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

          // Fire-and-forget: avanzar bracket si es partido de copa
          if (partido.copa_id) {
            supabase.rpc('avanzar_ronda_copa', { p_copa_id: partido.copa_id })
              .then(({ error }) => { if (error) console.warn('Avanzar ronda copa:', error.message); });
          }

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
 * Carga o actualiza un resultado de partido (versión legacy - DEPRECATED)
 * 
 * NOTA: Esta función convierte games a un set único para compatibilidad.
 * Para nuevos usos, preferir cargarResultadoConSets() directamente.
 * 
 * @param {Object} supabase - Cliente de Supabase
 * @param {String} partidoId - ID del partido
 * @param {Number} gamesA - Games de pareja A (se guardará como set1)
 * @param {Number} gamesB - Games de pareja B (se guardará como set1)
 * @param {Object} identidad - Identidad del usuario
 * @returns {Object} Resultado de la operación
 */
export async function cargarResultado(supabase, partidoId, gamesA, gamesB, identidad) {
  // Convertir a formato sets (partido a 1 set)
  const sets = {
    set1: { setA: gamesA, setB: gamesB }
  };
  return cargarResultadoConSets(supabase, partidoId, sets, 1, identidad);
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
          notas_revision: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', partidoId);

      if (updateError) throw updateError;
    }

    // Fire-and-forget: avanzar bracket si es partido de copa
    if (partido.copa_id) {
      supabase.rpc('avanzar_ronda_copa', { p_copa_id: partido.copa_id })
        .then(({ error }) => { if (error) console.warn('Avanzar ronda copa:', error.message); });
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
 * Verifica si Set 1 es válido para mostrar el botón "Agregar Set 2"
 * Un set es válido si ambos valores son numéricos, >= 0, no nulos y no iguales
 * @param {Object} partido - Objeto del partido
 * @returns {boolean} true si Set 1 es válido
 */
function esSet1Valido(partido) {
  const set1A = partido.set1_a;
  const set1B = partido.set1_b;
  
  // Verificar que no sean null o undefined
  if (set1A === null || set1B === null || set1A === undefined || set1B === undefined || set1A === '' || set1B === '') {
    return false;
  }
  
  const a = Number(set1A);
  const b = Number(set1B);
  
  // Verificar que sean numéricos
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return false;
  }
  
  // Verificar que sean enteros
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return false;
  }
  
  // Verificar que sean >= 0
  if (a < 0 || b < 0) {
    return false;
  }
  
  // Verificar que no sean iguales
  if (a === b) {
    return false;
  }
  
  return true;
}

/**
 * Determina qué sets y botones mostrar según el modo del partido
 * @param {Object} partido - Objeto del partido
 * @returns {Object} Objeto con flags de visualización: { mostrarSet1, mostrarSet2, mostrarSet3, mostrarBotonSet2, numSetsParaUI }
 */
function determinarVisualizacionSets(partido) {
  const numSets = partido.num_sets !== null && partido.num_sets !== undefined 
    ? partido.num_sets 
    : null;
  
  // Detectar cuántos sets están realmente cargados
  const tieneSet1 = (partido.set1_a !== null && partido.set1_a !== undefined && partido.set1_a !== '') ||
                     (partido.set1_b !== null && partido.set1_b !== undefined && partido.set1_b !== '');
  const tieneSet2 = (partido.set2_a !== null && partido.set2_a !== undefined && partido.set2_a !== '') ||
                     (partido.set2_b !== null && partido.set2_b !== undefined && partido.set2_b !== '');
  const tieneSet3 = (partido.set3_a !== null && partido.set3_a !== undefined && partido.set3_a !== '') ||
                     (partido.set3_b !== null && partido.set3_b !== undefined && partido.set3_b !== '');
  
  // Determinar si el partido está empatado 1-1 en sets
  const set1GanadoA = tieneSet1 && partido.set1_a !== null && partido.set1_b !== null && partido.set1_a > partido.set1_b;
  const set1GanadoB = tieneSet1 && partido.set1_a !== null && partido.set1_b !== null && partido.set1_b > partido.set1_a;
  const set2GanadoA = tieneSet2 && partido.set2_a !== null && partido.set2_b !== null && partido.set2_a > partido.set2_b;
  const set2GanadoB = tieneSet2 && partido.set2_a !== null && partido.set2_b !== null && partido.set2_b > partido.set2_a;
  const setsGanadosA = (set1GanadoA ? 1 : 0) + (set2GanadoA ? 1 : 0);
  const setsGanadosB = (set1GanadoB ? 1 : 0) + (set2GanadoB ? 1 : 0);
  const estaEmpatado1a1 = tieneSet1 && tieneSet2 && setsGanadosA === 1 && setsGanadosB === 1;
  
  const set1Valido = esSet1Valido(partido);
  
  let mostrarSet1 = false;
  let mostrarSet2 = false;
  let mostrarSet3 = false;
  let mostrarBotonSet2 = false;
  let numSetsParaUI = 3;
  
  if (numSets === 1) {
    // Modo B: 1 Set
    mostrarSet1 = true;
    mostrarSet2 = false;
    mostrarSet3 = false;
    mostrarBotonSet2 = false;
    numSetsParaUI = 1;
  } else if (numSets === 3) {
    // Modo C: 3 Sets
    mostrarSet1 = true;
    mostrarSet2 = true;
    // Set 3 se muestra automáticamente si hay empate 1-1 o si ya está cargado
    mostrarSet3 = estaEmpatado1a1 || tieneSet3;
    mostrarBotonSet2 = false;
    numSetsParaUI = 3;
  } else {
    // Modo A: Indefinido (NULL)
    mostrarSet1 = true;
    mostrarSet2 = tieneSet2; // Solo mostrar Set 2 si ya está cargado
    // En modo indefinido, Set 3 se muestra según reglas del Modo 3 sets (si hay empate 1-1)
    mostrarSet3 = tieneSet2 && (estaEmpatado1a1 || tieneSet3);
    mostrarBotonSet2 = set1Valido && !tieneSet2; // Solo mostrar botón si Set 1 es válido y no hay Set 2
    numSetsParaUI = 3; // Cuando se agregue Set 2, pasará a modo 3 sets
  }
  
  return {
    mostrarSet1,
    mostrarSet2,
    mostrarSet3,
    mostrarBotonSet2,
    numSetsParaUI,
    estaEmpatado1a1
  };
}

/**
 * Muestra modal/UI para cargar resultado con sets
 */
export function mostrarModalCargarResultado(partido, identidad, onSubmit, supabase) {
  const oponente = partido.pareja_a?.id === identidad.parejaId 
    ? (partido.pareja_b?.nombre || 'Oponente')
    : (partido.pareja_a?.nombre || 'Oponente');

  const miNombre = identidad.parejaNombre || 'Tu pareja';
  const soyA = partido.pareja_a?.id === identidad.parejaId;
  
  // Determinar visualización usando función extraída
  const visualizacion = determinarVisualizacionSets(partido);
  const { mostrarSet1, mostrarSet2, mostrarSet3, mostrarBotonSet2, numSetsParaUI, estaEmpatado1a1 } = visualizacion;
  
  // Valores iniciales para cada set
  const getSetValue = (setNum, isA) => {
    const setField = `set${setNum}_${isA ? 'a' : 'b'}`;
    const tempField = `set${setNum}_temp_${isA ? 'a' : 'b'}`;
    
    if (partido.estado === 'en_revision' && partido[tempField] !== null && partido[tempField] !== undefined) {
      return String(partido[tempField]);
    }
    if (partido[setField] !== null && partido[setField] !== undefined) {
      return String(partido[setField]);
    }
    return '';
  };

  const set1Mis = soyA ? getSetValue(1, true) : getSetValue(1, false);
  const set1Rival = soyA ? getSetValue(1, false) : getSetValue(1, true);
  const set2Mis = soyA ? getSetValue(2, true) : getSetValue(2, false);
  const set2Rival = soyA ? getSetValue(2, false) : getSetValue(2, true);
  const set3Mis = mostrarSet3 ? (soyA ? getSetValue(3, true) : getSetValue(3, false)) : '';
  const set3Rival = mostrarSet3 ? (soyA ? getSetValue(3, false) : getSetValue(3, true)) : '';
  
  // Declarar funciones auxiliares que se usarán más adelante
  let actualizarPreview;
  let manejarAgregarSet2;
  let manejarEliminarSet2;
  let actualizarSet3SegunEmpate;

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
          <!-- Modo Sets (siempre activo) -->
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
                      value="${set1Rival}"
                      placeholder=""
                    />
                  </div>
                </div>
              </div>
              
              ${mostrarSet2 ? `
                <div class="set-input-group" id="set2-group">
                  <label class="set-label">Set 2</label>
                  <div class="set-inputs-row">
                    <div class="set-input-wrapper">
                      <input 
                        type="number" 
                        id="input-set2-mis" 
                        class="input-score-modal input-set"
                        min="0" 
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
                        value="${set2Rival}"
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>
              ` : `
                <div class="set-input-group" id="set2-group" style="display: none;">
                  <label class="set-label">Set 2</label>
                  <div class="set-inputs-row">
                    <div class="set-input-wrapper">
                      <input 
                        type="number" 
                        id="input-set2-mis" 
                        class="input-score-modal input-set"
                        min="0" 
                        value=""
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
                        value=""
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>
              `}
              
              ${mostrarBotonSet2 ? `
                <div class="set-add-button-container">
                  <button type="button" class="btn-add-set" id="btn-agregar-set2">
                    + Agregar Set 2
                  </button>
                </div>
              ` : ''}
              
              ${mostrarSet3 ? `
                <div class="set-input-group" id="set3-group">
                  <label class="set-label">Set 3 (Super Tiebreak) <span class="set-optional">(solo si hay empate 1-1)</span></label>
                  <div class="set-inputs-row">
                    <div class="set-input-wrapper">
                      <input 
                        type="number" 
                        id="input-set3-mis" 
                        class="input-score-modal input-set"
                        min="0" 
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
                        value="${set3Rival}"
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>
              ` : `
                <div class="set-input-group" id="set3-group" style="display: none;">
                  <label class="set-label">Set 3 (Super Tiebreak) <span class="set-optional">(solo si hay empate 1-1)</span></label>
                  <div class="set-inputs-row">
                    <div class="set-input-wrapper">
                      <input 
                        type="number" 
                        id="input-set3-mis" 
                        class="input-score-modal input-set"
                        min="0" 
                        value=""
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
                        value=""
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>
              `}
              
            </div>
        </div>
        
        <div id="error-validation" class="error-validation"></div>
        <div id="mensaje-preview" class="mensaje-preview"></div>

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
  
  // Función auxiliar para determinar mensaje según contexto
  const determinarMensaje = (contexto) => {
    const { nivel, categoria } = contexto;
    return getMensajeModalCarga(nivel, categoria);
  };

  // Actualizar preview cuando cambien los valores
  actualizarPreview = () => {
    const mensajeDiv = document.getElementById('mensaje-preview');
    mensajeDiv.innerHTML = '';

    // Modo sets (siempre activo)
    const set1Mis = parseInt(document.getElementById('input-set1-mis')?.value || '');
    const set1Rival = parseInt(document.getElementById('input-set1-rival')?.value || '');
    
    // Verificar si Set 1 es válido según los inputs (no la BD)
    const set1ValidoDesdeInputs = !isNaN(set1Mis) && !isNaN(set1Rival) && 
                                    set1Mis >= 0 && set1Rival >= 0 && 
                                    set1Mis !== set1Rival;
    
    // Actualizar visibilidad del botón "Agregar Set 2" dinámicamente (solo en modo indefinido)
    const numSets = partido.num_sets !== null && partido.num_sets !== undefined ? partido.num_sets : null;
    const tieneSet2 = (partido.set2_a !== null && partido.set2_a !== undefined && partido.set2_a !== '') ||
                      (partido.set2_b !== null && partido.set2_b !== undefined && partido.set2_b !== '');
    const set2GroupVisible = document.getElementById('set2-group')?.style.display !== 'none';
    
    if (numSets === null) {
      // Modo indefinido: mostrar/ocultar botón según si Set 1 es válido y no hay Set 2 visible
      const btnContainer = document.querySelector('.set-add-button-container');
      const btnAgregarSet2 = document.getElementById('btn-agregar-set2');
      const btnEliminarSet2 = document.getElementById('btn-eliminar-set2');
      
      const debeMostrarBoton = set1ValidoDesdeInputs && !tieneSet2 && !set2GroupVisible;
      
      if (debeMostrarBoton && !btnAgregarSet2 && !btnEliminarSet2) {
        // Crear el botón si no existe
        const container = document.createElement('div');
        container.className = 'set-add-button-container';
        container.innerHTML = `
          <button type="button" class="btn-add-set" id="btn-agregar-set2">
            + Agregar Set 2
          </button>
        `;
        // Insertar después del Set 1
        const set1Group = document.querySelector('.set-input-group');
        if (set1Group && set1Group.nextSibling) {
          set1Group.parentNode.insertBefore(container, set1Group.nextSibling);
        } else if (set1Group) {
          set1Group.parentNode.appendChild(container);
        }
        // Agregar event listener (la función se definirá después)
        const nuevoBoton = document.getElementById('btn-agregar-set2');
        if (nuevoBoton && manejarAgregarSet2) {
          nuevoBoton.addEventListener('click', manejarAgregarSet2);
        } else if (nuevoBoton) {
          // Si la función aún no está definida, agregar el listener después
          setTimeout(() => {
            if (manejarAgregarSet2) {
              nuevoBoton.addEventListener('click', manejarAgregarSet2);
            }
          }, 0);
        }
      } else if (!debeMostrarBoton && btnAgregarSet2) {
        // Ocultar el botón si Set 1 deja de ser válido
        btnAgregarSet2.parentElement.remove();
      }
    }
    const set2Mis = parseInt(document.getElementById('input-set2-mis')?.value || '');
    const set2Rival = parseInt(document.getElementById('input-set2-rival')?.value || '');
    const set3Mis = mostrarSet3 ? parseInt(document.getElementById('input-set3-mis')?.value || '') : null;
    const set3Rival = mostrarSet3 ? parseInt(document.getElementById('input-set3-rival')?.value || '') : null;

    // Validar y mostrar feedback por cada set
    const set1Completo = !isNaN(set1Mis) && !isNaN(set1Rival) && set1Mis >= 0 && set1Rival >= 0;
    const set2Completo = !isNaN(set2Mis) && !isNaN(set2Rival) && set2Mis >= 0 && set2Rival >= 0;
    const set3Completo = mostrarSet3 && !isNaN(set3Mis) && !isNaN(set3Rival) && set3Mis >= 0 && set3Rival >= 0;

    // Validar cada set individualmente
    let hayErrores = false;
    const sets = [];
    const set1Valido = set1Completo && validarSet(set1Mis, set1Rival).ok;
    const set2Valido = set2Completo && validarSet(set2Mis, set2Rival).ok;
    const set3Valido = set3Completo && validarSet(set3Mis, set3Rival).ok;

    if (set1Completo) {
      const validacion = validarSet(set1Mis, set1Rival);
      if (validacion.ok) {
        sets.push({ setA: set1Mis, setB: set1Rival });
      } else {
        hayErrores = true;
      }
    }

    if (set2Completo) {
      const validacion = validarSet(set2Mis, set2Rival);
      if (validacion.ok) {
        sets.push({ setA: set2Mis, setB: set2Rival });
      } else {
        hayErrores = true;
      }
    }

    if (set3Completo) {
      const validacion = validarSet(set3Mis, set3Rival);
      if (validacion.ok) {
        sets.push({ setA: set3Mis, setB: set3Rival });
      } else {
        hayErrores = true;
      }
    }

    // Calcular sets ganados
    let setsGanadosMis = 0;
    let setsGanadosRival = 0;
    for (const set of sets) {
      if (set.setA > set.setB) setsGanadosMis++;
      else if (set.setB > set.setA) setsGanadosRival++;
    }

    // Determinar si hay empate 1-1
    const hayEmpate1a1 = sets.length >= 2 && setsGanadosMis === 1 && setsGanadosRival === 1;
    
    // Determinar si el partido está completo
    const setsNecesarios = numSetsParaUI === 1 ? 1 : 2;
    const partidoCompleto = sets.length >= setsNecesarios && (setsGanadosMis >= setsNecesarios || setsGanadosRival >= setsNecesarios);
    
    // Determinar nivel y categoría según el contexto
    let nivel = 'PARTIDO';
    let categoria = 'EMPATE';
    let mensaje = '';

    // Si hay errores de validación, mostrar mensaje de error
    if (hayErrores) {
      // Buscar el primer error y usar mensaje de validación (más técnico/informativo)
      if (set1Completo && !set1Valido) {
        const validacion = validarSet(set1Mis, set1Rival);
        mensaje = validacion.msg;
        // Para errores, usar mensaje de validación directamente (más informativo)
        // pero también podríamos usar getMensajeModalCarga si queremos mensajes más divertidos
        nivel = numSets === 1 ? 'PARTIDO' : 'SET';
        categoria = 'EMPATE';
        // Si el error es por empate, usar mensaje divertido
        if (set1Mis === set1Rival) {
          mensaje = determinarMensaje({ nivel, categoria });
        }
      } else if (set2Completo && !set2Valido) {
        const validacion = validarSet(set2Mis, set2Rival);
        mensaje = validacion.msg;
        nivel = 'SET';
        categoria = 'EMPATE';
        if (set2Mis === set2Rival) {
          mensaje = determinarMensaje({ nivel, categoria });
        }
      } else if (set3Completo && !set3Valido) {
        const validacion = validarSet(set3Mis, set3Rival);
        mensaje = validacion.msg;
        nivel = 'SET';
        categoria = 'EMPATE';
        if (set3Mis === set3Rival) {
          mensaje = determinarMensaje({ nivel, categoria });
        }
      }
    } else if (partidoCompleto) {
      // Partido completo: Nivel PARTIDO
      nivel = 'PARTIDO';
      const yoGano = setsGanadosMis >= setsNecesarios;
      categoria = yoGano ? 'GANAR' : 'PERDER';
      mensaje = determinarMensaje({ nivel, categoria });
    } else if (numSets === 1 && set1Valido) {
      // Modo 1 Set: Set 1 válido = Nivel PARTIDO
      nivel = 'PARTIDO';
      const yoGano = set1Mis > set1Rival;
      categoria = yoGano ? 'GANAR' : 'PERDER';
      mensaje = determinarMensaje({ nivel, categoria });
    } else if (numSets === null && set1Valido && !set2GroupVisible) {
      // Modo Indefinido: Set 1 válido sin Set 2 = Nivel PARTIDO
      nivel = 'PARTIDO';
      const yoGano = set1Mis > set1Rival;
      categoria = yoGano ? 'GANAR' : 'PERDER';
      mensaje = determinarMensaje({ nivel, categoria });
    } else if (numSets === null && set1Valido && set2GroupVisible && !set2Valido) {
      // Modo Indefinido: Set 1 válido, Set 2 visible pero no completo = Nivel SET
      nivel = 'SET';
      const yoGanoSet1 = set1Mis > set1Rival;
      categoria = yoGanoSet1 ? 'GANAR' : 'PERDER';
      mensaje = determinarMensaje({ nivel, categoria });
    } else if (set2Valido && hayEmpate1a1) {
      // Set 2 completo con empate 1-1
      if (set3Valido) {
        // Set 3 válido = Nivel PARTIDO
        nivel = 'PARTIDO';
        const yoGano = setsGanadosMis >= 2;
        categoria = yoGano ? 'GANAR' : 'PERDER';
        mensaje = determinarMensaje({ nivel, categoria });
      } else {
        // Set 3 no válido = Nivel SET (EMPATE)
        nivel = 'SET';
        categoria = 'EMPATE';
        mensaje = determinarMensaje({ nivel, categoria });
      }
    } else if (set2Valido && !hayEmpate1a1) {
      // Set 2 completo sin empate = Nivel PARTIDO
      nivel = 'PARTIDO';
      const yoGano = setsGanadosMis >= 2;
      categoria = yoGano ? 'GANAR' : 'PERDER';
      mensaje = determinarMensaje({ nivel, categoria });
    } else if (set1Valido && !set2Completo && numSets === 3) {
      // Modo 3 Sets: Set 1 válido, Set 2 no completo = Nivel SET
      nivel = 'SET';
      const yoGano = set1Mis > set1Rival;
      categoria = yoGano ? 'GANAR' : 'PERDER';
      mensaje = determinarMensaje({ nivel, categoria });
    } else if (set2Valido && !partidoCompleto && numSets === 3) {
      // Modo 3 Sets: Set 2 válido pero partido no completo = Nivel SET
      if (hayEmpate1a1) {
        nivel = 'SET';
        categoria = 'EMPATE';
        mensaje = determinarMensaje({ nivel, categoria });
      } else {
        nivel = 'SET';
        const yoGano = set2Mis > set2Rival;
        categoria = yoGano ? 'GANAR' : 'PERDER';
        mensaje = determinarMensaje({ nivel, categoria });
      }
    } else if (set3Valido && partidoCompleto) {
      // Set 3 válido y partido completo = Nivel PARTIDO
      nivel = 'PARTIDO';
      const yoGano = setsGanadosMis >= setsNecesarios;
      categoria = yoGano ? 'GANAR' : 'PERDER';
      mensaje = determinarMensaje({ nivel, categoria });
    } else if (set1Valido && !set2Completo) {
      // Set 1 válido, Set 2 no completo = Nivel SET
      nivel = 'SET';
      const yoGano = set1Mis > set1Rival;
      categoria = yoGano ? 'GANAR' : 'PERDER';
      mensaje = determinarMensaje({ nivel, categoria });
    }

    // Mostrar mensaje
    if (mensaje) {
      const claseMensaje = categoria === 'EMPATE' ? 'mensaje-empate' : (categoria === 'GANAR' ? 'mensaje-victoria' : 'mensaje-derrota');
      mensajeDiv.innerHTML = `<div class="${claseMensaje}" style="font-size: 13px; text-align: left; padding: 8px 12px;">${mensaje}</div>`;
    }
  };

  // Event listeners para sets
  // Set 1 siempre está presente
  document.getElementById('input-set1-mis')?.addEventListener('input', actualizarPreview);
  document.getElementById('input-set1-rival')?.addEventListener('input', actualizarPreview);
  
  // Set 2 (si está visible)
  if (mostrarSet2) {
    document.getElementById('input-set2-mis')?.addEventListener('input', actualizarPreview);
    document.getElementById('input-set2-rival')?.addEventListener('input', actualizarPreview);
  }
  
  // Set 3 (si está visible)
  if (mostrarSet3) {
    document.getElementById('input-set3-mis')?.addEventListener('input', actualizarPreview);
    document.getElementById('input-set3-rival')?.addEventListener('input', actualizarPreview);
  }
  
  // Función auxiliar para mostrar/ocultar Set 3 según empate 1-1
  // IMPORTANTE: Set 3 solo se muestra si Set 2 está COMPLETO (ambos valores válidos) y hay empate 1-1
  actualizarSet3SegunEmpate = () => {
    const set1Mis = parseInt(document.getElementById('input-set1-mis')?.value || '');
    const set1Rival = parseInt(document.getElementById('input-set1-rival')?.value || '');
    const set2Mis = parseInt(document.getElementById('input-set2-mis')?.value || '');
    const set2Rival = parseInt(document.getElementById('input-set2-rival')?.value || '');
    
    // Verificar que Set 1 y Set 2 estén completos (ambos valores válidos)
    const set1Completo = !isNaN(set1Mis) && !isNaN(set1Rival) && set1Mis >= 0 && set1Rival >= 0 && set1Mis !== set1Rival;
    const set2Completo = !isNaN(set2Mis) && !isNaN(set2Rival) && set2Mis >= 0 && set2Rival >= 0 && set2Mis !== set2Rival;
    
    // Solo proceder si ambos sets están completos
    if (set1Completo && set2Completo) {
      const set1GanadoA = set1Mis > set1Rival;
      const set1GanadoB = set1Rival > set1Mis;
      const set2GanadoA = set2Mis > set2Rival;
      const set2GanadoB = set2Rival > set2Mis;
      const setsGanadosA = (set1GanadoA ? 1 : 0) + (set2GanadoA ? 1 : 0);
      const setsGanadosB = (set1GanadoB ? 1 : 0) + (set2GanadoB ? 1 : 0);
      const hayEmpate1a1 = setsGanadosA === 1 && setsGanadosB === 1;
      
      const set3Group = document.getElementById('set3-group');
      if (hayEmpate1a1) {
        if (set3Group) {
          set3Group.style.display = 'block';
          // Restaurar valores guardados si existen
          const set3MisGuardado = set3Group.getAttribute('data-set3-mis');
          const set3RivalGuardado = set3Group.getAttribute('data-set3-rival');
          if (set3MisGuardado) {
            document.getElementById('input-set3-mis').value = set3MisGuardado;
          }
          if (set3RivalGuardado) {
            document.getElementById('input-set3-rival').value = set3RivalGuardado;
          }
          // Asegurar que los event listeners estén activos
          const inputSet3Mis = document.getElementById('input-set3-mis');
          const inputSet3Rival = document.getElementById('input-set3-rival');
          if (inputSet3Mis && !inputSet3Mis.hasAttribute('data-listener-set')) {
            inputSet3Mis.addEventListener('input', actualizarPreview);
            inputSet3Mis.setAttribute('data-listener-set', 'true');
          }
          if (inputSet3Rival && !inputSet3Rival.hasAttribute('data-listener-set')) {
            inputSet3Rival.addEventListener('input', actualizarPreview);
            inputSet3Rival.setAttribute('data-listener-set', 'true');
          }
        }
      } else {
        if (set3Group) {
          // Guardar valores antes de ocultar
          const set3Mis = document.getElementById('input-set3-mis')?.value || '';
          const set3Rival = document.getElementById('input-set3-rival')?.value || '';
          if (set3Mis || set3Rival) {
            set3Group.setAttribute('data-set3-mis', set3Mis);
            set3Group.setAttribute('data-set3-rival', set3Rival);
          }
          set3Group.style.display = 'none';
        }
      }
    } else {
      // Si Set 2 no está completo, ocultar Set 3
      const set3Group = document.getElementById('set3-group');
      if (set3Group) {
        // Guardar valores antes de ocultar
        const set3Mis = document.getElementById('input-set3-mis')?.value || '';
        const set3Rival = document.getElementById('input-set3-rival')?.value || '';
        if (set3Mis || set3Rival) {
          set3Group.setAttribute('data-set3-mis', set3Mis);
          set3Group.setAttribute('data-set3-rival', set3Rival);
        }
        set3Group.style.display = 'none';
      }
    }
  };
  
  // Función para manejar el botón "Agregar Set 2"
  manejarAgregarSet2 = () => {
    const set2Group = document.getElementById('set2-group');
    const btnSet2 = document.getElementById('btn-agregar-set2');
    if (set2Group && btnSet2) {
      // Mostrar Set 2
      set2Group.style.display = 'block';
      
      // Reemplazar botón "Agregar Set 2" por "Eliminar 2do set"
      const container = btnSet2.parentElement;
      container.innerHTML = `
        <button type="button" class="btn-add-set" id="btn-eliminar-set2">
          - Eliminar 2do set
        </button>
      `;
      
      // Agregar event listener al nuevo botón
      document.getElementById('btn-eliminar-set2')?.addEventListener('click', manejarEliminarSet2);
      
      // Asegurar que Set 3 esté oculto inicialmente (solo se mostrará cuando Set 2 esté completo y haya empate)
      const set3Group = document.getElementById('set3-group');
      if (set3Group) {
        set3Group.style.display = 'none';
      }
      
      // Agregar event listeners a los inputs de Set 2
      document.getElementById('input-set2-mis')?.addEventListener('input', () => {
        actualizarPreview();
        actualizarSet3SegunEmpate();
      });
      document.getElementById('input-set2-rival')?.addEventListener('input', () => {
        actualizarPreview();
        actualizarSet3SegunEmpate();
      });
      
      actualizarPreview();
    }
  };
  
  // Función para manejar el botón "Eliminar 2do set"
  manejarEliminarSet2 = () => {
    const set2GroupToHide = document.getElementById('set2-group');
    const set3GroupToHide = document.getElementById('set3-group');
    const btnEliminar = document.getElementById('btn-eliminar-set2');
    
    if (set2GroupToHide && btnEliminar) {
      // Ocultar Set 2 y Set 3
      set2GroupToHide.style.display = 'none';
      if (set3GroupToHide) {
        set3GroupToHide.style.display = 'none';
      }
      
      // Limpiar valores de Set 2 y Set 3 en los inputs
      document.getElementById('input-set2-mis').value = '';
      document.getElementById('input-set2-rival').value = '';
      if (set3GroupToHide) {
        // Guardar valores del Set 3 antes de ocultarlo (para restaurarlos después)
        const set3Mis = document.getElementById('input-set3-mis')?.value || '';
        const set3Rival = document.getElementById('input-set3-rival')?.value || '';
        if (set3Mis || set3Rival) {
          set3GroupToHide.setAttribute('data-set3-mis', set3Mis);
          set3GroupToHide.setAttribute('data-set3-rival', set3Rival);
        }
        document.getElementById('input-set3-mis').value = '';
        document.getElementById('input-set3-rival').value = '';
      }
      
      // Reemplazar botón "Eliminar 2do set" por "Agregar Set 2"
      const container = btnEliminar.parentElement;
      container.innerHTML = `
        <button type="button" class="btn-add-set" id="btn-agregar-set2">
          + Agregar Set 2
        </button>
      `;
      
      // Agregar event listener al nuevo botón
      document.getElementById('btn-agregar-set2')?.addEventListener('click', manejarAgregarSet2);
      
      actualizarPreview();
    }
  };
  
  // Botones para agregar/eliminar sets
  document.getElementById('btn-agregar-set2')?.addEventListener('click', manejarAgregarSet2);
  
  // Asegurar que cualquier botón "Agregar Set 2" creado dinámicamente tenga su event listener
  // (esto es necesario porque el botón puede crearse en actualizarPreview() antes de que manejarAgregarSet2 esté definida)
  const asegurarListeners = () => {
    const botonesAgregar = document.querySelectorAll('#btn-agregar-set2');
    botonesAgregar.forEach(btn => {
      // Verificar si ya tiene el listener
      if (!btn.hasAttribute('data-listener-agregado')) {
        btn.addEventListener('click', manejarAgregarSet2);
        btn.setAttribute('data-listener-agregado', 'true');
      }
    });
  };
  
  // Ejecutar después de un pequeño delay para asegurar que todas las funciones estén definidas
  setTimeout(asegurarListeners, 100);

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
    // Modo sets - obtener valores de los inputs visibles
    const set1Mis = document.getElementById('input-set1-mis')?.value;
    const set1Rival = document.getElementById('input-set1-rival')?.value;
    const set2Mis = document.getElementById('input-set2-mis')?.value;
    const set2Rival = document.getElementById('input-set2-rival')?.value;
    const set3Mis = document.getElementById('input-set3-mis')?.value;
    const set3Rival = document.getElementById('input-set3-rival')?.value;
    
    // Determinar cuántos sets están completos
    const sets = [];
    if (set1Mis !== '' && set1Rival !== '') {
      sets.push({ setA: parseInt(set1Mis), setB: parseInt(set1Rival) });
    }
    if (set2Mis !== '' && set2Rival !== '') {
      sets.push({ setA: parseInt(set2Mis), setB: parseInt(set2Rival) });
    }
    if (set3Mis !== '' && set3Rival !== '') {
      sets.push({ setA: parseInt(set3Mis), setB: parseInt(set3Rival) });
    }
    
    // Obtener numSets del partido
    const numSets = partido.num_sets !== null && partido.num_sets !== undefined 
      ? partido.num_sets 
      : null;
    
    // Determinar numSets: si está definido en partido (1 o 3), usarlo; si es NULL, inferir de sets cargados
    let numSetsFinal;
    if (numSets !== null && (numSets === 1 || numSets === 3)) {
      numSetsFinal = numSets;
    } else {
      // Modo indefinido: inferir del número de sets cargados
      if (sets.length === 1) {
        numSetsFinal = 1;
      } else {
        numSetsFinal = 3; // Si hay 2 o más sets, es partido a 3 sets
      }
    }
    
    // Validar sets
    import('../carga/scores.js').then(({ validarSets }) => {
      const validacion = validarSets(sets, numSetsFinal);
      if (!validacion.ok) {
        mostrarError(validacion.msg);
        return;
      }

      // Preparar objeto de sets para onSubmit
      const setsObj = {
        set1: { setA: sets[0].setA, setB: sets[0].setB }
      };
      if (sets.length > 1) {
        setsObj.set2 = { setA: sets[1].setA, setB: sets[1].setB };
      }
      if (sets.length > 2) {
        setsObj.set3 = { setA: sets[2].setA, setB: sets[2].setB };
      }

      onSubmit(setsObj, numSetsFinal);
      close();
    });
  });

  // Focus en primer input
  setTimeout(() => {
    document.getElementById('input-set1-mis')?.focus();
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
