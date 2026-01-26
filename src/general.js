import { createClient } from '@supabase/supabase-js';
import { agruparEnRondas } from './carga/partidosGrupos.js';
import { obtenerFrasesUnicas } from './utils/frasesFechaLibre.js';
import {
  calcularTablaGrupo,
  ordenarConOverrides,
  detectarEmpatesReales,
  cargarOverrides,
  agregarMetadataOverrides,
  ordenarTabla
} from './utils/tablaPosiciones.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const statusEl = document.getElementById('viewer-status');
const tabsMainEl = document.getElementById('tabs-main');
const contentEl = document.getElementById('viewer-content');

// Polling automático
let pollingInterval = null;
const POLLING_INTERVAL_MS = 30000; // 30 segundos

function startPolling() {
  stopPolling();
  
  // Iniciar polling
  pollingInterval = setInterval(() => {
    console.log('[Polling] Auto-refresh...');
    init();
  }, POLLING_INTERVAL_MS);
  
  // Pausar polling cuando tab no está visible (ahorro de recursos)
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    console.log('[Polling] Tab oculto - pausando polling');
    stopPolling();
  } else {
    console.log('[Polling] Tab visible - reiniciando polling');
    startPolling();
  }
}

function setStatus(txt) {
  if (statusEl) statusEl.textContent = txt;
}

function nowStr() {
  const d = new Date();
  return d.toLocaleTimeString();
}

function makeTabs(container, items, activeId, onClick) {
  container.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab-btn' + (it.id === activeId ? ' active' : '');
    b.textContent = it.label;
    b.onclick = () => onClick(it.id);
    container.appendChild(b);
  });
}

function winnerSideFromScores(ga, gb) {
  if (ga === null || gb === null) return null;
  if (ga === gb) return null;
  return ga > gb ? 'A' : 'B';
}

function matchCard({ title, aName, bName, aScore, bScore }) {
  const pending = (aScore === null || bScore === null);
  const win = winnerSideFromScores(aScore, bScore);

  const aWinner = !pending && win === 'A';
  const bWinner = !pending && win === 'B';

  const scoreA = pending ? '' : aScore;
  const scoreB = pending ? '' : bScore;

  return `
    <div class="bracket-match ${pending ? 'is-pending' : ''}">
      <div class="bracket-match-title">${title}</div>
      <div class="bracket-team ${aWinner ? 'is-winner' : ''} ${pending ? 'is-pending' : ''}">
        <span class="bracket-team-name">${aName ?? '—'}</span>
        <span class="bracket-team-score">${scoreA}</span>
      </div>
      <div class="bracket-team ${bWinner ? 'is-winner' : ''} ${pending ? 'is-pending' : ''}">
        <span class="bracket-team-name">${bName ?? '—'}</span>
        <span class="bracket-team-score">${scoreB}</span>
      </div>
    </div>
  `;
}

/* =========================
   DATA FETCH
========================= */

async function fetchAll() {
  const [{ data: grupos, error: errG }, { data: partidosGrupo, error: errPG }, { data: copas, error: errC }, { data: partidosCopas, error: errPC }] =
    await Promise.all([
      supabase.from('grupos').select('id, nombre').eq('torneo_id', TORNEO_ID).order('nombre'),
      supabase.from('partidos').select(`
        id, games_a, games_b, estado, ronda,
        pareja_a_id, pareja_b_id,
        grupos ( id, nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `).eq('torneo_id', TORNEO_ID).is('copa_id', null),
      supabase.from('copas').select('id, nombre, orden').eq('torneo_id', TORNEO_ID).order('orden'),
      supabase.from('partidos').select(`
        id, games_a, games_b, ronda_copa, orden_copa, copa_id,
        copas ( id, nombre, orden ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `).eq('torneo_id', TORNEO_ID).not('copa_id', 'is', null)
    ]);

  if (errG) throw errG;
  if (errPG) throw errPG;
  if (errC) throw errC;
  if (errPC) throw errPC;

  return {
    grupos: grupos || [],
    partidosGrupo: partidosGrupo || [],
    copas: copas || [],
    partidosCopas: partidosCopas || []
  };
}

/* =========================
   POSICIONES (por grupo)
   P: 2 ganar / 1 perder
   Desempate: P -> DG -> GF
========================= */

