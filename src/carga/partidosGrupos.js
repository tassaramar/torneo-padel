import { state } from './state.js';
import { crearCardEditable } from './cardEditable.js';
import { obtenerFrasesUnicas } from '../utils/frasesFechaLibre.js';

async function guardarResultado(supabase, partidoId, gamesA, gamesB) {
  const { error } = await supabase
    .from('partidos')
    .update({ games_a: gamesA, games_b: gamesB })
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
      games_a,
      games_b,
      estado,
      cargado_por_pareja_id,
      resultado_temp_a,
      resultado_temp_b,
      notas_revision,
      ronda,
      grupos ( nombre ),
      pareja_a:parejas!partidos_pareja_a_id_fkey ( nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( nombre )
    `)
    .eq('torneo_id', torneoId)
    .is('copa_id', null);

  if (state.modo === 'pendientes') {
    q = q.or('games_a.is.null,games_b.is.null');
  } else if (state.modo === 'jugados') {
    q = q.not('games_a', 'is', null).not('games_b', 'is', null);
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
 * Retorna array de rondas con estructura:
 * [
 *   { grupo: 'A', ronda: 1, partidos: [...], parejasLibres: [...] },
 *   { grupo: 'A', ronda: 2, partidos: [...], parejasLibres: [...] },
 *   ...
 * ]
 */
export function agruparEnRondas(partidos) {
  const rondas = [];
  
  // Separar partidos por grupo
  const porGrupo = {};
  partidos.forEach(p => {
    const grupo = p.grupos?.nombre ?? 'Sin Grupo';
    if (!porGrupo[grupo]) porGrupo[grupo] = [];
    porGrupo[grupo].push(p);
  });
  
  // Procesar cada grupo independientemente
  Object.keys(porGrupo).sort().forEach(nombreGrupo => {
    const partidosGrupo = [...porGrupo[nombreGrupo]];
    
    // Extraer todos los equipos del grupo
    const equiposSet = new Set();
    partidosGrupo.forEach(p => {
      if (p.pareja_a?.nombre) equiposSet.add(p.pareja_a.nombre);
      if (p.pareja_b?.nombre) equiposSet.add(p.pareja_b.nombre);
    });
    const equipos = Array.from(equiposSet).sort();
    
    // Agrupar partidos por número de ronda (del campo ronda de la BD)
    const partidosPorRonda = {};
    partidosGrupo.forEach(p => {
      const numRonda = p.ronda || 1; // Default a 1 si no tiene ronda
      if (!partidosPorRonda[numRonda]) {
        partidosPorRonda[numRonda] = [];
      }
      partidosPorRonda[numRonda].push(p);
    });
    
    // Crear entrada de ronda para cada número de ronda
    const numerosRonda = Object.keys(partidosPorRonda).map(Number).sort((a, b) => a - b);
    
    numerosRonda.forEach(numRonda => {
      const partidosRonda = partidosPorRonda[numRonda];
      const parejasEnUso = new Set();
      
      // Recolectar parejas que juegan en esta ronda
      partidosRonda.forEach(p => {
        if (p.pareja_a?.nombre) parejasEnUso.add(p.pareja_a.nombre);
        if (p.pareja_b?.nombre) parejasEnUso.add(p.pareja_b.nombre);
      });
      
      // Calcular parejas libres (no juegan en esta ronda)
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

  // En modo 'disputas', no separar en revisión (ya están todos en revisión)
  // En otros modos, separarlos
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
      
      // a_confirmar primero
      if (estadoA === 'a_confirmar' && estadoB !== 'a_confirmar') return -1;
      if (estadoB === 'a_confirmar' && estadoA !== 'a_confirmar') return 1;
      
      return 0; // Mantener orden original para el resto
    });
  }

  // Agrupar en rondas si es modo pendientes
  if (state.modo === 'pendientes') {
    const rondas = agruparEnRondas(partidosNormales);
    
    // Contar total de parejas libres para generar frases únicas
    const totalParejasLibres = rondas.reduce((sum, r) => sum + r.parejasLibres.length, 0);
    const frases = obtenerFrasesUnicas(totalParejasLibres);
    let fraseIndex = 0;
    
    rondas.forEach((rondaData) => {
      // Separador de ronda
      const separator = document.createElement('div');
      separator.style.cssText = 'margin: 24px 0 8px; padding: 8px 12px; background: var(--primary-soft); border-left: 4px solid var(--primary); border-radius: 8px; font-weight: 700; font-size: 14px; color: var(--text);';
      
      let headerText = `Ronda ${rondaData.ronda} — Grupo ${rondaData.grupo} — ${rondaData.partidos.length} partido${rondaData.partidos.length > 1 ? 's' : ''} en paralelo`;
      separator.textContent = headerText;
      listCont.appendChild(separator);
      
      // Partidos de la ronda
      rondaData.partidos.forEach((p) => {
        const card = crearCardParaPartido(p, supabase, onAfterSave);
        listCont.appendChild(card);
      });
      
      // Parejas libres (fecha libre)
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

  // zebra inicial (sin filtro)
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
  if (p.games_a !== null && p.games_b !== null && estado === 'pendiente') estadoDisplay = 'Jugado';

  const card = crearCardEditable({
    headerLeft: `Grupo <strong>${grupo}</strong>`,
    headerRight: estadoDisplay,
    nombreA: a,
    nombreB: b,
    gamesA: p.games_a,
    gamesB: p.games_b,
    onSave: async (ga, gb) => {
      // Admin puede forzar confirmado directamente
      const { error } = await supabase
        .from('partidos')
        .update({ 
          games_a: ga, 
          games_b: gb,
          estado: 'confirmado', // Admin confirma directo
          resultado_temp_a: null,
          resultado_temp_b: null,
          cargado_por_pareja_id: null
        })
        .eq('id', p.id);

      if (error) {
        console.error(error);
        alert('Error guardando el resultado');
        return false;
      }
      
      if (onAfterSave) await onAfterSave();
      return true;
    }
  });

  // Extra: ayuda al filtro (fallback), sin depender del DOM
  card.dataset.search = `${grupo} ${a} ${b}`;
  
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
        <div style="font-size: 22px; font-weight: 900;">${p.games_a} - ${p.games_b}</div>
      </div>
      
      <div style="display: flex; align-items: center; font-weight: 800; color: var(--muted);">vs</div>
      
      <div style="flex: 1; text-align: center; padding: 10px; background: var(--card); border: 2px solid var(--border); border-radius: 8px;">
        <div style="font-size: 11px; color: var(--muted); margin-bottom: 4px; font-weight: 700;">SEGUNDA CARGA</div>
        <div style="font-size: 22px; font-weight: 900;">${p.resultado_temp_a} - ${p.resultado_temp_b}</div>
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

  // Event listeners
  card.querySelector('[data-action="aceptar-1"]').addEventListener('click', async () => {
    if (!confirm(`¿Aceptar resultado ${p.games_a}-${p.games_b}?`)) return;
    
    const { error } = await supabase
      .from('partidos')
      .update({
        estado: 'confirmado',
        resultado_temp_a: null,
        resultado_temp_b: null,
        notas_revision: null
      })
      .eq('id', p.id);

    if (error) {
      console.error(error);
      alert('Error guardando');
      return;
    }

    alert('✅ Conflicto resuelto');
    if (onAfterSave) await onAfterSave();
  });

  card.querySelector('[data-action="aceptar-2"]').addEventListener('click', async () => {
    if (!confirm(`¿Aceptar resultado ${p.resultado_temp_a}-${p.resultado_temp_b}?`)) return;
    
    const { error } = await supabase
      .from('partidos')
      .update({
        games_a: p.resultado_temp_a,
        games_b: p.resultado_temp_b,
        estado: 'confirmado',
        resultado_temp_a: null,
        resultado_temp_b: null,
        notas_revision: null
      })
      .eq('id', p.id);

    if (error) {
      console.error(error);
      alert('Error guardando');
      return;
    }

    alert('✅ Conflicto resuelto');
    if (onAfterSave) await onAfterSave();
  });

  card.querySelector('[data-action="manual"]').addEventListener('click', () => {
    const gA = prompt('Ingresá games de ' + a + ':', p.games_a);
    const gB = prompt('Ingresá games de ' + b + ':', p.games_b);
    
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
        games_a: gamesA,
        games_b: gamesB,
        estado: 'confirmado',
        resultado_temp_a: null,
        resultado_temp_b: null,
        notas_revision: null
      })
      .eq('id', p.id)
      .then(({ error }) => {
        if (error) {
          console.error(error);
          alert('Error guardando');
          return;
        }
        alert('✅ Resultado guardado');
        if (onAfterSave) onAfterSave();
      });
  });

  card.dataset.search = `${grupo} ${a} ${b}`;
  
  return card;
}
