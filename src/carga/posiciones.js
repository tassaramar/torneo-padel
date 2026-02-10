import {
  calcularTablaGrupo,
  ordenarConOverrides,
  detectarEmpatesReales,
  cargarOverrides,
  agregarMetadataOverrides
} from '../utils/tablaPosiciones.js';

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

function calcularPosiciones(partidos, overridesMap) {
  const grupos = {}; // grupoId -> { id, nombre, parejas }

  // Agrupar partidos por grupo
  const partidosPorGrupo = {};
  partidos.forEach(p => {
    const gid = p.grupos?.id;
    if (!gid) return;
    if (!partidosPorGrupo[gid]) partidosPorGrupo[gid] = [];
    partidosPorGrupo[gid].push(p);
  });

  // Calcular tabla para cada grupo usando función centralizada
  Object.keys(partidosPorGrupo).forEach(gid => {
    const partidosGrupo = partidosPorGrupo[gid];
    const primerPartido = partidosGrupo[0];
    const gname = primerPartido.grupos?.nombre ?? '?';

    // Calcular tabla base
    const tablaBase = calcularTablaGrupo(partidosGrupo);

    // Obtener overrides para este grupo
    const ovMap = overridesMap?.[gid] || {};

    // Aplicar overrides (solo en empates reales)
    const tablaOrdenada = ordenarConOverrides(tablaBase, ovMap, partidosGrupo);

    // Agregar metadata de overrides
    const tablaConMetadata = agregarMetadataOverrides(tablaOrdenada, ovMap);

    grupos[gid] = {
      id: gid,
      nombre: gname,
      parejas: tablaConMetadata
    };
  });

  return grupos;
}

function renderPosiciones(posicionesCont, grupos, overrides) {
  posicionesCont.innerHTML = '';

  const gruposList = Object.values(grupos).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

  gruposList.forEach(g => {
    const lista = g.parejas || [];

    const ovMap = overrides?.[g.id] || {};
    const hayOv = ovMap && Object.keys(ovMap).length > 0;

    // Obtener partidos del grupo para detectar empates
    const partidosGrupo = grupos._partidosPorGrupo?.[g.id] || [];
    const { tieGroups } = detectarEmpatesReales(lista, partidosGrupo, ovMap);

    // Crear mapa de colores de empate
    const tieColorMap = {};
    if (tieGroups) {
      tieGroups.forEach(group => {
        group.parejaIds.forEach(parejaId => {
          tieColorMap[parejaId] = group.color;
        });
      });
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.marginBottom = '20px';
    table.style.borderCollapse = 'collapse';

    // Crear thead
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th colspan="11" style="text-align:left; padding:6px 0;">
          Grupo ${g.nombre}
          ${hayOv ? '<span style="font-size:12px; opacity:0.7; margin-left:6px;">(orden manual)</span>' : ''}
        </th>
      </tr>
      <tr>
        <th style="text-align:left; border-bottom:1px solid #ddd; padding:6px 0;">Pareja</th>
        <th title="Partidos jugados" style="border-bottom:1px solid #ddd;">PJ</th>
        <th title="Partidos ganados" style="border-bottom:1px solid #ddd;">PG</th>
        <th title="Partidos perdidos" style="border-bottom:1px solid #ddd;">PP</th>
        <th title="Sets a favor" style="border-bottom:1px solid #ddd; color: #6366f1;">SF</th>
        <th title="Sets en contra" style="border-bottom:1px solid #ddd; color: #6366f1;">SC</th>
        <th title="Diferencia de sets" style="border-bottom:1px solid #ddd; color: #6366f1;">DS</th>
        <th title="Games a favor" style="border-bottom:1px solid #ddd;">GF</th>
        <th title="Games en contra" style="border-bottom:1px solid #ddd;">GC</th>
        <th title="Diferencia de games" style="border-bottom:1px solid #ddd;">DG</th>
        <th title="Puntos" style="border-bottom:1px solid #ddd;">P</th>
      </tr>
    `;

    // Crear tbody con DOM para evitar problemas de HTML embebido
    const tbody = document.createElement('tbody');
    lista.forEach(p => {
      const tr = document.createElement('tr');
      
      // Aplicar color de empate si existe
      if (tieColorMap[p.pareja_id]) {
        const tieColor = tieColorMap[p.pareja_id];
        tr.style.background = tieColor.bg;
        tr.style.borderLeft = `4px solid ${tieColor.border}`;
      }
      
      // Nombre (con negrita para todos)
      const tdNombre = document.createElement('td');
      tdNombre.style.cssText = 'padding:6px 0; border-bottom:1px solid #f0f0f0; font-weight:700 !important;';
      
      // Agregar indicador de override si aplica
      const nombreText = p.nombre || 'Sin nombre';
      const overrideBadge = p.tieneOverrideAplicado ? ' 📌' : '';
      tdNombre.textContent = nombreText + overrideBadge;
      if (p.tieneOverrideAplicado) {
        tdNombre.title = 'Orden manual aplicado';
      }
      tr.appendChild(tdNombre);

      // Resto de columnas (orden: PJ, PG, PP, SF, SC, DS, GF, GC, DG, P)
      const cols = [
        { val: p.PJ },
        { val: p.PG },
        { val: p.PP },
        { val: p.SF, color: '#6366f1' },
        { val: p.SC, color: '#6366f1' },
        { val: p.DS, color: '#6366f1' },
        { val: p.GF },
        { val: p.GC },
        { val: p.DG },
        { val: p.P, strong: true }
      ];

      cols.forEach(col => {
        const td = document.createElement('td');
        td.style.cssText = 'text-align:center; border-bottom:1px solid #f0f0f0;';
        if (col.color) {
          td.style.color = col.color;
        }
        if (col.strong) {
          const strong = document.createElement('strong');
          strong.textContent = col.val;
          td.appendChild(strong);
        } else {
          td.textContent = col.val;
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    posicionesCont.appendChild(table);
  });
}

export async function cargarPosiciones({ supabase, torneoId, posicionesCont }) {
  const [ovMap, partidosResp] = await Promise.all([
    cargarOverridesPosiciones(supabase, torneoId),
    supabase
      .from('partidos')
      .select(`
        id,
        estado,
        pareja_a_id,
        pareja_b_id,
        set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets,
        sets_a, sets_b,
        games_totales_a, games_totales_b,
        grupos ( id, nombre ),
        pareja_a:parejas!partidos_pareja_a_id_fkey ( id, nombre ),
        pareja_b:parejas!partidos_pareja_b_id_fkey ( id, nombre )
      `)
      .eq('torneo_id', torneoId)
      .is('copa_id', null)
  ]);

  const { data, error } = partidosResp;

  if (error) {
    console.error('Error cargando posiciones', error);
    return;
  }

  // Guardar partidos por grupo para detectar empates
  const partidosPorGrupo = {};
  (data || []).forEach(p => {
    const gid = p.grupos?.id;
    if (!gid) return;
    if (!partidosPorGrupo[gid]) partidosPorGrupo[gid] = [];
    partidosPorGrupo[gid].push(p);
  });

  const grupos = calcularPosiciones(data || [], ovMap);
  
  // Agregar partidos por grupo para uso en render
  grupos._partidosPorGrupo = partidosPorGrupo;
  
  renderPosiciones(posicionesCont, grupos, ovMap);
}