// Funciones de tabla de posiciones ahora están centralizadas en utils/tablaPosiciones.js

async function computeTablaGrupoConOverrides(grupoId, partidos) {
  // Calcular tabla usando función centralizada
  const tablaBase = calcularTablaGrupo(partidos);

  // Calcular posición automática (sin overrides) para comparación
  const tablaAuto = ordenarTabla(tablaBase, partidos);
  const autoPosMap = {};
  tablaAuto.forEach((r, idx) => {
    autoPosMap[r.pareja_id] = idx + 1;
  });

  // Cargar overrides
  const overridesMap = await cargarOverrides(supabase, TORNEO_ID, grupoId);

  // Aplicar overrides (solo en empates reales)
  const tablaOrdenada = ordenarConOverrides(tablaBase, overridesMap, partidos);

  // Detectar empates considerando enfrentamiento directo y overrides
  const { tieGroups } = detectarEmpatesReales(tablaOrdenada, partidos, overridesMap);

  // Crear mapa de color por pareja
  const tieColorMap = {};
  if (tieGroups) {
    tieGroups.forEach(group => {
      group.parejaIds.forEach(parejaId => {
        tieColorMap[parejaId] = group.color;
      });
    });
  }

  // Agregar metadata de overrides
  const tablaConMetadata = agregarMetadataOverrides(tablaOrdenada, overridesMap);

  // Agregar metadata adicional
  const tabla = tablaConMetadata.map((s, idx) => ({
    ...s,
    posicionActual: idx + 1,
    posicionAuto: autoPosMap[s.pareja_id] || idx + 1,
    delta: (autoPosMap[s.pareja_id] || idx + 1) - (idx + 1),
    tieneOverride: s.tieneOverrideAplicado,
    colorEmpate: tieColorMap[s.pareja_id] || null
  }));

  return tabla;
}

/* =========================
   RENDER
========================= */

let cache = null;

let mainTab = 'grupos'; // 'grupos' | 'copas'
let activeGrupoId = null;
let activeCopaId = null;

function renderMainTabs() {
  makeTabs(
    tabsMainEl,
    [
      { id: 'grupos', label: 'Grupos' },
      { id: 'copas', label: 'Último Saque' }
    ],
    mainTab,
    async (id) => {
      mainTab = id;
      await render();
    }
  );
}

async function render() {
  renderMainTabs();

  if (!cache) {
    contentEl.innerHTML = '<p>Cargando…</p>';
    return;
  }

  if (mainTab === 'grupos') await renderGrupos();
  else renderCopas();
}

