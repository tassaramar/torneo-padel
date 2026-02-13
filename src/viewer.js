import { createClient } from '@supabase/supabase-js';
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
import {
  calcularTablaGrupo,
  ordenarConOverrides,
  detectarEmpatesReales,
  cargarOverrides,
  agregarMetadataOverrides
} from './utils/tablaPosiciones.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const btnRefresh = document.getElementById('viewer-refresh');
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
        id, estado, ronda,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
        stb_puntos_a, stb_puntos_b,
        pareja_a_id, pareja_b_id,
        grupos ( id, nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `).eq('torneo_id', TORNEO_ID).is('copa_id', null),
      supabase.from('copas').select('id, nombre, orden').eq('torneo_id', TORNEO_ID).order('orden'),
      supabase.from('partidos').select(`
        id, ronda_copa, orden_copa, copa_id,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
        stb_puntos_a, stb_puntos_b,
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
   Usa funciones centralizadas de tablaPosiciones.js
========================= */

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
  
  // Detectar si hay fechas libres calculando con Circle Method
  const partidosConFecha = partidos.filter(p => p.sets_a !== null);
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
    const jugado = p.sets_a !== null; // Tiene resultado si sets_a fue calculado
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
      // Importar función de formateo
      const { formatearResultado } = await import('./utils/formatoResultado.js');
      const res = formatearResultado(p);
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
    (id) => {
      activeGrupoId = id;
      render();
    }
  );

  const grupo = grupos.find(g => g.id === activeGrupoId);

  const partidosDelGrupo = partidosGrupo
    .filter(p => p.grupos?.id === activeGrupoId)
    .sort((a, b) => {
      const aj = a.sets_a !== null ? 1 : 0;
      const bj = b.sets_a !== null ? 1 : 0;
      // pendientes primero
      if (aj !== bj) return aj - bj;
      return (a.id || '').localeCompare(b.id || '');
    });

  const jugados = partidosDelGrupo.filter(p => p.sets_a !== null).length;
  const total = partidosDelGrupo.length;

  // Calcular tabla usando función centralizada
  const tablaBase = calcularTablaGrupo(partidosDelGrupo);

  // Cargar overrides
  const overridesMap = await cargarOverrides(supabase, TORNEO_ID, activeGrupoId);

  // Aplicar overrides (solo en empates reales)
  const tablaOrdenada = ordenarConOverrides(tablaBase, overridesMap, partidosDelGrupo);

  // Agregar metadata de overrides
  const tablaConMetadata = agregarMetadataOverrides(tablaOrdenada, overridesMap);

  // Detectar empates
  const { tieSet, tieLabel, tieGroups } = detectarEmpatesReales(tablaConMetadata, partidosDelGrupo, overridesMap);

  // Crear mapa de colores de empate
  const tieColorMap = {};
  if (tieGroups) {
    tieGroups.forEach(group => {
      group.parejaIds.forEach(parejaId => {
        tieColorMap[parejaId] = group.color;
      });
    });
  }

  const hasOverrides = Object.keys(overridesMap).length > 0;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="viewer-section">
      <div class="viewer-section-title">Grupo ${grupo?.nombre ?? ''}</div>
      <div class="viewer-meta">
        Partidos: <strong>${jugados}/${total}</strong>
        ${hasOverrides ? '<span style="font-size:12px; opacity:0.7; margin-left:8px;">📌 Orden manual aplicado</span>' : ''}
        ${tieLabel ? `<span style="font-size:12px; opacity:0.7; margin-left:8px;">⚠️ ${tieLabel}</span>` : ''}
      </div>

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
            ${tablaConMetadata.map((r, idx) => {
              const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
              const tieColor = tieColorMap[r.pareja_id];
              const tieStyle = tieColor ? `background: ${tieColor.bg}; border-left: 4px solid ${tieColor.border};` : '';
              const overrideBadge = r.tieneOverrideAplicado ? ' <span style="font-size:11px; opacity:0.7;" title="Orden manual aplicado">📌</span>' : '';
              
              return `
              <tr class="${rankClass}" style="${tieStyle}">
                <td>${r.nombre}${overrideBadge}</td>
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
        const { tieneResultado, formatearResultado } = await import('./utils/formatoResultado.js');
        const jugado = tieneResultado(p);
        const res = jugado ? formatearResultado(p) : 'Pendiente';
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
            aScore: sf1.sets_a,
            bScore: sf1.sets_b
          }) : `<div class="bracket-empty">Sin Semi 1</div>`}

          ${sf2 ? matchCard({
            title: 'Semi 2',
            aName: sf2.pareja_a?.nombre,
            bName: sf2.pareja_b?.nombre,
            aScore: sf2.sets_a,
            bScore: sf2.sets_b
          }) : `<div class="bracket-empty">Sin Semi 2</div>`}
        </div>

        <div class="bracket-col">
          <div class="bracket-col-title">Final</div>
          ${fin ? matchCard({
            title: 'Final',
            aName: fin.pareja_a?.nombre,
            bName: fin.pareja_b?.nombre,
            aScore: fin.sets_a,
            bScore: fin.sets_b
          }) : `<div class="bracket-empty">Todavía no hay Final</div>`}
        </div>

        <div class="bracket-col">
          <div class="bracket-col-title">3° Puesto</div>
          ${p3 ? matchCard({
            title: '3° Puesto',
            aName: p3.pareja_a?.nombre,
            bName: p3.pareja_b?.nombre,
            aScore: p3.sets_a,
            bScore: p3.sets_b
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
          const { tieneResultado, formatearResultado } = await import('./utils/formatoResultado.js');
          const res = tieneResultado(p) ? formatearResultado(p) : 'Pendiente';
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

// Exponer funciones globales para onclick en HTML
window.app = {
  async cargarResultado(partidoId) {
    const identidad = getIdentidad();
    if (!identidad) return;

    // Buscar partido en cache o fetche ar
    const { data: partido } = await supabase
      .from('partidos')
      .select(`
        id, estado,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        set1_temp_a, set1_temp_b, set2_temp_a, set2_temp_b, set3_temp_a, set3_temp_b,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
        copa_id,
        pareja_a_id, pareja_b_id,
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('id', partidoId)
      .single();

    if (!partido) return;

    mostrarModalCargarResultado(partido, identidad, async (setsOrGamesA, gamesBOrNumSets) => {
      let resultado;
      // Detectar si es modo sets (objeto) o modo legacy (números)
      if (typeof setsOrGamesA === 'object' && setsOrGamesA.set1) {
        // Modo sets
        const { cargarResultadoConSets } = await import('./viewer/cargarResultado.js');
        resultado = await cargarResultadoConSets(supabase, partidoId, setsOrGamesA, gamesBOrNumSets, identidad);
      } else {
        // Modo legacy (games)
        resultado = await cargarResultado(supabase, partidoId, setsOrGamesA, gamesBOrNumSets, identidad);
      }
      
      if (resultado.ok) {
        alert(resultado.mensaje);
        await init('personal'); // Recargar vista personalizada
      } else {
        alert('Error: ' + resultado.mensaje);
      }
    });
  },

  async confirmarResultado(partidoId, gamesA, gamesB) {
    // Versión legacy - mantiene compatibilidad
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

  async confirmarResultadoConSets(partidoId) {
    // Nueva versión que confirma usando los sets ya cargados
    const identidad = getIdentidad();
    if (!identidad) return;

    // Obtener el partido para usar sus sets
    const { data: partido, error } = await supabase
      .from('partidos')
      .select('*')
      .eq('id', partidoId)
      .single();

    if (error || !partido) {
      alert('Error al obtener el partido');
      return;
    }

    // Si tiene sets, confirmar con sets
    if (partido.set1_a !== null && partido.set1_b !== null) {
      // Los sets en DB están en perspectiva absoluta (A/B).
      // cargarResultadoConSets() espera sets en perspectiva del jugador
      // (setA = "mis puntos", setB = "puntos rival") y los rota internamente.
      const soyA = partido.pareja_a_id === identidad.parejaId;
      const sets = {
        set1: { setA: soyA ? partido.set1_a : partido.set1_b, setB: soyA ? partido.set1_b : partido.set1_a },
        set2: { setA: soyA ? partido.set2_a : partido.set2_b, setB: soyA ? partido.set2_b : partido.set2_a }
      };
      if (partido.set3_a !== null && partido.set3_b !== null) {
        sets.set3 = { setA: soyA ? partido.set3_a : partido.set3_b, setB: soyA ? partido.set3_b : partido.set3_a };
      }

      const { cargarResultadoConSets } = await import('./viewer/cargarResultado.js');
      const resultado = await cargarResultadoConSets(supabase, partidoId, sets, partido.num_sets || 3, identidad);

      if (resultado.ok) {
        alert(resultado.mensaje);
        await init('personal');
      } else {
        alert('Error: ' + resultado.mensaje);
      }
    } else {
      alert('No hay resultado cargado para confirmar.');
    }
  },

  async cargarResultadoDiferente(partidoId) {
    // Mismo que cargarResultado pero con mensaje diferente
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

// Iniciar la app con check de identidad
checkIdentidadYCargar();
