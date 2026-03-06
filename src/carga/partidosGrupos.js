import { state } from './state.js';
import { TORNEO_ID } from './context.js';
import { crearCardEditable } from './cardEditable.js';
import { obtenerFrasesUnicas } from '../utils/frasesFechaLibre.js';
import { formatearResultado, tieneResultado, calcularSetsGanados, calcularGamesTotales } from '../utils/formatoResultado.js';

/** Fire-and-forget: lanza el motor de copas sin bloquear la UI */
function dispararMotorCopas(supabase) {
  supabase.rpc('verificar_y_proponer_copas', { p_torneo_id: TORNEO_ID })
    .then(({ error }) => { if (error) console.warn('Motor copas (carga):', error.message); });
}

/**
 * Guarda resultado como set1 (partido a 1 set) - para uso de admin
 * NOTA: NO escribir directamente a games_totales_* (son derivados calculados por trigger)
 */
async function guardarResultadoComoSet(supabase, partidoId, gamesA, gamesB) {
  const { error } = await supabase
    .from('partidos')
    .update({
      set1_a: gamesA,
      set1_b: gamesB,
      num_sets: 1,
      // Limpiar sets 2 y 3 por si acaso
      set2_a: null,
      set2_b: null,
      set3_a: null,
      set3_b: null
    })
    .eq('id', partidoId);

  if (error) {
    console.error(error);
    alert('Error guardando el resultado');
    return false;
  }
  return true;
}

function aplicarZebraVisible(listCont) {
  const visibles = Array.from(listCont.querySelectorAll('.partido'))
    .filter(c => c.style.display !== 'none');

  visibles.forEach((c, i) => {
    c.classList.toggle('is-even', i % 2 === 0);
    c.classList.toggle('is-odd', i % 2 === 1);
  });
}

export async function cargarPartidosGrupos({ supabase, torneoId, msgCont, listCont, onAfterSave }) {
  msgCont.textContent = 'Cargando partidos…';

  let q = supabase
    .from('partidos')
      .select(`
      id,
      estado,
      cargado_por_pareja_id,
      pareja_a_id,
      pareja_b_id,
      notas_revision,
      ronda,
      set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
      set1_temp_a, set1_temp_b, set2_temp_a, set2_temp_b, set3_temp_a, set3_temp_b,
      sets_a, sets_b,
      games_totales_a, games_totales_b,
      stb_puntos_a, stb_puntos_b,
      grupos ( nombre ),
      pareja_a:parejas!partidos_pareja_a_id_fkey ( nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( nombre )
    `)
    .eq('torneo_id', torneoId)
    .is('copa_id', null);

  if (state.modo === 'pendientes') {
    q = q.is('sets_a', null);
  } else if (state.modo === 'confirmar') {
    q = q.eq('estado', 'a_confirmar');
  } else if (state.modo === 'jugados') {
    q = q.not('sets_a', 'is', null);
  } else if (state.modo === 'disputas') {
    q = q.eq('estado', 'en_revision');
  }

  const { data, error } = await q;

  if (error) {
    console.error(error);
    msgCont.textContent = '❌ Error cargando partidos';
    listCont.innerHTML = '';
    return;
  }

  msgCont.textContent = '';
  renderPartidosGrupos({ partidos: data || [], supabase, onAfterSave, listCont });
}

/**
 * Agrupa partidos por ronda usando el campo `ronda` de la BD.
 */