function renderPartidosConRondas(partidos) {
  if (!partidos.length) {
    return '<div class="viewer-card"><p>Sin partidos.</p></div>';
  }
  
  // Detectar si hay fechas libres calculando con Circle Method
  const partidosConFecha = partidos.filter(p => p.games_a !== null || p.games_b !== null);
  const rondas = partidosConFecha.length > 0 ? agruparEnRondas(partidosConFecha) : [];
  const totalParejasLibres = rondas.reduce((sum, r) => sum + r.parejasLibres.length, 0);
  const frases = obtenerFrasesUnicas(totalParejasLibres);
  let fraseIndex = 0;
  
  // Crear mapa de parejas libres por ronda
  const fechasLibresPorRonda = {};
  rondas.forEach((rondaData, idx) => {
    fechasLibresPorRonda[idx + 1] = rondaData.parejasLibres || [];
  });
  
  // Ordenar partidos por ronda (de la BD), luego por estado
  const ordenEstado = {
    'pendiente': 0,
    'a_confirmar': 1,
    'confirmado': 2,
    'en_revision': 3
  };
  
  const partidosOrdenados = [...partidos].sort((a, b) => {
    // Primero por ronda
    if (a.ronda !== b.ronda) return (a.ronda || 999) - (b.ronda || 999);
    // Luego por estado
    return (ordenEstado[a.estado] || 9) - (ordenEstado[b.estado] || 9);
  });
  
  let html = '<div class="viewer-card">';
  let ultimaRonda = null;
  
  partidosOrdenados.forEach(p => {
    const ronda = p.ronda || '?';
    const a = p.pareja_a?.nombre ?? '—';
    const b = p.pareja_b?.nombre ?? '—';
    const jugado = p.games_a !== null && p.games_b !== null;
    const esperandoConfirmacion = p.estado === 'a_confirmar';
    const enRevision = p.estado === 'en_revision';
    
    // Mostrar fechas libres cuando cambia de ronda
    if (ultimaRonda !== null && ronda !== ultimaRonda && fechasLibresPorRonda[ultimaRonda]) {
      fechasLibresPorRonda[ultimaRonda].forEach(parejaLibre => {
        html += `
          <div class="viewer-match viewer-match-libre">
            <div class="viewer-match-ronda">R${ultimaRonda}</div>
            <div class="viewer-match-names">${parejaLibre}</div>
            <div class="viewer-match-res">${frases[fraseIndex++] || 'Fecha libre'}</div>
          </div>
        `;
      });
      delete fechasLibresPorRonda[ultimaRonda];
    }
    
    ultimaRonda = ronda;
    
    // Renderizar partido
    if (jugado) {
      const res = `${p.games_a} - ${p.games_b}`;
      html += `
        <div class="viewer-match ${esperandoConfirmacion ? 'viewer-match-esperando' : ''} ${enRevision ? 'viewer-match-revision' : ''}">
          <div class="viewer-match-ronda">R${ronda}</div>
          <div class="viewer-match-names">${a} <span class="vs">vs</span> ${b}</div>
          <div class="viewer-match-res">
            ${res}
            ${esperandoConfirmacion ? '<span class="viewer-match-badge">⏳ Esperando confirmación</span>' : ''}
            ${enRevision ? '<span class="viewer-match-badge">⚠️ En revisión</span>' : ''}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="viewer-match">
          <div class="viewer-match-ronda">R${ronda}</div>
          <div class="viewer-match-names">${a} <span class="vs">vs</span> ${b}</div>
          <div class="viewer-match-res">Pendiente</div>
        </div>
      `;
    }
  });
  
  // Mostrar fechas libres de la última ronda si quedan
  if (ultimaRonda !== null && fechasLibresPorRonda[ultimaRonda]) {
    fechasLibresPorRonda[ultimaRonda].forEach(parejaLibre => {
      html += `
        <div class="viewer-match viewer-match-libre">
          <div class="viewer-match-ronda">R${ultimaRonda}</div>
          <div class="viewer-match-names">${parejaLibre}</div>
          <div class="viewer-match-res">${frases[fraseIndex++] || 'Fecha libre'}</div>
        </div>
      `;
    });
  }
  
  html += '</div>';
  
  return html;
}

