import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { agruparEnRondas } from './carga/partidosGrupos.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const btnRefresh = document.getElementById('viewer-refresh');
const statusEl = document.getElementById('viewer-status');
const tabsMainEl = document.getElementById('tabs-main');
const contentEl = document.getElementById('viewer-content');

btnRefresh?.addEventListener('click', () => init());

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
        id, games_a, games_b,
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

function computeTablaGrupo(partidos) {
  const map = {};

  function initPareja(p) {
    if (!map[p.id]) {
      map[p.id] = {
        pareja_id: p.id,
        nombre: p.nombre,
        PJ: 0, PG: 0, PP: 0,
        GF: 0, GC: 0, DG: 0,
        P: 0
      };
    }
    return map[p.id];
  }

  for (const m of partidos) {
    const a = initPareja(m.pareja_a);
    const b = initPareja(m.pareja_b);

    const jugado = m.games_a !== null && m.games_b !== null;
    if (!jugado) continue;

    const ga = Number(m.games_a);
    const gb = Number(m.games_b);

    a.PJ += 1; b.PJ += 1;

    a.GF += ga; a.GC += gb;
    b.GF += gb; b.GC += ga;

    a.DG = a.GF - a.GC;
    b.DG = b.GF - b.GC;

    if (ga > gb) {
      a.P += 2; a.PG += 1;
      b.P += 1; b.PP += 1;
    } else if (gb > ga) {
      b.P += 2; b.PG += 1;
      a.P += 1; a.PP += 1;
    }
  }

  return Object.values(map).sort((x, y) => {
    if (y.P !== x.P) return y.P - x.P;
    if (y.DG !== x.DG) return y.DG - x.DG;
    if (y.GF !== x.GF) return y.GF - x.GF;
    return String(x.nombre).localeCompare(String(y.nombre));
  });
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
      { id: 'copas', label: 'Copas' }
    ],
    mainTab,
    (id) => {
      mainTab = id;
      render();
    }
  );
}

function render() {
  renderMainTabs();

  if (!cache) {
    contentEl.innerHTML = '<p>Cargando…</p>';
    return;
  }

  if (mainTab === 'grupos') renderGrupos();
  else renderCopas();
}

function renderPartidosConRondas(partidos) {
  if (!partidos.length) {
    return '<div class="viewer-card"><p>Sin partidos.</p></div>';
  }
  
  // Separar pendientes de jugados
  const pendientes = partidos.filter(p => p.games_a === null || p.games_b === null);
  const jugados = partidos.filter(p => p.games_a !== null && p.games_b !== null);
  
  let html = '';
  
  // Mostrar pendientes agrupados por rondas
  if (pendientes.length > 0) {
    const rondas = agruparEnRondas(pendientes);
    
    rondas.forEach((ronda, idx) => {
      if (rondas.length > 1) {
        html += `
          <div style="margin: 16px 0 8px; padding: 6px 10px; background: var(--primary-soft); border-left: 3px solid var(--primary); border-radius: 6px; font-weight: 700; font-size: 13px;">
            Ronda ${idx + 1} — ${ronda.length} partido${ronda.length > 1 ? 's' : ''} en paralelo
          </div>
        `;
      }
      
      html += '<div class="viewer-card">';
      ronda.forEach(p => {
        const a = p.pareja_a?.nombre ?? '—';
        const b = p.pareja_b?.nombre ?? '—';
        html += `
          <div class="viewer-match">
            <div class="viewer-match-names">${a} <span class="vs">vs</span> ${b}</div>
            <div class="viewer-match-res">Pendiente</div>
          </div>
        `;
      });
      html += '</div>';
    });
  }
  
  // Mostrar jugados
  if (jugados.length > 0) {
    if (pendientes.length > 0) {
      html += '<div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); font-weight: 700; font-size: 13px; color: var(--muted);">Partidos jugados</div>';
    }
    html += '<div class="viewer-card">';
    jugados.forEach(p => {
      const a = p.pareja_a?.nombre ?? '—';
      const b = p.pareja_b?.nombre ?? '—';
      const res = `${p.games_a} - ${p.games_b}`;
      html += `
        <div class="viewer-match">
          <div class="viewer-match-names">${a} <span class="vs">vs</span> ${b}</div>
          <div class="viewer-match-res">${res}</div>
        </div>
      `;
    });
    html += '</div>';
  }
  
  return html;
}

function renderGrupos() {
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
    (id) => {
      activeGrupoId = id;
      render();
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

  const tabla = computeTablaGrupo(partidosDelGrupo);

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
            ${tabla.map((r, idx) => `
              <tr class="${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : ''}">
                <td>${r.nombre}</td>
                <td>${r.PJ}</td><td>${r.PG}</td><td>${r.PP}</td>
                <td>${r.GF}</td><td>${r.GC}</td><td>${r.DG}</td>
                <td><strong>${r.P}</strong></td>
              </tr>
            `).join('')}
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

function renderCopas() {
  const { copas, partidosCopas } = cache;

  if (!copas.length) {
    contentEl.innerHTML = '<p>No hay copas todavía.</p>';
    return;
  }

  if (!activeCopaId) activeCopaId = copas[0].id;

  const subtabs = document.createElement('div');
  subtabs.className = 'subtabs';

  makeTabs(
    subtabs,
    copas.map(c => ({ id: c.id, label: c.nombre })),
    activeCopaId,
    (id) => {
      activeCopaId = id;
      render();
    }
  );

  const copa = copas.find(c => c.id === activeCopaId);

  const partidos = partidosCopas
    .filter(p => p.copa_id === activeCopaId)
    .sort((a, b) => (a.orden_copa ?? 999) - (b.orden_copa ?? 999));

  const sf = partidos.filter(p => p.ronda_copa === 'SF').sort((a, b) => (a.orden_copa ?? 99) - (b.orden_copa ?? 99));
  const fin = partidos.find(p => p.ronda_copa === 'F') || null;
  const p3 = partidos.find(p => p.ronda_copa === '3P') || null;

  const sf1 = sf[0] || null;
  const sf2 = sf[1] || null;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="viewer-section">
      <div class="viewer-section-title">${copa?.nombre ?? 'Copa'}</div>

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
    </div>
  `;

  contentEl.innerHTML = '';
  contentEl.appendChild(subtabs);
  contentEl.appendChild(wrap);
}

async function init() {
  try {
    setStatus('Cargando…');
    cache = await fetchAll();
    setStatus(`Actualizado ${nowStr()}`);
    render();
  } catch (e) {
    console.error(e);
    setStatus('❌ Error (ver consola)');
    contentEl.innerHTML = '<p>❌ Error cargando viewer.</p>';
  }
}

init();
