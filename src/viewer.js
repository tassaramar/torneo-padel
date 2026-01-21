import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { agruparEnRondas } from './carga/partidosGrupos.js';
import { obtenerFrasesUnicas } from './utils/frasesFechaLibre.js';
import { getIdentidad, clearIdentidad } from './identificacion/identidad.js';
import { iniciarIdentificacion } from './identificacion/ui.js';
import { cargarVistaPersonalizada } from './viewer/vistaPersonal.js';
import { 
  cargarResultado, 
  aceptarOtroResultado,
  mostrarModalCargarResultado 
} from './viewer/cargarResultado.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const btnRefresh = document.getElementById('viewer-refresh');
const statusEl = document.getElementById('viewer-status');
const tabsMainEl = document.getElementById('tabs-main');
const contentEl = document.getElementById('viewer-content');

// #region agent log
fetch('http://127.0.0.1:7242/ingest/55950f91-7837-4b4e-a7ee-c1c8657c32bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'viewer.js:26',message:'ANTES de definir window.app',data:{windowAppExiste:typeof window.app !== 'undefined'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'TIMING'})}).catch(()=>{});
// #endregion

// Exponer funciones globales INMEDIATAMENTE para onclick en HTML
// IMPORTANTE: Debe estar antes de cualquier renderizado
window.app = {
  async cargarResultado(partidoId) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/55950f91-7837-4b4e-a7ee-c1c8657c32bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'viewer.js:25',message:'cargarResultado iniciado DESDE window.app',data:{partidoId:partidoId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FIX_VERIFICAR'})}).catch(()=>{});
    // #endregion
    
    const identidad = getIdentidad();
    
    if (!identidad) {
      alert('Error: No se encontró tu identificación. Por favor, recargá la página.');
      return;
    }

    // Buscar partido
    const { data: partido, error: errorPartido } = await supabase
      .from('partidos')
      .select(`
        id, games_a, games_b, estado,
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('id', partidoId)
      .single();

    if (!partido) {
      alert('Error: No se pudo cargar el partido. ' + (errorPartido?.message || ''));
      return;
    }

    mostrarModalCargarResultado(partido, identidad, async (gamesA, gamesB) => {
      const resultado = await cargarResultado(supabase, partidoId, gamesA, gamesB, identidad);
      
      if (resultado.ok) {
        alert(resultado.mensaje);
        await init('personal');
      } else {
        alert('Error: ' + resultado.mensaje);
      }
    });
  },

  async confirmarResultado(partidoId, gamesA, gamesB) {
    const identidad = getIdentidad();
    if (!identidad) return;

    const resultado = await cargarResultado(supabase, partidoId, gamesA, gamesB, identidad);
    
    if (resultado.ok) {
      alert(resultado.mensaje);
      await init('personal');
    } else {
      alert('Error: ' + resultado.mensaje);
    }
  },

  async cargarResultadoDiferente(partidoId) {
    await this.cargarResultado(partidoId);
  },

  async aceptarOtroResultado(partidoId) {
    const identidad = getIdentidad();
    if (!identidad) return;

    if (!confirm('¿Estás seguro de aceptar el resultado de la otra pareja?')) return;

    const resultado = await aceptarOtroResultado(supabase, partidoId, identidad);
    
    if (resultado.ok) {
      alert(resultado.mensaje);
      await init('personal');
    } else {
      alert('Error: ' + resultado.mensaje);
    }
  },

  async recargarResultado(partidoId) {
    await this.cargarResultado(partidoId);
  }
};

// #region agent log
fetch('http://127.0.0.1:7242/ingest/55950f91-7837-4b4e-a7ee-c1c8657c32bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'viewer.js:120',message:'DESPUES de definir window.app',data:{windowAppExiste:typeof window.app !== 'undefined',cargarExiste:typeof window.app?.cargarResultado === 'function'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'TIMING'})}).catch(()=>{});
// #endregion

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

// Mantener compatibilidad con botón manual (por si acaso)
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
        id, games_a, games_b, estado, ronda,
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
    
    // Incluir partidos confirmados y a_confirmar, pero NO en_revision
    const contabilizar = m.estado === 'confirmado' || m.estado === 'a_confirmar';
    if (!contabilizar) continue;

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
      { id: 'copas', label: 'Último Saque' }
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
    (id) => {
      activeCopaId = id;
      render();
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

async function init(modoVista = 'auto') {
  try {
    setStatus('Cargando…');
    
    const identidad = getIdentidad();
    const forzarVistaCompleta = sessionStorage.getItem('mostrarVistaCompleta') === 'true';
    
    // Si hay flag de vista completa, removerlo ahora
    if (forzarVistaCompleta) {
      sessionStorage.removeItem('mostrarVistaCompleta');
    }
    
    // Decidir qué vista mostrar
    if (modoVista === 'personal' || (modoVista === 'auto' && identidad && !forzarVistaCompleta)) {
      // Vista personalizada
      await cargarVistaPersonalizada(
        supabase, 
        TORNEO_ID, 
        identidad,
        () => cambiarDePareja(),
        () => cargarVistaCompleta()
      );
      setStatus(`Actualizado ${nowStr()}`);
    } else {
      // Vista completa (todos los grupos)
      cache = await fetchAll();
      setStatus(`Actualizado ${nowStr()}`);
      render();
      
      // Si hay identidad, agregar botón para volver a vista personal
      if (identidad) {
        agregarBotonVistaPersonal();
      }
    }
  } catch (e) {
    console.error(e);
    setStatus('❌ Error (ver consola)');
    if (contentEl) contentEl.innerHTML = '<p>❌ Error cargando viewer.</p>';
  }
}

async function cargarVistaCompleta() {
  // Guardar flag temporalmente para mostrar vista completa
  sessionStorage.setItem('mostrarVistaCompleta', 'true');
  // Recargar para volver a la vista completa
  location.reload();
}

function volverAVistaPersonal() {
  // Simplemente recargar sin el flag
  sessionStorage.removeItem('mostrarVistaCompleta');
  location.reload();
}

function agregarBotonVistaPersonal() {
  // Buscar el contenedor de navegación
  const navContainer = document.getElementById('viewer-nav-buttons');
  if (!navContainer) return;
  
  // Limpiar contenedor
  navContainer.innerHTML = '';
  
  // Crear el botón GRANDE para +40
  const btnVistaPersonal = document.createElement('button');
  btnVistaPersonal.id = 'btn-vista-personal';
  btnVistaPersonal.className = 'btn-action-secondary';
  btnVistaPersonal.type = 'button';
  btnVistaPersonal.innerHTML = `
    <span class="btn-icon">👤</span>
    <span class="btn-text">Mi Vista</span>
  `;
  btnVistaPersonal.addEventListener('click', volverAVistaPersonal);
  
  navContainer.appendChild(btnVistaPersonal);
}

function cambiarDePareja() {
  clearIdentidad();
  location.reload();
}

/**
 * Agrega el grupo inferido a cada pareja (basado en bloques por orden)
 */
function agregarGrupoAParejas(parejas, grupos) {
  if (!grupos.length || !parejas.length) {
    return parejas.map(p => ({ ...p, grupo: '?' }));
  }
  
  const n = grupos.length;
  const per = parejas.length / n;
  
  if (!Number.isInteger(per)) {
    return parejas.map(p => ({ ...p, grupo: '?' }));
  }
  
  const orderedGroups = [...grupos].map(g => g.nombre).sort();
  
  return parejas.map((p, idx) => {
    const grupoIdx = Math.floor(idx / per);
    const grupo = orderedGroups[grupoIdx] || '?';
    return { ...p, grupo };
  });
}

async function checkIdentidadYCargar() {
  // Verificar si se solicitó vista completa
  const mostrarVistaCompleta = sessionStorage.getItem('mostrarVistaCompleta');
  if (mostrarVistaCompleta) {
    // NO remover el flag aquí, init() lo hará
    // Cargar vista completa (init verá el flag)
    await init();
    startPolling(); // Iniciar auto-refresh
    return;
  }
  
  // Verificar si ya hay identidad guardada
  const identidad = getIdentidad();
  
  if (identidad) {
    // Ya está identificado, cargar vista personalizada
    console.log('Usuario identificado:', identidad.parejaNombre);
    await init();
    startPolling(); // Iniciar auto-refresh
  } else {
    // No está identificado, mostrar flujo de identificación
    console.log('Usuario no identificado, iniciando flujo de identificación...');
    
    // Cargar parejas para el flujo de identificación
    const { data: parejas, error } = await supabase
      .from('parejas')
      .select('id, nombre, orden')
      .eq('torneo_id', TORNEO_ID)
      .order('orden');
    
    if (error) {
      console.error('Error cargando parejas:', error);
      alert('Error cargando datos del torneo. Por favor, recargá la página.');
      return;
    }
    
    // Calcular grupo por pareja (inferido del orden)
    const { data: grupos } = await supabase
      .from('grupos')
      .select('id, nombre')
      .eq('torneo_id', TORNEO_ID)
      .order('nombre');
    
    const parejasConGrupo = agregarGrupoAParejas(parejas, grupos || []);
    
    // Iniciar flujo de identificación
    // Ocultamos el viewer y mostramos identificación
    const viewerShell = document.querySelector('.viewer-shell');
    if (viewerShell) viewerShell.style.display = 'none';
    
    // Crear contenedor temporal para identificación
    let identContainer = document.getElementById('identificacion-container');
    if (!identContainer) {
      identContainer = document.createElement('div');
      identContainer.id = 'identificacion-container';
      document.body.appendChild(identContainer);
    }
    
    iniciarIdentificacion(parejasConGrupo, async (identidad) => {
      console.log('Identificación completada:', identidad.parejaNombre);
      // Limpiar contenedor de identificación y mostrar viewer
      if (identContainer) identContainer.remove();
      if (viewerShell) viewerShell.style.display = '';
      // Cargar el viewer
      await init();
      startPolling(); // Iniciar auto-refresh
    }, 'identificacion-container', supabase); // Pasar supabase para tracking
  }
}

// window.app ya está definido al inicio del archivo (después de las constantes)

// #region agent log
fetch('http://127.0.0.1:7242/ingest/55950f91-7837-4b4e-a7ee-c1c8657c32bb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'viewer.js:866',message:'ANTES de checkIdentidadYCargar',data:{windowAppExiste:typeof window.app !== 'undefined',cargarExiste:typeof window.app?.cargarResultado === 'function'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'TIMING'})}).catch(()=>{});
// #endregion

// Iniciar la app con check de identidad
checkIdentidadYCargar();
