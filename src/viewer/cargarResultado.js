/**
 * Módulo de carga y confirmación de resultados
 * Maneja la lógica de estados y transiciones
 */

import { getMensajeResultado } from '../utils/mensajesResultado.js';

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
  const oponente = partido.pareja_a?.id === identidad.parejaId 
    ? partido.pareja_b?.nombre 
    : partido.pareja_a?.nombre;

  const miNombre = identidad.parejaNombre;
  const gamesAPrevia = partido.games_a;
  const gamesBPrevia = partido.games_b;

  // Determinar qué inputs corresponden a cada pareja
  const soyA = partido.pareja_a?.id === identidad.parejaId;
  
  // Valores iniciales (null si no hay previos)
  const valorInicialA = gamesAPrevia !== null ? gamesAPrevia : '';
  const valorInicialB = gamesBPrevia !== null ? gamesBPrevia : '';

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
          <div class="match-team ${soyA ? 'es-mio' : ''}">
            <div class="team-label">${soyA ? 'Vos' : oponente}</div>
            <div class="team-name">${escapeHtml(soyA ? miNombre : oponente)}</div>
          </div>
          
          <div class="match-vs">vs</div>
          
          <div class="match-team ${!soyA ? 'es-mio' : ''}">
            <div class="team-label">${!soyA ? 'Vos' : oponente}</div>
            <div class="team-name">${escapeHtml(!soyA ? miNombre : oponente)}</div>
          </div>
        </div>

        <div class="score-inputs" id="score-inputs-container">
          <div class="score-group" id="score-group-a">
            <label for="input-games-a">${escapeHtml(soyA ? 'Tus games' : 'Games de ' + oponente)}</label>
            <input 
              type="number" 
              id="input-games-a" 
              class="input-score-modal"
              min="0" 
              max="20"
              value="${valorInicialA}"
              placeholder=""
            />
          </div>
          
          <div class="score-group" id="score-group-b">
            <label for="input-games-b">${escapeHtml(!soyA ? 'Tus games' : 'Games de ' + oponente)}</label>
            <input 
              type="number" 
              id="input-games-b" 
              class="input-score-modal"
              min="0" 
              max="20"
              value="${valorInicialB}"
              placeholder=""
            />
          </div>
        </div>
        
        <div id="mensaje-preview" class="mensaje-preview"></div>

        ${gamesAPrevia !== null ? `
          <div class="helper-info">
            Resultado anterior: ${gamesAPrevia} - ${gamesBPrevia}
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
  
  // Actualizar preview cuando cambien los valores
  const actualizarPreview = () => {
    const inputA = document.getElementById('input-games-a');
    const inputB = document.getElementById('input-games-b');
    const groupA = document.getElementById('score-group-a');
    const groupB = document.getElementById('score-group-b');
    const mensajeDiv = document.getElementById('mensaje-preview');
    
    const gA = parseInt(inputA.value);
    const gB = parseInt(inputB.value);

    // Limpiar clases previas
    groupA.classList.remove('ganador', 'perdedor');
    groupB.classList.remove('ganador', 'perdedor');
    mensajeDiv.innerHTML = '';

    if (isNaN(gA) || isNaN(gB) || gA < 0 || gB < 0) {
      return; // No mostrar nada si no son válidos
    }

    // Obtener mensaje y aplicar colores
    const resultado = getMensajeResultado(gA, gB, soyA);
    
    if (resultado.tipo === 'empate') {
      mensajeDiv.innerHTML = `<div class="mensaje-empate">${resultado.mensaje}</div>`;
      return;
    }

    // Colorear ganador/perdedor
    if (gA > gB) {
      groupA.classList.add('ganador');
      groupB.classList.add('perdedor');
    } else {
      groupB.classList.add('ganador');
      groupA.classList.add('perdedor');
    }

    // Mostrar mensaje
    const clase = resultado.tipo === 'victoria' ? 'mensaje-victoria' : 'mensaje-derrota';
    mensajeDiv.innerHTML = `<div class="${clase}">${resultado.mensaje}</div>`;
  };

  document.getElementById('input-games-a').addEventListener('input', actualizarPreview);
  document.getElementById('input-games-b').addEventListener('input', actualizarPreview);
  
  document.getElementById('modal-submit').addEventListener('click', () => {
    const gA = parseInt(document.getElementById('input-games-a').value);
    const gB = parseInt(document.getElementById('input-games-b').value);

    if (isNaN(gA) || isNaN(gB)) {
      alert('Por favor ingresá ambos resultados.');
      return;
    }

    if (gA < 0 || gB < 0) {
      alert('Los resultados no pueden ser negativos.');
      return;
    }

    if (gA === gB) {
      alert('No se puede empatar en pádel. Revisá el resultado.');
      return;
    }

    onSubmit(gA, gB);
    close();
  });

  // Focus en primer input
  setTimeout(() => {
    document.getElementById('input-games-a')?.focus();
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