async function renderGrupos() {
  const { grupos, partidosGrupo } = cache;

  if (!grupos.length) {
    contentEl.innerHTML = '<p>No hay grupos.</p>';
    return;
  }

  if (!activeGrupoId) activeGrupoId = grupos[0].id;

  const subtabs = document.createElement('div');
  subtabs.className = 'subtabs';

  makeTabs(
    subtabs,
    grupos.map(g => ({ id: g.id, label: g.nombre })),
    activeGrupoId,
    async (id) => {
      activeGrupoId = id;
      await render();
    }
  );

  const grupo = grupos.find(g => g.id === activeGrupoId);

  const partidosDelGrupo = partidosGrupo
    .filter(p => p.grupos?.id === activeGrupoId)
    .sort((a, b) => {
      const aj = (a.games_a !== null && a.games_b !== null) ? 1 : 0;
      const bj = (b.games_a !== null && b.games_b !== null) ? 1 : 0;
      // pendientes primero
      if (aj !== bj) return aj - bj;
      return (a.id || '').localeCompare(b.id || '');
    });

  const jugados = partidosDelGrupo.filter(p => p.games_a !== null && p.games_b !== null).length;
  const total = partidosDelGrupo.length;

  const tabla = await computeTablaGrupoConOverrides(activeGrupoId, partidosDelGrupo);

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="viewer-section">
      <div class="viewer-section-title">Grupo ${grupo?.nombre ?? ''}</div>
      <div class="viewer-meta">Partidos: <strong>${jugados}/${total}</strong></div>

      <div class="viewer-card">
        <table>
          <thead>
            <tr>
              <th colspan="8">Tabla de posiciones</th>
            </tr>
            <tr>
              <th>Pareja</th>
              <th>PJ</th><th>PG</th><th>PP</th>
              <th>GF</th><th>GC</th><th>DG</th>
              <th>P</th>
            </tr>
          </thead>
          <tbody>
            ${tabla.map((r, idx) => {
              // Indicador de cambio de posición (si hay override)
              let indicadorPosicion = '';
              if (r.delta !== 0 && r.tieneOverride) {
                const txt = r.delta > 0 ? `+${r.delta}` : `${r.delta}`;
                const color = r.delta > 0 ? '#1a7f37' : '#d1242f';
                indicadorPosicion = ` <sup style="font-size:11px; color:${color}; font-weight:700; margin-left:4px;">${txt}</sup>`;
              }

              // Badge de override aplicado
              const overrideBadge = r.tieneOverride ? ' <span style="font-size:11px; opacity:0.7;" title="Orden manual aplicado">📌</span>' : '';

              // Estilo de empate (si aplica)
              let styleEmpate = '';
              if (r.colorEmpate) {
                styleEmpate = `background: ${r.colorEmpate.bg}; border-left: 4px solid ${r.colorEmpate.border};`;
              }

              const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
              
              return `
                <tr class="${rankClass}" style="${styleEmpate}">
                  <td>${r.nombre}${overrideBadge}${indicadorPosicion}</td>
                  <td>${r.PJ}</td><td>${r.PG}</td><td>${r.PP}</td>
                  <td>${r.GF}</td><td>${r.GC}</td><td>${r.DG}</td>
                  <td><strong>${r.P}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <details class="viewer-details">
        <summary>Ver partidos del grupo</summary>
        ${renderPartidosConRondas(partidosDelGrupo)}
      </details>
    </div>
  `;

  contentEl.innerHTML = '';
  contentEl.appendChild(subtabs);
  contentEl.appendChild(wrap);
}

function labelRonda(r) {
  if (!r) return '';
  if (r === 'SF') return 'Semi';
  if (r === 'F') return 'Final';
  if (r === '3P') return '3° Puesto';
  return r;
}

/* =========================
   RENDER COPA DIRECTA (CRUCES SIMPLES)
========================= */

function renderCopaDirecta(copa, partidos) {
  if (partidos.length === 0) {
    return `<div class="viewer-card"><p>Todavía no hay partidos en esta copa.</p></div>`;
  }
  
  return `
    <div class="viewer-card">
      ${partidos.map(p => {
        const a = p.pareja_a?.nombre ?? '—';
        const b = p.pareja_b?.nombre ?? '—';
        const jugado = p.games_a !== null && p.games_b !== null;
        const res = jugado ? `${p.games_a} - ${p.games_b}` : 'Pendiente';
        const pending = !jugado;
        
        return `
          <div class="viewer-match ${pending ? 'is-pending' : ''}">
            <div class="viewer-match-names">${a} <span class="vs">vs</span> ${b}</div>
            <div class="viewer-match-res">${res}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* =========================
   RENDER BRACKET TRADICIONAL (SEMIS/FINAL)
========================= */

function renderBracketTradicional(partidos) {
  const sf = partidos.filter(p => p.ronda_copa === 'SF').sort((a, b) => (a.orden_copa ?? 99) - (b.orden_copa ?? 99));
  const fin = partidos.find(p => p.ronda_copa === 'F') || null;
  const p3 = partidos.find(p => p.ronda_copa === '3P') || null;

  const sf1 = sf[0] || null;
  const sf2 = sf[1] || null;

  return `
    <div class="bracket-copa">
      <div class="bracket-grid">
        <div class="bracket-col">
          <div class="bracket-col-title">Semis</div>
          ${sf1 ? matchCard({
            title: 'Semi 1',
            aName: sf1.pareja_a?.nombre,
            bName: sf1.pareja_b?.nombre,
            aScore: sf1.games_a,
            bScore: sf1.games_b
          }) : `<div class="bracket-empty">Sin Semi 1</div>`}

          ${sf2 ? matchCard({
            title: 'Semi 2',
            aName: sf2.pareja_a?.nombre,
            bName: sf2.pareja_b?.nombre,
            aScore: sf2.games_a,
            bScore: sf2.games_b
          }) : `<div class="bracket-empty">Sin Semi 2</div>`}
        </div>

        <div class="bracket-col">
          <div class="bracket-col-title">Final</div>
          ${fin ? matchCard({
            title: 'Final',
            aName: fin.pareja_a?.nombre,
            bName: fin.pareja_b?.nombre,
            aScore: fin.games_a,
            bScore: fin.games_b
          }) : `<div class="bracket-empty">Todavía no hay Final</div>`}
        </div>

        <div class="bracket-col">
          <div class="bracket-col-title">3° Puesto</div>
          ${p3 ? matchCard({
            title: '3° Puesto',
            aName: p3.pareja_a?.nombre,
            bName: p3.pareja_b?.nombre,
            aScore: p3.games_a,
            bScore: p3.games_b
          }) : `<div class="bracket-empty">Todavía no hay 3° Puesto</div>`}
        </div>
      </div>
    </div>

    <details class="viewer-details">
      <summary>Ver lista de partidos</summary>
      <div class="viewer-card">
        ${partidos.length ? partidos.map(p => {
          const a = p.pareja_a?.nombre ?? '—';
          const b = p.pareja_b?.nombre ?? '—';
          const res = (p.games_a === null || p.games_b === null) ? 'Pendiente' : `${p.games_a} - ${p.games_b}`;
          return `
            <div class="viewer-match">
              <div class="viewer-match-names">${labelRonda(p.ronda_copa)} · ${a} <span class="vs">vs</span> ${b}</div>
              <div class="viewer-match-res">${res}</div>
            </div>
          `;
        }).join('') : '<p>Sin partidos.</p>'}
      </div>
    </details>
  `;
}

function renderCopas() {
  const { copas, partidosCopas } = cache;

  if (!copas.length) {
    contentEl.innerHTML = '<p>No hay partidos definidos todavía.</p>';
    return;
  }

  if (!activeCopaId) activeCopaId = copas[0].id;

  const subtabs = document.createElement('div');
  subtabs.className = 'subtabs';

  makeTabs(
    subtabs,
    copas.map(c => ({ id: c.id, label: c.nombre })),
    activeCopaId,
    async (id) => {
      activeCopaId = id;
      await render();
    }
  );

  const copa = copas.find(c => c.id === activeCopaId);

  const partidos = partidosCopas
    .filter(p => p.copa_id === activeCopaId)
    .sort((a, b) => (a.orden_copa ?? 999) - (b.orden_copa ?? 999));

  // DETECCIÓN AUTOMÁTICA: ¿Tiene partidos con ronda_copa?
  const tieneRondas = partidos.some(p => p.ronda_copa !== null);

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="viewer-section">
      <div class="viewer-section-title">${copa?.nombre ?? 'Copa'}</div>
      
      ${tieneRondas 
        ? renderBracketTradicional(partidos)  // Formato bracket (semis/final)
        : renderCopaDirecta(copa, partidos)    // Formato cruces directos
      }
    </div>
  `;

  contentEl.innerHTML = '';
  contentEl.appendChild(subtabs);
  contentEl.appendChild(wrap);
}

function agregarBotonVistaPersonal() {
  const navContainer = document.getElementById('viewer-nav-buttons');
  if (!navContainer) return;
  
  navContainer.innerHTML = '';
  
  const btn = document.createElement('button');
  btn.id = 'btn-vista-personal';
  btn.className = 'btn-action-primary';
  btn.type = 'button';
  btn.innerHTML = `
    <span class="btn-icon">👤</span>
    <span class="btn-text">Ver Mis Partidos</span>
  `;
  btn.addEventListener('click', () => {
    window.location.href = '/';
  });
  
  navContainer.appendChild(btn);
}

async function init() {
  try {
    setStatus('Cargando…');
    
    cache = await fetchAll();
    setStatus(`Actualizado ${nowStr()}`);
    await render();
    
    // Agregar botón para ir a vista personal
    agregarBotonVistaPersonal();
  } catch (e) {
    console.error(e);
    setStatus('❌ Error (ver consola)');
    if (contentEl) contentEl.innerHTML = '<p>❌ Error cargando viewer.</p>';
  }
}

// Inicializar al cargar la página
init();
startPolling();
