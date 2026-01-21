/**
 * Módulo de carga y confirmación de resultados
 * Maneja la lógica de estados y transiciones
 */

import { getMensajeResultado } from '../utils/mensajesResultado.js';
import { trackCargaResultado } from '../tracking/trackingService.js';

/**
 * Carga o actualiza un resultado de partido
 * @param {Object} supabase - Cliente de Supabase
 * @param {String} partidoId - ID del partido
 * @param {Number} gamesA - Games de pareja A
 * @param {Number} gamesB - Games de pareja B
 * @param {Object} identidad - Identidad del usuario
 * @returns {Object} Resultado de la operación
 */
export async function cargarResultado(supabase, partidoId, gamesA, gamesB, identidad) {
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
      const { error: updateError } = await supabase
        .from('partidos')
        .update({
          games_a: partido.resultado_temp_a,
          games_b: partido.resultado_temp_b,
          estado: 'confirmado',
          resultado_temp_a: null,
          resultado_temp_b: null,
          notas_revision: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', partidoId);

      if (updateError) throw updateError;
    } else {
      // Acepto el resultado original
      const { error: updateError } = await supabase
        .from('partidos')
        .update({
          estado: 'confirmado',
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
 * Muestra modal/UI para cargar resultado
 */
export function mostrarModalCargarResultado(partido, identidad, onSubmit) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/55950f91-7837-4b4e-a7ee-c1c8657c32bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cargarResultado.js:302',message:'mostrarModalCargarResultado iniciado',data:{partidoId:partido.id,identidadNombre:identidad.parejaNombre},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  const oponente = partido.pareja_a?.id === identidad.parejaId 
    ? partido.pareja_b?.nombre 
    : partido.pareja_a?.nombre;

  const miNombre = identidad.parejaNombre;
  const gamesAPrevia = partido.games_a;
  const gamesBPrevia = partido.games_b;

  // Determinar qué inputs corresponden a cada pareja
  const soyA = partido.pareja_a?.id === identidad.parejaId;
  
  // Valores iniciales - SIEMPRE en orden: mis games, games del rival
  const valorInicialMisGames = soyA 
    ? (gamesAPrevia !== null ? gamesAPrevia : '')
    : (gamesBPrevia !== null ? gamesBPrevia : '');
  const valorInicialRivalGames = soyA 
    ? (gamesBPrevia !== null ? gamesBPrevia : '')
    : (gamesAPrevia !== null ? gamesAPrevia : '');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/55950f91-7837-4b4e-a7ee-c1c8657c32bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cargarResultado.js:324',message:'modal creado',data:{modalClassName:modal.className},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
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
        </div>
        
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

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/55950f91-7837-4b4e-a7ee-c1c8657c32bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cargarResultado.js:390',message:'antes de appendChild modal',data:{bodyExists:!!document.body},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  document.body.appendChild(modal);
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/55950f91-7837-4b4e-a7ee-c1c8657c32bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cargarResultado.js:396',message:'modal agregado al DOM',data:{modalEnDOM:document.body.contains(modal)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

  // Event listeners
  const close = () => {
    modal.remove();
  };

  document.getElementById('modal-close').addEventListener('click', close);
  document.getElementById('modal-cancel').addEventListener('click', close);
  
  // Actualizar preview cuando cambien los valores
  const actualizarPreview = () => {
    const inputMisGames = document.getElementById('input-mis-games');
    const inputRivalGames = document.getElementById('input-rival-games');
    const groupMisGames = document.getElementById('score-group-mis-games');
    const groupRivalGames = document.getElementById('score-group-rival-games');
    const mensajeDiv = document.getElementById('mensaje-preview');
    
    const misGames = parseInt(inputMisGames.value);
    const rivalGames = parseInt(inputRivalGames.value);

    // Limpiar clases previas
    groupMisGames.classList.remove('ganador', 'perdedor');
    groupRivalGames.classList.remove('ganador', 'perdedor');
    mensajeDiv.innerHTML = '';

    if (isNaN(misGames) || isNaN(rivalGames) || misGames < 0 || rivalGames < 0) {
      return; // No mostrar nada si no son válidos
    }

    // Obtener mensaje y aplicar colores
    // Siempre comparamos desde la perspectiva del usuario (yo siempre soy "A" en esta vista)
    const resultado = getMensajeResultado(misGames, rivalGames, true);
    
    if (resultado.tipo === 'empate') {
      mensajeDiv.innerHTML = `<div class="mensaje-empate">${resultado.mensaje}</div>`;
      return;
    }

    // Colorear ganador/perdedor
    if (misGames > rivalGames) {
      groupMisGames.classList.add('ganador');
      groupRivalGames.classList.add('perdedor');
    } else {
      groupRivalGames.classList.add('ganador');
      groupMisGames.classList.add('perdedor');
    }

    // Mostrar mensaje
    const clase = resultado.tipo === 'victoria' ? 'mensaje-victoria' : 'mensaje-derrota';
    mensajeDiv.innerHTML = `<div class="${clase}">${resultado.mensaje}</div>`;
  };

  document.getElementById('input-mis-games').addEventListener('input', actualizarPreview);
  document.getElementById('input-rival-games').addEventListener('input', actualizarPreview);
  
  document.getElementById('modal-submit').addEventListener('click', () => {
    const misGames = parseInt(document.getElementById('input-mis-games').value);
    const rivalGames = parseInt(document.getElementById('input-rival-games').value);

    if (isNaN(misGames) || isNaN(rivalGames)) {
      alert('Por favor ingresá ambos resultados.');
      return;
    }

    if (misGames < 0 || rivalGames < 0) {
      alert('Los resultados no pueden ser negativos.');
      return;
    }

    if (misGames === rivalGames) {
      alert('No se puede empatar en pádel. Revisá el resultado.');
      return;
    }

    // Mapear los valores según si soy pareja A o B
    const gamesA = soyA ? misGames : rivalGames;
    const gamesB = soyA ? rivalGames : misGames;

    onSubmit(gamesA, gamesB);
    close();
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