export function agruparEnRondas(partidos) {
  const rondas = [];

  const porGrupo = {};
  partidos.forEach(p => {
    const grupo = p.grupos?.nombre ?? 'Sin Grupo';
    if (!porGrupo[grupo]) porGrupo[grupo] = [];
    porGrupo[grupo].push(p);
  });

  Object.keys(porGrupo).sort().forEach(nombreGrupo => {
    const partidosGrupo = [...porGrupo[nombreGrupo]];

    const equiposSet = new Set();
    partidosGrupo.forEach(p => {
      if (p.pareja_a?.nombre) equiposSet.add(p.pareja_a.nombre);
      if (p.pareja_b?.nombre) equiposSet.add(p.pareja_b.nombre);
    });
    const equipos = Array.from(equiposSet).sort();

    const partidosPorRonda = {};
    partidosGrupo.forEach(p => {
      const numRonda = p.ronda || 1;
      if (!partidosPorRonda[numRonda]) partidosPorRonda[numRonda] = [];
      partidosPorRonda[numRonda].push(p);
    });

    const numerosRonda = Object.keys(partidosPorRonda).map(Number).sort((a, b) => a - b);

    numerosRonda.forEach(numRonda => {
      const partidosRonda = partidosPorRonda[numRonda];
      const parejasEnUso = new Set();

      partidosRonda.forEach(p => {
        if (p.pareja_a?.nombre) parejasEnUso.add(p.pareja_a.nombre);
        if (p.pareja_b?.nombre) parejasEnUso.add(p.pareja_b.nombre);
      });

      const parejasLibres = equipos
        .filter(e => !parejasEnUso.has(e))
        .sort();

      rondas.push({
        grupo: nombreGrupo,
        ronda: numRonda,
        partidos: partidosRonda,
        parejasLibres: parejasLibres
      });
    });
  });

  return rondas;
}

