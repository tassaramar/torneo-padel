/**
 * Funciones de render puras para la vista de consulta (general.html).
 * Extraídas de modalConsulta.js — usan un objeto state en lugar de modalState interno.
 *
 * State shape:
 * {
 *   activeTab: 'grupos' | 'copas' | 'fixture',
 *   activeSubTab: null | grupoId | 'general',
 *   cache: null | { grupos, partidos, parejas, copas, partidosCopa, standings, formatoSets },
 *   identidad: null | { parejaId, parejaNombre, miNombre, companero, grupo, orden },
 *   supabase: ref,
 *   torneoId: string
 * }
 */

import {
  calcularTablaGrupo as calcularTablaGrupoCentral,
  ordenarConOverrides,
  detectarEmpatesReales,
  detectarH2H,
  cargarOverrides,
  agregarMetadataOverrides,
  enriquecerConPosiciones
} from '../utils/tablaPosiciones.js';
import { tieneResultado, formatearResultado, determinarGanadorParaPareja, invertirScoresPartido } from '../utils/formatoResultado.js';
import { calcularColaSugerida, crearMapaPosiciones } from '../utils/colaFixture.js';
import { normalizarPartidosParaBracket, renderBracket } from '../utils/bracketRenderer.js';

/**
 * Carga todos los datos necesarios para la vista de consulta.
 * Retorna el objeto cache (standings = null para carga lazy).
 */
export async function cargarDatosConsulta(supabase, torneoId) {
  const [gruposRes, partidosRes, parejasRes, copasRes, partidosCopaRes, torneoRes] = await Promise.all([
    supabase
      .from('grupos')
      .select('id, nombre')
      .eq('torneo_id', torneoId)
      .order('nombre'),
    supabase
      .from('partidos')
      .select(`
        id, estado, ronda, updated_at,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
        grupo_id,
        pareja_a_id, pareja_b_id,
        grupos ( id, nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('torneo_id', torneoId)
      .is('copa_id', null),
    supabase
      .from('parejas')
      .select('id, nombre, orden')
      .eq('torneo_id', torneoId)
      .order('orden'),
    supabase
      .from('copas')
      .select('id, nombre')
      .eq('torneo_id', torneoId),
    supabase
      .from('partidos')
      .select(`
        id, copa_id, ronda_copa, orden_copa, estado,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        sets_a, sets_b, games_totales_a, games_totales_b,
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('torneo_id', torneoId)
      .not('copa_id', 'is', null),
    supabase
      .from('torneos')
      .select('formato_sets')
      .eq('id', torneoId)
      .single()
  ]);

  if (gruposRes.error) throw gruposRes.error;
  if (partidosRes.error) throw partidosRes.error;
  if (parejasRes.error) throw parejasRes.error;

  const formatoSets = torneoRes.data?.formato_sets ?? 1;

  return {
    grupos: gruposRes.data || [],
    partidos: partidosRes.data || [],
    parejas: parejasRes.data || [],
    copas: copasRes.data || [],
    partidosCopa: partidosCopaRes.data || [],
    standings: null,  // carga lazy en renderTablaGeneral
    formatoSets
  };
}

/**
 * Renderiza los tabs principales (Grupos / Copas / Fixture).
 * onTabChange(tabId) se llama cuando el usuario elige un tab.
 */
export function renderTabs(container, state, onTabChange) {
  const { cache, activeTab } = state;
  const hayCopas = cache &&
    cache.copas && cache.copas.length > 0 &&
    cache.partidosCopa && cache.partidosCopa.length > 0;

  const tabs = [
    { id: 'grupos', label: 'Grupos' },
    ...(hayCopas ? [{ id: 'copas', label: 'Copas' }] : []),
    { id: 'fixture', label: 'Fixture' }
  ];

  container.innerHTML = tabs.map(tab => `
    <button
      type="button"
      class="modal-tab ${activeTab === tab.id ? 'active' : ''}"
      data-tab="${tab.id}"
    >${tab.label}</button>
  `).join('');

  container.querySelectorAll('.modal-tab').forEach(btn => {
    btn.addEventListener('click', () => onTabChange(btn.dataset.tab));
  });
}

// ─── Tab GRUPOS ────────────────────────────────────────────────────────────────

/**
 * Renderiza el tab "Grupos" con sub-tabs por grupo + "General"
 */
export async function renderGrupos(container, state) {
  const { cache, identidad } = state;
  if (!cache) {
    container.innerHTML = '<p class="modal-empty">Cargando...</p>';
    return;
  }

  const grupos = cache.grupos || [];
  if (grupos.length === 0) {
    container.innerHTML = '<p class="modal-empty">No hay grupos</p>';
    return;
  }

  // Determinar sub-tab por defecto: grupo del jugador o primer grupo
  if (!state.activeSubTab) {
    const miGrupo = identidad?.grupo
      ? grupos.find(g => g.nombre === identidad.grupo)
      : null;
    state.activeSubTab = miGrupo?.id || grupos[0].id;
  }

  // Sub-tabs: uno por grupo + "General" al final
  const subTabs = [
    ...grupos.map(g => ({ id: g.id, label: `Grupo ${g.nombre}` })),
    { id: 'general', label: 'General' }
  ];

  // Si el wrapper ya existe (polling refresh), solo actualizar contenido sin rebuild
  if (container.querySelector('.modal-grupos-wrapper')) {
    await renderSubTabGrupos(container, state);
    return;
  }

  let html = '<div class="modal-grupos-wrapper">';
  html += '<div class="modal-sub-tabs">';
  subTabs.forEach(tab => {
    const isActive = state.activeSubTab === tab.id;
    html += `<button type="button" class="modal-sub-tab ${isActive ? 'active' : ''}" data-sub-tab="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`;
  });
  html += '</div>';
  html += '<div id="modal-grupos-content"></div>';
  html += '</div>';

  container.innerHTML = html;

  // Wire sub-tab events
  container.querySelectorAll('.modal-sub-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.activeSubTab = btn.dataset.subTab;
      await renderSubTabGrupos(container, state);
    });
  });

  await renderSubTabGrupos(container, state);
}

