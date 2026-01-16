async function cargarOverridesPosiciones(supabase, torneoId) {
  const { data, error } = await supabase
    .from('posiciones_manual')
    .select('grupo_id, pareja_id, orden_manual')
    .eq('torneo_id', torneoId);

  if (error) {
    console.error('Error cargando posiciones_manual', error);
    return {};
  }

  const map = {}; // grupoId -> { parejaId -> orden }
  (data || []).forEach(r => {
    if (r.orden_manual == null) return;
    if (!map[r.grupo_id]) map[r.grupo_id] = {};
    map[r.grupo_id][r.pareja_id] = r.orden_manual;
  });

  return map;
}

function calcularPosiciones(partidos) {
  const grupos = {}; // grupoId -> { id, nombre, parejasMap }

  partidos.forEach(p => {
    const gid = p.grupos?.id;
    const gname = p.grupos?.nombre ?? '?';
    if (!gid) return;

    if (!grupos[gid]) grupos[gid] = { id: gid, nombre: gname, parejas: {} };

    const parejas = [
      { id: p.pareja_a.id, nombre: p.pareja_a.nombre, gf: p.games_a, gc: p.games_b },
      { id: p.pareja_b.id, nombre: p.pareja_b.nombre, gf: p.games_b, gc: p.games_a }
    ];

    parejas.forEach(par => {
      if (!grupos[gid].parejas[par.id]) {
        grupos[gid].parejas[par.id] = {
          pareja_id: par.id,
          nombre: par.nombre,
          PJ: 0,
          PG: 0,
          PP: 0,
          GF: 0,
          GC: 0,
          DG: 0,
          P: 0
        };
      }
    });

    if (p.games_a === null || p.games_b === null) return;

    parejas.forEach(par => {
      const r = grupos[gid].parejas[par.id];
      r.PJ += 1;
      r.GF += Number(par.gf);
      r.GC += Number(par.gc);
      r.DG = r.GF - r.GC;
    });

    const ga = Number(p.games_a);
    const gb = Number(p.games_b);

    if (ga > gb) {
      grupos[gid].parejas[p.pareja_a.id].P += 2;
      grupos[gid].parejas[p.pareja_a.id].PG += 1;

      grupos[gid].parejas[p.pareja_b.id].P += 1;
      grupos[gid].parejas[p.pareja_b.id].PP += 1;
    } else if (gb > ga) {
      grupos[gid].parejas[p.pareja_b.id].P += 2;
      grupos[gid].parejas[p.pareja_b.id].PG += 1;

      grupos[gid].parejas[p.pareja_a.id].P += 1;
      grupos[gid].parejas[p.pareja_a.id].PP += 1;
    } else {
      console.warn('Partido con empate de games, no asigna puntos', p.id);
    }
  });

  return grupos;
}

function ordenarLista(lista, overrideMap) {
  return lista.sort((a, b) => {
    const oa = overrideMap?.[a.pareja_id];
    const ob = overrideMap?.[b.pareja_id];

    const aHas = oa != null;
    const bHas = ob != null;

    if (aHas && bHas) return oa - ob;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;

    if (b.P !== a.P) return b.P - a.P;
    if (b.DG !== a.DG) return b.DG - a.DG;
    return b.GF - a.GF;
  });
}

function renderPosiciones(posicionesCont, grupos, overrides) {
  posicionesCont.innerHTML = '';

  const gruposList = Object.values(grupos).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  gruposList.forEach(g => {
    const lista = Object.values(g.parejas);

    const ovMap = overrides?.[g.id] || null;
    const hayOv = ovMap && Object.keys(ovMap).length > 0;

    ordenarLista(lista, ovMap);

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.marginBottom = '20px';
    table.style.borderCollapse = 'collapse';

    table.innerHTML = `
      <thead>
        <tr>
          <th colspan="8" style="text-align:left; padding:6px 0;">
            Grupo ${g.nombre}
            ${hayOv ? '<span style="font-size:12px; opacity:0.7; margin-left:6px;">(orden manual)</span>' : ''}
          </th>
        </tr>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px 0;">Pareja</th>
          <th title="Partidos jugados" style="border-bottom:1px solid #ddd;">PJ</th>
          <th title="Partidos ganados" style="border-bottom:1px solid #ddd;">PG</th>
          <th title="Partidos perdidos" style="border-bottom:1px solid #ddd;">PP</th>
          <th title="Games a favor" style="border-bottom:1px solid #ddd;">GF</th>
          <th title="Games en contra" style="border-bottom:1px solid #ddd;">GC</th>
          <th title="Diferencia de games" style="border-bottom:1px solid #ddd;">DG</th>
          <th title="Puntos" style="border-bottom:1px solid #ddd;">P</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(p => `
          <tr>
            <td style="padding:6px 0; border-bottom:1px solid #f0f0f0;">${p.nombre}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.PJ}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.PG}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.PP}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.GF}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.GC}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;">${p.DG}</td>
            <td style="text-align:center; border-bottom:1px solid #f0f0f0;"><strong>${p.P}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    `;

    posicionesCont.appendChild(table);
  });
}

export async function cargarPosiciones({ supabase, torneoId, posicionesCont }) {
  const [ovMap, partidosResp] = await Promise.all([
    cargarOverridesPosiciones(supabase, torneoId),
    supabase
      .from('partidos')
      .select(`
        games_a,
        games_b,
        grupos ( id, nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('torneo_id', torneoId)
      .is('copa_id', null)
      .not('games_a', 'is', null)
      .not('games_b', 'is', null)
  ]);

  const { data, error } = partidosResp;

  if (error) {
    console.error('Error cargando posiciones', error);
    return;
  }

  const grupos = calcularPosiciones(data || []);
  renderPosiciones(posicionesCont, grupos, ovMap);
}