function renderPartidosGrupos({ partidos, supabase, onAfterSave, listCont }) {
  listCont.innerHTML = '';

  // Modo confirmar: render dedicado
  if (state.modo === 'confirmar') {
    if (partidos.length === 0) {
      const msg = document.createElement('p');
      msg.textContent = 'No hay partidos pendientes de confirmación';
      listCont.appendChild(msg);
      return;
    }
    partidos.forEach(p => {
      const headerLeft = `Grupo <strong>${p.grupos?.nombre ?? '-'}</strong>`;
      const card = crearCardConfirmacion(p, supabase, onAfterSave, { headerLeft, copasId: null });
      listCont.appendChild(card);
    });
    aplicarZebraVisible(listCont);
    return;
  }

  // En modo 'disputas', no separar en revisión (ya están todos en revisión)
  let enRevision = [];
  let partidosNormales = partidos;

  if (state.modo !== 'disputas') {
    enRevision = partidos.filter(p => p.estado === 'en_revision');
    partidosNormales = partidos.filter(p => p.estado !== 'en_revision');
  }

  // Sección de partidos en revisión (solo si NO estamos en modo disputas)
  if (enRevision.length > 0 && state.modo !== 'disputas') {
    const seccionRevision = document.createElement('div');
    seccionRevision.style.cssText = 'margin-bottom: 32px; padding: 16px; background: rgba(239, 68, 68, 0.08); border: 2px solid rgba(239, 68, 68, 0.3); border-radius: 14px;';

    const titulo = document.createElement('h3');
    titulo.style.cssText = 'margin: 0 0 12px 0; font-size: 18px; color: #991B1B;';
    titulo.textContent = `⚠️ Partidos en revisión (${enRevision.length})`;
    seccionRevision.appendChild(titulo);

    const descripcion = document.createElement('p');
    descripcion.style.cssText = 'margin: 0 0 16px 0; font-size: 14px; color: var(--muted);';
    descripcion.textContent = 'Hay diferencias en los resultados cargados. Revisá y resolvé los conflictos.';
    seccionRevision.appendChild(descripcion);

    enRevision.forEach(p => {
      const card = crearCardRevision(p, supabase, onAfterSave);
      seccionRevision.appendChild(card);
    });

    listCont.appendChild(seccionRevision);
  }

  if (partidosNormales.length === 0 && enRevision.length === 0) {
    const msg = document.createElement('p');
    if (state.modo === 'pendientes') {
      msg.textContent = 'No hay partidos pendientes 🎉';
    } else if (state.modo === 'jugados') {
      msg.textContent = 'No hay partidos jugados todavía.';
    } else if (state.modo === 'disputas') {
      msg.textContent = 'No hay partidos en disputa 👍';
    }
    listCont.appendChild(msg);
    return;
  }

  // Si estamos en modo disputas, todos los partidos son de revisión
  if (state.modo === 'disputas') {
    partidos.forEach(p => {
      const card = crearCardRevision(p, supabase, onAfterSave);
      listCont.appendChild(card);
    });
    aplicarZebraVisible(listCont);
    return;
  }

  // En modo jugados, ordenar: primero a_confirmar, luego confirmados
  if (state.modo === 'jugados') {
    partidosNormales.sort((a, b) => {
      const estadoA = a.estado || 'pendiente';
      const estadoB = b.estado || 'pendiente';
      if (estadoA === 'a_confirmar' && estadoB !== 'a_confirmar') return -1;
      if (estadoB === 'a_confirmar' && estadoA !== 'a_confirmar') return 1;
      return 0;
    });
  }

  // Agrupar en rondas si es modo pendientes
  if (state.modo === 'pendientes') {
    const rondas = agruparEnRondas(partidosNormales);

    const totalParejasLibres = rondas.reduce((sum, r) => sum + r.parejasLibres.length, 0);
    const frases = obtenerFrasesUnicas(totalParejasLibres);
    let fraseIndex = 0;

    rondas.forEach((rondaData) => {
      const separator = document.createElement('div');
      separator.style.cssText = 'margin: 24px 0 8px; padding: 8px 12px; background: var(--primary-soft); border-left: 4px solid var(--primary); border-radius: 8px; font-weight: 700; font-size: 14px; color: var(--text);';
      separator.textContent = `Ronda ${rondaData.ronda} — Grupo ${rondaData.grupo} — ${rondaData.partidos.length} partido${rondaData.partidos.length > 1 ? 's' : ''} en paralelo`;
      listCont.appendChild(separator);

      rondaData.partidos.forEach((p) => {
        const card = crearCardParaPartido(p, supabase, onAfterSave);
        listCont.appendChild(card);
      });

      if (rondaData.parejasLibres.length > 0) {
        rondaData.parejasLibres.forEach(parejaLibre => {
          const cardLibre = document.createElement('div');
          cardLibre.className = 'partido fecha-libre';
          cardLibre.style.cssText = 'padding: 12px; margin: 8px 0; background: var(--bg-soft); border: 1px dashed var(--border); border-radius: 8px; opacity: 0.7;';
          cardLibre.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-weight: 600;">${parejaLibre}</div>
              <div style="color: var(--muted); font-style: italic;">${frases[fraseIndex++]}</div>
            </div>
          `;
          listCont.appendChild(cardLibre);
        });
      }
    });
  } else {
    // Modo jugados: orden normal
    partidosNormales.forEach((p) => {
      const card = crearCardParaPartido(p, supabase, onAfterSave);
      listCont.appendChild(card);
    });
  }

  aplicarZebraVisible(listCont);
}

function crearCardParaPartido(p, supabase, onAfterSave) {
  const grupo = p.grupos?.nombre ?? '-';
  const a = p.pareja_a?.nombre ?? 'Pareja A';
  const b = p.pareja_b?.nombre ?? 'Pareja B';

  const estado = p.estado || 'pendiente';
  let estadoDisplay = 'Pendiente';
  if (estado === 'a_confirmar') estadoDisplay = '🟡 A confirmar';
  if (estado === 'confirmado') estadoDisplay = '✅ Confirmado';
  if (tieneResultado(p) && estado === 'pendiente') estadoDisplay = 'Jugado';

  const gamesA = p.set1_a;
  const gamesB = p.set1_b;

  const card = crearCardEditable({
    headerLeft: `Grupo <strong>${grupo}</strong>`,
    headerRight: estadoDisplay,
    nombreA: a,
    nombreB: b,
    gamesA: gamesA,
    gamesB: gamesB,
    onSave: async (ga, gb) => {
      const { error } = await supabase
        .from('partidos')
        .update({
          set1_a: ga,
          set1_b: gb,
          num_sets: 1,
          set2_a: null,
          set2_b: null,
          set3_a: null,
          set3_b: null,
          estado: 'confirmado',
          set1_temp_a: null,
          set1_temp_b: null,
          set2_temp_a: null,
          set2_temp_b: null,
          set3_temp_a: null,
          set3_temp_b: null,
          cargado_por_pareja_id: null
        })
        .eq('id', p.id);

      if (error) {
        console.error(error);
        alert('Error guardando el resultado');
        return false;
      }

      dispararMotorCopas(supabase);
      if (onAfterSave) await onAfterSave();
      return true;
    }
  });

  card.dataset.search = `${grupo} ${a} ${b}`;

  return card;
}

/**
 * Card de solo lectura para partidos en estado 'a_confirmar'.
 * Reutiliza crearCardEditable para el flujo de edición.
 * Exportada para reutilizarla en copas.js.
 */
export function crearCardConfirmacion(partido, supabase, onUpdate, { headerLeft, copasId = null } = {}) {
  const p = partido;
  const nombreA = p.pareja_a?.nombre ?? 'Pareja A';
  const nombreB = p.pareja_b?.nombre ?? 'Pareja B';

  // Determinar quién cargó
  const cargadoPor = p.cargado_por_pareja_id === p.pareja_a_id
    ? nombreA
    : p.cargado_por_pareja_id === p.pareja_b_id
      ? nombreB
      : '?';

  // Ganador siempre arriba
  const aWins = (p.sets_a ?? 0) > (p.sets_b ?? 0);
  const topNombre = aWins ? nombreA : nombreB;
  const topScore  = aWins ? (p.set1_a ?? '-') : (p.set1_b ?? '-');
  const botNombre = aWins ? nombreB : nombreA;
  const botScore  = aWins ? (p.set1_b ?? '-') : (p.set1_a ?? '-');

  const card = document.createElement('div');
  card.className = 'partido card-confirmar';
  card.dataset.search = `${headerLeft.replace(/<[^>]*>/g, '')} ${nombreA} ${nombreB}`;

  card.innerHTML = `
    <div class="card-header">
      <div class="card-header-left">${headerLeft}</div>
      <div class="card-header-right status-confirmar">⏳ A confirmar</div>
    </div>

    <div class="row row-top is-winner">
      <strong class="team-name is-winner">${topNombre}</strong>
      <span class="score-display">${topScore}</span>
    </div>
    <div class="row row-bot">
      <strong class="team-name">${botNombre}</strong>
      <span class="score-display score-loser">${botScore}</span>
    </div>

    <div class="cargado-por">Cargado por: ${cargadoPor}</div>

    <div class="confirmar-actions">
      <button type="button" class="btn-primary btn-confirmar-card" style="min-height:44px">✅ Confirmar</button>
      <button type="button" class="btn-secondary btn-editar-card" style="min-height:44px">✏️ Editar</button>
    </div>
  `;

  // --- Acción: Confirmar (optimistic UI) ---
  card.querySelector('.btn-confirmar-card').addEventListener('click', async () => {
    // Optimistic: sacar la card del DOM inmediatamente
    card.remove();

    const { error } = await supabase
      .from('partidos')
      .update({ estado: 'confirmado' })
      .eq('id', p.id);

    if (error) {
      console.error(error);
      // Rollback: reinsertar la card
      alert('Error al confirmar. Recargá la página.');
      // No se puede reinsertar fácilmente sin referencia al contenedor, así que recargamos
      if (onUpdate) await onUpdate();
      return;
    }

    // Fire-and-forget para copas
    if (copasId) {
      supabase.rpc('avanzar_ronda_copa', { p_copa_id: copasId })
        .then(({ error: e }) => { if (e) console.warn('Avanzar ronda copa:', e.message); });
    }

    if (onUpdate) await onUpdate();
  });

  // --- Acción: Editar (reemplazar card por crearCardEditable) ---
  card.querySelector('.btn-editar-card').addEventListener('click', () => {
    const cardEdit = crearCardEditable({
      headerLeft,
      headerRight: '✏️ Editando',
      nombreA,
      nombreB,
      gamesA: p.set1_a,
      gamesB: p.set1_b,
      onSave: async (ga, gb) => {
        const { error } = await supabase
          .from('partidos')
          .update({
            set1_a: ga,
            set1_b: gb,
            num_sets: 1,
            set2_a: null,
            set2_b: null,
            set3_a: null,
            set3_b: null,
            estado: 'confirmado',
            set1_temp_a: null,
            set1_temp_b: null,
            set2_temp_a: null,
            set2_temp_b: null,
            set3_temp_a: null,
            set3_temp_b: null,
            cargado_por_pareja_id: null
          })
          .eq('id', p.id);

        if (error) {
          console.error(error);
          alert('Error guardando el resultado');
          return false;
        }

        if (copasId) {
          supabase.rpc('avanzar_ronda_copa', { p_copa_id: copasId })
            .then(({ error: e }) => { if (e) console.warn('Avanzar ronda copa:', e.message); });
        }

        if (onUpdate) await onUpdate();
        return true;
      }
    });

    // Mensaje en vivo de ganador debajo de las filas de inputs
    const winnerMsg = document.createElement('div');
    winnerMsg.className = 'live-winner-msg';
    const actionsRow = cardEdit.querySelector('.actions-row');
    cardEdit.insertBefore(winnerMsg, actionsRow);

    const inputA = cardEdit.querySelector('.input-a');
    const inputB = cardEdit.querySelector('.input-b');

    function actualizarWinnerMsg() {
      const ga = Number(inputA.value);
      const gb = Number(inputB.value);
      if (!inputA.value || !inputB.value || isNaN(ga) || isNaN(gb) || ga === gb) {
        winnerMsg.textContent = '';
        return;
      }
      winnerMsg.textContent = `🏆 Ganó ${ga > gb ? nombreA : nombreB}`;
    }

    inputA.addEventListener('input', actualizarWinnerMsg);
    inputB.addEventListener('input', actualizarWinnerMsg);
    actualizarWinnerMsg();

    card.replaceWith(cardEdit);
  });

  return card;
}

/**
 * Crea card especial para partidos en revisión (admin)
 */
function crearCardRevision(p, supabase, onAfterSave) {
  const grupo = p.grupos?.nombre ?? '-';
  const a = p.pareja_a?.nombre ?? 'Pareja A';
  const b = p.pareja_b?.nombre ?? 'Pareja B';

  const card = document.createElement('div');
  card.className = 'partido partido-revision-admin';
  card.style.cssText = 'background: var(--card); border: 2px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 16px; margin-bottom: 12px;';

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
      <div style="font-weight: 700; font-size: 14px;">Grupo <strong>${grupo}</strong></div>
      <div style="font-size: 12px; color: #991B1B; font-weight: 800;">🔴 EN REVISIÓN</div>
    </div>

    <div style="margin-bottom: 12px;">
      <div style="font-weight: 700; font-size: 16px; margin-bottom: 8px;">${a} vs ${b}</div>
    </div>

    <div style="display: flex; gap: 16px; margin-bottom: 16px; padding: 14px; background: rgba(15, 23, 42, 0.03); border-radius: 10px;">
      <div style="flex: 1; text-align: center; padding: 10px; background: var(--card); border: 2px solid var(--border); border-radius: 8px;">
        <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px; font-weight: 700;">PRIMERA CARGA</div>
        <div style="font-size: 22px; font-weight: 900;" class="resultado-display" data-partido-id="${p.id}">${formatearResultado(p)}</div>
      </div>

      <div style="display: flex; align-items: center; font-weight: 800; color: var(--muted);">vs</div>

      <div style="flex: 1; text-align: center; padding: 10px; background: var(--card); border: 2px solid var(--border); border-radius: 8px;">
        <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px; font-weight: 700;">SEGUNDA CARGA</div>
        <div style="font-size: 22px; font-weight: 900;">${(() => {
          const tempPartido = { ...p, set1_a: p.set1_temp_a, set1_b: p.set1_temp_b, set2_a: p.set2_temp_a, set2_b: p.set2_temp_b, set3_a: p.set3_temp_a, set3_b: p.set3_temp_b };
          return formatearResultado(tempPartido);
        })()}</div>
      </div>
    </div>

    ${p.notas_revision ? `
      <div style="padding: 10px; background: rgba(245, 158, 11, 0.1); border-left: 3px solid var(--warning); border-radius: 8px; margin-bottom: 12px; font-size: 13px;">
        <strong>Nota:</strong> ${p.notas_revision}
      </div>
    ` : ''}

    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button class="btn-primary" style="flex: 1;" data-action="aceptar-1">
        ✅ Aceptar primera carga
      </button>
      <button class="btn-primary" style="flex: 1;" data-action="aceptar-2">
        ✅ Aceptar segunda carga
      </button>
      <button class="btn-secondary" style="flex: 1;" data-action="manual">
        ✏️ Ingresar resultado correcto
      </button>
    </div>
  `;

  card.querySelector('[data-action="aceptar-1"]').addEventListener('click', async () => {
    const resTexto = formatearResultado(p);
    if (!confirm(`¿Aceptar resultado ${resTexto}?`)) return;

    const updateData = {
      estado: 'confirmado',
      set1_temp_a: null,
      set1_temp_b: null,
      set2_temp_a: null,
      set2_temp_b: null,
      set3_temp_a: null,
      set3_temp_b: null,
      notas_revision: null
    };

    const { error } = await supabase
      .from('partidos')
      .update(updateData)
      .eq('id', p.id);

    if (error) {
      console.error(error);
      alert('Error guardando');
      return;
    }

    dispararMotorCopas(supabase);
    alert('✅ Conflicto resuelto');
    if (onAfterSave) await onAfterSave();
  });

  card.querySelector('[data-action="aceptar-2"]').addEventListener('click', async () => {
    const tempPartido = { ...p, set1_a: p.set1_temp_a, set1_b: p.set1_temp_b, set2_a: p.set2_temp_a, set2_b: p.set2_temp_b, set3_a: p.set3_temp_a, set3_b: p.set3_temp_b };
    const resTexto = formatearResultado(tempPartido);
    if (!confirm(`¿Aceptar resultado ${resTexto}?`)) return;

    const updateData = {
      set1_a: p.set1_temp_a,
      set1_b: p.set1_temp_b,
      set2_a: p.set2_temp_a,
      set2_b: p.set2_temp_b,
      estado: 'confirmado',
      set1_temp_a: null,
      set1_temp_b: null,
      set2_temp_a: null,
      set2_temp_b: null,
      set3_temp_a: null,
      set3_temp_b: null,
      notas_revision: null
    };

    if (p.set3_temp_a !== null && p.set3_temp_b !== null) {
      updateData.set3_a = p.set3_temp_a;
      updateData.set3_b = p.set3_temp_b;
    }

    const { error } = await supabase
      .from('partidos')
      .update(updateData)
      .eq('id', p.id);

    if (error) {
      console.error(error);
      alert('Error guardando');
      return;
    }

    dispararMotorCopas(supabase);
    alert('✅ Conflicto resuelto');
    if (onAfterSave) await onAfterSave();
  });

  card.querySelector('[data-action="manual"]').addEventListener('click', () => {
    const gA = prompt('Ingresá games de ' + a + ':', p.set1_a);
    const gB = prompt('Ingresá games de ' + b + ':', p.set1_b);

    if (gA === null || gB === null) return;

    const gamesA = parseInt(gA);
    const gamesB = parseInt(gB);

    if (isNaN(gamesA) || isNaN(gamesB)) {
      alert('Valores inválidos');
      return;
    }

    supabase
      .from('partidos')
      .update({
        set1_a: gamesA,
        set1_b: gamesB,
        num_sets: 1,
        set2_a: null,
        set2_b: null,
        set3_a: null,
        set3_b: null,
        estado: 'confirmado',
        set1_temp_a: null,
        set1_temp_b: null,
        set2_temp_a: null,
        set2_temp_b: null,
        set3_temp_a: null,
        set3_temp_b: null,
        notas_revision: null
      })
      .eq('id', p.id)
      .then(({ error }) => {
        if (error) {
          console.error(error);
          alert('Error guardando');
          return;
        }
        dispararMotorCopas(supabase);
        alert('✅ Resultado guardado');
        if (onAfterSave) onAfterSave();
      });
  });

  card.dataset.search = `${grupo} ${a} ${b}`;

  return card;
}