/**
 * Actualiza la selección visual de sub-tabs y renderiza el contenido activo
 */
export async function renderSubTabGrupos(container, state) {
  // Sincronizar estado visual
  container.querySelectorAll('.modal-sub-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.subTab === state.activeSubTab);
  });

  const content = container.querySelector('#modal-grupos-content');
  if (!content) return;

  if (state.activeSubTab === 'general') {
    await renderTablaGeneral(content, state);
  } else {
    await renderGrupoDetalle(content, state, state.activeSubTab);
  }
}

/**
 * Renderiza tabla de posiciones + partidos de un grupo específico
 */
export async function renderGrupoDetalle(container, state, grupoId) {
  const { cache, identidad, supabase, torneoId } = state;
  if (!cache) {
    container.innerHTML = '<p class="modal-empty">Cargando...</p>';
    return;
  }

  const grupo = cache.grupos.find(g => g.id === grupoId);
  if (!grupo) {
    container.innerHTML = '<p class="modal-empty">Grupo no encontrado</p>';
    return;
  }

  const partidosDelGrupo = cache.partidos.filter(p => p.grupos?.id === grupoId);
  const tablaBase = calcularTablaGrupoCentral(partidosDelGrupo);
  const overridesMap = await cargarOverrides(supabase, torneoId, grupoId);
  const tablaOrdenada = ordenarConOverrides(tablaBase, overridesMap, partidosDelGrupo);
  const { tieGroups } = detectarEmpatesReales(tablaOrdenada, partidosDelGrupo, overridesMap);
  const h2hWinners = detectarH2H(tablaOrdenada, partidosDelGrupo);
  const tablaConMetadata = agregarMetadataOverrides(tablaOrdenada, overridesMap);

  // No pintar empates si no hay partidos jugados en el grupo
  const hayPartidosJugados = partidosDelGrupo.some(p => tieneResultado(p));
  const tieColorMap = {};
  if (hayPartidosJugados && tieGroups) {
    tieGroups.forEach(group => {
      group.parejaIds.forEach(parejaId => {
        tieColorMap[parejaId] = group.color;
      });
    });
  }

  const colaGlobal = calcularColaSugerida(cache.partidos || [], cache.grupos || []);
  const mapaPosiciones = crearMapaPosiciones(colaGlobal);

  const jugados = partidosDelGrupo.filter(p => tieneResultado(p)).length;
  const total = partidosDelGrupo.length;
  const mostrarSets = (cache.formatoSets ?? 1) > 1;

  let html = `
    <div class="modal-section">
      <p class="modal-meta">Partidos: ${jugados}/${total}</p>

      <div class="tabla-posiciones">
        <table class="tabla-grupo">
          <thead>
            <tr>
              <th class="pos-col">#</th>
              <th class="nombre-col">Pareja</th>
              <th class="stat-col">PJ</th>
              ${mostrarSets ? `
              <th class="stat-col">SF</th>
              <th class="stat-col">SC</th>
              <th class="stat-col">DS</th>
              ` : ''}
              <th class="stat-col">GF</th>
              <th class="stat-col">GC</th>
              <th class="stat-col">DG</th>
              <th class="pts-col">Pts</th>
            </tr>
          </thead>
          <tbody>
            ${tablaConMetadata.map((row, idx) => {
              const esMiPareja = identidad && row.pareja_id === identidad.parejaId;
              const tieColor = tieColorMap[row.pareja_id];
              const styleEmpate = tieColor ? `background: ${tieColor.bg}; border-left: 4px solid ${tieColor.border};` : '';

              return `
                <tr class="${esMiPareja ? 'mi-pareja' : ''}" style="${styleEmpate}">
                  <td class="pos-col">${idx + 1}</td>
                  <td class="nombre-col">${escapeHtml(row.nombre)}${
                    row.tieneOverrideAplicado
                      ? `<sup style="font-size:10px; color:#0b7285; font-weight:700; margin-left:2px;">🎲${row.ordenManual}</sup>`
                      : h2hWinners.has(row.pareja_id)
                        ? '<sup style="font-size:9px; color:#2563eb; font-weight:700; margin-left:2px;">H2H</sup>'
                        : ''
                  }</td>
                  <td class="stat-col">${row.PJ}</td>
                  ${mostrarSets ? `
                  <td class="stat-col">${row.SF}</td>
                  <td class="stat-col">${row.SC}</td>
                  <td class="stat-col">${row.DS}</td>
                  ` : ''}
                  <td class="stat-col">${row.GF}</td>
                  <td class="stat-col">${row.GC}</td>
                  <td class="stat-col">${row.DG}</td>
                  <td class="pts-col">${row.P}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${(() => {
        const parts = [];
        if (tablaConMetadata.some(r => r.tieneOverrideAplicado)) parts.push('🎲 = Posición definida por sorteo');
        if (h2hWinners.size > 0) parts.push('<span style="color:#2563eb;">H2H</span> = Desempate por enfrentamiento directo');
        return parts.length ? `<div style="margin-top:6px; font-size:11px; color:#666;">${parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</div>` : '';
      })()}

      ${(() => {
        const pendientes = partidosDelGrupo.filter(p => !tieneResultado(p));
        const jugadosList = partidosDelGrupo.filter(p => tieneResultado(p));

        // Pendientes ordenados por posición global del fixture
        pendientes.sort((a, b) => (mapaPosiciones?.get(a.id) ?? 999) - (mapaPosiciones?.get(b.id) ?? 999));
        // Jugados ordenados por updated_at más reciente primero
        jugadosList.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

        let seccionesHtml = '';
        if (pendientes.length > 0) {
          seccionesHtml += `
            <details class="modal-details" open>
              <summary>Partidos pendientes (${pendientes.length})</summary>
              <div class="modal-partidos-list">
                ${renderPartidosGrupo(pendientes, identidad, mapaPosiciones)}
              </div>
            </details>`;
        }
        if (jugadosList.length > 0) {
          seccionesHtml += `
            <details class="modal-details" open>
              <summary>Partidos jugados (${jugadosList.length})</summary>
              <div class="modal-partidos-list">
                ${renderPartidosGrupo(jugadosList, identidad, mapaPosiciones)}
              </div>
            </details>`;
        }
        return seccionesHtml;
      })()}
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Renderiza la tabla general cross-grupos usando el RPC obtener_standings_torneo
 */
export async function renderTablaGeneral(container, state) {
  const { cache, identidad, supabase, torneoId } = state;

  // Carga lazy de standings
  if (cache && !cache.standings) {
    container.innerHTML = '<p class="modal-empty">Cargando tabla general...</p>';
    try {
      const res = await supabase.rpc('obtener_standings_torneo', { p_torneo_id: torneoId });
      if (res.error) throw res.error;

      const parejasMap = Object.fromEntries((cache.parejas || []).map(p => [p.id, p.nombre]));
      const gruposMap = Object.fromEntries((cache.grupos || []).map(g => [g.id, g.nombre]));

      let standings = (res.data || []).map(s => ({
        ...s,
        parejaNombre: parejasMap[s.pareja_id] || '—',
        nombre: parejasMap[s.pareja_id] || '—',
        grupoNombre: gruposMap[s.grupo_id] || '—'
      }));

      // Calcular posicion_en_grupo client-side usando partidos del cache
      const partidosGrupo = (cache.partidos || []).filter(p => !p.copa_id && p.sets_a != null);
      standings = enriquecerConPosiciones(standings, partidosGrupo);

      // Enriquecer con stats completas (PJ, SF, SC, GC, DG) desde partidos del cache
      const statsMap = {};
      for (const grupo of cache.grupos) {
        const partidosDelGrupo = cache.partidos.filter(p => p.grupos?.id === grupo.id);
        const tabla = calcularTablaGrupoCentral(partidosDelGrupo);
        for (const row of tabla) {
          statsMap[row.pareja_id] = row;
        }
      }
      for (const s of standings) {
        const st = statsMap[s.pareja_id];
        if (st) {
          s.PJ = st.PJ; s.SF = st.SF; s.SC = st.SC;
          s.GC = st.GC; s.DG = st.DG;
        }
      }

      cache.standings = standings;
    } catch (e) {
      console.error('Error cargando standings:', e);
      container.innerHTML = '<p class="modal-empty">Error cargando tabla general</p>';
      return;
    }
  }

  const enriched = cache?.standings || [];

  if (enriched.length === 0) {
    container.innerHTML = '<p class="modal-empty">No hay datos de tabla general disponibles</p>';
    return;
  }

  // Ordenar: posicion_en_grupo ASC → puntos DESC → ds DESC → dg DESC → gf DESC → sorteo_inter ASC → nombre
  enriched.sort((a, b) =>
    (a.posicion_en_grupo ?? 999) - (b.posicion_en_grupo ?? 999) ||
    b.puntos - a.puntos ||
    b.ds - a.ds ||
    (b.dg || 0) - (a.dg || 0) ||
    b.gf - a.gf ||
    (a.sorteo_inter || 0) - (b.sorteo_inter || 0) ||
    a.parejaNombre.localeCompare(b.parejaNombre)
  );

  const gruposMap = Object.fromEntries((cache.grupos || []).map(g => [g.id, g.nombre]));
  const gruposIncompletos = [...new Set(
    enriched.filter(s => !s.grupo_completo).map(s => `Grupo ${gruposMap[s.grupo_id] || '?'}`)
  )];

  let html = '<div class="modal-section">';

  if (gruposIncompletos.length > 0) {
    html += `<p class="modal-aviso-provisional">⚠️ Tabla provisional — quedan partidos en ${escapeHtml(gruposIncompletos.join(', '))}</p>`;
  }

  const mostrarSets = (cache.formatoSets ?? 1) > 1;
  const colCount = mostrarSets ? 10 : 7;

  html += '<div class="tabla-general-scroll">';
  html += '<table class="tabla-grupo">';
  html += `<thead><tr>
    <th class="pos-col">#</th>
    <th class="nombre-col">Pareja</th>
    <th class="stat-col">Gr</th>
    <th class="stat-col">PJ</th>
    ${mostrarSets ? `
    <th class="stat-col">SF</th>
    <th class="stat-col">SC</th>
    <th class="stat-col">DS</th>
    ` : ''}
    <th class="stat-col">GF</th>
    <th class="stat-col">GC</th>
    <th class="stat-col">DG</th>
    <th class="pts-col">Pts</th>
  </tr></thead>`;
  html += '<tbody>';

  let prevPosicion = null;
  enriched.forEach((row, idx) => {
    const esMiPareja = identidad && row.pareja_id === identidad.parejaId;
    const isNewBlock = prevPosicion !== null && row.posicion_en_grupo !== prevPosicion;

    if (isNewBlock) {
      html += `<tr class="tabla-general-separador"><td colspan="${colCount}"></td></tr>`;
    }

    html += `<tr class="${esMiPareja ? 'mi-pareja' : ''}">
      <td class="pos-col">${idx + 1}</td>
      <td class="nombre-col">${escapeHtml(row.parejaNombre)}${
        row.sorteo_inter
          ? `<sup style="font-size:10px; color:#8b5cf6; font-weight:700; margin-left:2px;">🎲${row.sorteo_inter}</sup>`
          : ''
      }</td>
      <td class="stat-col">${escapeHtml(row.grupoNombre)}</td>
      <td class="stat-col">${row.PJ ?? 0}</td>
      ${mostrarSets ? `
      <td class="stat-col">${row.SF ?? 0}</td>
      <td class="stat-col">${row.SC ?? 0}</td>
      <td class="stat-col">${row.ds}</td>
      ` : ''}
      <td class="stat-col">${row.gf}</td>
      <td class="stat-col">${row.GC ?? 0}</td>
      <td class="stat-col">${row.DG ?? 0}</td>
      <td class="pts-col">${row.puntos}</td>
    </tr>`;

    prevPosicion = row.posicion_en_grupo;
  });

  html += '</tbody></table>';
  const haySorteoInter = enriched.some(r => r.sorteo_inter);
  if (haySorteoInter) {
    html += '<div style="margin-top:6px; font-size:11px; color:#666;">🎲 = Posición definida por sorteo</div>';
  }
  html += '</div></div>';
  container.innerHTML = html;
}

// ─── Tab COPAS ─────────────────────────────────────────────────────────────────

const RONDA_COPA_LABEL = { SF: 'Semifinal', F: 'Final', '3P': '3° Puesto', direct: 'Cruce' };
const RONDA_COPA_SORT_ORDER = { direct: 0, SF: 1, F: 2, '3P': 3 };

/**
 * Renderiza el tab "Copas" — bracket gráfico por copa
 */
export function renderCopas(container, state) {
  const { cache, identidad } = state;
  if (!cache) {
    container.innerHTML = '<p class="modal-empty">Cargando...</p>';
    return;
  }

  const { copas, partidosCopa } = cache;
  if (!copas || copas.length === 0 || !partidosCopa || partidosCopa.length === 0) {
    container.innerHTML = '<p class="modal-empty">No hay copas activas</p>';
    return;
  }

  // Agrupar partidos por copa
  const copasPorId = {};
  copas.forEach(c => { copasPorId[c.id] = { copa: c, partidos: [] }; });
  partidosCopa.forEach(p => {
    if (copasPorId[p.copa_id]) copasPorId[p.copa_id].partidos.push(p);
  });

  const bracketOpts = { highlightParejaId: identidad?.parejaId };

  let html = '<div class="modal-section">';

  Object.values(copasPorId).forEach(({ copa, partidos }) => {
    if (partidos.length === 0) return;

    const matches = normalizarPartidosParaBracket(partidos);

    html += '<div class="modal-copa-seccion">';
    html += `<h3 class="modal-copa-titulo">🏆 ${escapeHtml(copa.nombre)}</h3>`;
    html += renderBracket(matches, bracketOpts);
    html += '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
}

// ─── Tab FIXTURE ───────────────────────────────────────────────────────────────

/**
 * Renderiza el tab "Fixture" — cola unificada de todos los partidos (grupos + copas)
 */
export function renderFixture(container, state) {
  const { cache, identidad } = state;
  if (!cache) {
    container.innerHTML = '<p class="modal-empty">Cargando...</p>';
    return;
  }

  const { partidos, grupos, partidosCopa, copas } = cache;
  const gruposOrdenados = grupos.map(g => g.nombre).sort();
  const copaMap = Object.fromEntries((copas || []).map(c => [c.id, c.nombre]));

  // Cola de partidos de grupo (pendientes, ordenados por ronda/grupo)
  const cola = calcularColaSugerida(partidos, grupos);

  // Copas pendientes (ordenadas por nombre de copa, luego ronda)
  const copaPendientes = (partidosCopa || [])
    .filter(p => !tieneResultado(p))
    .map(p => ({ ...p, copa_nombre: copaMap[p.copa_id] || 'Copa' }))
    .sort((a, b) => {
      const cmpNombre = (a.copa_nombre || '').localeCompare(b.copa_nombre || '');
      if (cmpNombre !== 0) return cmpNombre;
      return (RONDA_COPA_SORT_ORDER[a.ronda_copa] ?? 99) - (RONDA_COPA_SORT_ORDER[b.ronda_copa] ?? 99);
    });

  const totalPendientes = cola.length + copaPendientes.length;
  const jugados = partidos.filter(p => tieneResultado(p)).length;
  const total = partidos.length + (partidosCopa || []).length;

  let html = `
    <div class="modal-section">
      <div class="modal-fixture-stats">
        <span class="modal-stat"><strong>${totalPendientes}</strong> pendientes</span>
        <span class="modal-stat"><strong>${jugados}</strong>/${total} jugados</span>
      </div>
      <div class="modal-fixture-list">
        ${totalPendientes === 0 ? '<p class="modal-empty">¡Todos los partidos jugados!</p>' : ''}
  `;

  // Partidos de grupo pendientes
  cola.forEach((p, idx) => {
    const grupo = p.grupos?.nombre || '?';
    const grupoIndex = Math.min(Math.max(0, gruposOrdenados.indexOf(grupo)), 3);
    const { nombreLocal, nombreVisitante } = orientarPartido(p, identidad);
    const ronda = p.ronda ?? '?';
    const esMiPartido = identidad &&
      (p.pareja_a?.id === identidad.parejaId || p.pareja_b?.id === identidad.parejaId);

    html += `
      <div class="modal-fixture-item ${esMiPartido ? 'es-mio' : ''}">
        <span class="modal-fixture-pos">${idx + 1}</span>
        <span class="modal-fixture-grupo grupo-${grupoIndex}">G${escapeHtml(grupo)}</span>
        <span class="modal-fixture-ronda">R${ronda}</span>
        <span class="modal-fixture-equipos">${escapeHtml(nombreLocal)} <span class="vs">vs</span> ${escapeHtml(nombreVisitante)}</span>
      </div>
    `;
  });

  // Partidos de copa pendientes (al final, numeración continua)
  copaPendientes.forEach((p, idx) => {
    const { nombreLocal, nombreVisitante } = orientarPartido(p, identidad);
    const rondaLabel = RONDA_COPA_LABEL[p.ronda_copa] || p.ronda_copa || '?';
    const esMiPartido = identidad &&
      (p.pareja_a?.id === identidad.parejaId || p.pareja_b?.id === identidad.parejaId);

    html += `
      <div class="modal-fixture-item ${esMiPartido ? 'es-mio' : ''}">
        <span class="modal-fixture-pos">${cola.length + idx + 1}</span>
        <span class="modal-fixture-copa-pill">🏆 ${escapeHtml(p.copa_nombre)}</span>
        <span class="modal-fixture-ronda">${escapeHtml(rondaLabel)}</span>
        <span class="modal-fixture-equipos">${escapeHtml(nombreLocal)} <span class="vs">vs</span> ${escapeHtml(nombreVisitante)}</span>
      </div>
    `;
  });

  html += '</div></div>';
  container.innerHTML = html;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Renderiza lista de partidos de un grupo
 */
export function renderPartidosGrupo(partidos, identidad, mapaPosiciones) {
  if (!partidos.length) {
    return '<p class="modal-empty">Sin partidos</p>';
  }

  return partidos.map(p => {
    const { nombreLocal, nombreVisitante, partidoOrientado } = orientarPartido(p, identidad);
    const jugado = tieneResultado(p);
    const ronda = p.ronda ?? '?';
    const esMiPartido = identidad &&
      (p.pareja_a?.id === identidad.parejaId || p.pareja_b?.id === identidad.parejaId);
    const posicionGlobal = mapaPosiciones?.get(p.id);

    let claseResultado = '';
    if (esMiPartido && jugado) {
      const resultado = determinarGanadorParaPareja(p, identidad.parejaId);
      claseResultado = resultado === 'yo' ? 'mi-victoria' : resultado === 'rival' ? 'mi-derrota' : '';
    }

    return `
      <div class="modal-partido ${jugado ? 'jugado' : 'pendiente'} ${esMiPartido ? 'es-mio' : ''} ${claseResultado}">
        ${posicionGlobal ? `<span class="modal-partido-pos">#${posicionGlobal}</span>` : ''}
        <span class="modal-partido-ronda">R${ronda}</span>
        <span class="modal-partido-equipos">
          ${escapeHtml(nombreLocal)} <span class="vs">vs</span> ${escapeHtml(nombreVisitante)}
        </span>
        <span class="modal-partido-resultado">
          ${jugado ? formatearResultado(partidoOrientado) : 'Pendiente'}
        </span>
      </div>
    `;
  }).join('');
}

/**
 * Orienta un partido para que la pareja del jugador aparezca primero (visual only).
 * Returns { nombreLocal, nombreVisitante, invertido, partidoOrientado }
 */
export function orientarPartido(partido, identidad) {
  const tieneAmbosEquipos = partido.pareja_a?.nombre && partido.pareja_b?.nombre;
  const invertido = tieneAmbosEquipos && identidad?.parejaId === partido.pareja_b?.id;

  if (invertido) {
    return {
      nombreLocal: partido.pareja_b.nombre,
      nombreVisitante: partido.pareja_a.nombre,
      invertido: true,
      partidoOrientado: invertirScoresPartido(partido)
    };
  }

  return {
    nombreLocal: partido.pareja_a?.nombre || '—',
    nombreVisitante: partido.pareja_b?.nombre || '—',
    invertido: false,
    partidoOrientado: partido
  };
}

/**
 * Escapa HTML
 */
export function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
