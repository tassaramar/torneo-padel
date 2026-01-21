import { cmpStatsDesc } from '../utils.js';

export function calcularTablaGrupo(partidos) {
  const map = {};

  function init(p) {
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
    const a = init(m.pareja_a);
    const b = init(m.pareja_b);

    const jugado = m.games_a !== null && m.games_b !== null;
    if (!jugado) continue;

    const ga = Number(m.games_a);
    const gb = Number(m.games_b);

    a.PJ += 1; b.PJ += 1;
    a.GF += ga; a.GC += gb;
    b.GF += gb; b.GC += ga;
    a.DG = a.GF - a.GC;
    b.DG = b.GF - b.GC;

    // 2 ganar / 1 perder
    if (ga > gb) {
      a.PG += 1; b.PP += 1;
      a.P += 2; b.P += 1;
    } else if (gb > ga) {
      b.PG += 1; a.PP += 1;
      b.P += 2; a.P += 1;
    }
  }

  return Object.values(map);
}

export function ordenarAutomatico(rows) {
  return [...rows].sort(cmpStatsDesc);
}

export function ordenarConOverrides(rows, ovMap) {
  const auto = ordenarAutomatico(rows);

  const keys = Object.keys(ovMap || {});
  if (!keys.length) return auto;

  const withOv = [];
  const withoutOv = [];

  for (const r of auto) {
    const om = ovMap[r.pareja_id];
    if (om !== undefined) withOv.push({ ...r, _om: om });
    else withoutOv.push(r);
  }

  withOv.sort((a, b) => a._om - b._om);

  return [
    ...withOv.map(x => {
      const { _om, ...rest } = x;
      return rest;
    }),
    ...withoutOv
  ];
}

export function detectarEmpatesReales(rows) {
  const buckets = new Map();
  for (const r of rows) {
    const key = `${r.P}|${r.DG}|${r.GF}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }

  // Colores para diferentes grupos de empate
  const colors = [
    { bg: '#fff3cd', border: '#d39e00' }, // Amarillo
    { bg: '#e3f2fd', border: '#1976d2' }, // Azul
    { bg: '#e8f5e9', border: '#43a047' }, // Verde
    { bg: '#fce4ec', border: '#c2185b' }, // Rosa
    { bg: '#f3e5f5', border: '#7b1fa2' }, // Púrpura
    { bg: '#fff8e1', border: '#f57c00' }, // Naranja claro
  ];

  const tieGroups = [];
  const tieSet = new Set();
  const sizes = [];
  let colorIndex = 0;

  for (const arr of buckets.values()) {
    if (arr.length >= 2) {
      sizes.push(arr.length);
      const color = colors[colorIndex % colors.length];
      
      const group = {
        parejaIds: arr.map(x => x.pareja_id),
        color: color,
        size: arr.length
      };
      
      tieGroups.push(group);
      arr.forEach(x => tieSet.add(x.pareja_id));
      colorIndex++;
    }
  }

  let tieLabel = '';
  if (sizes.length) {
    sizes.sort((a, b) => b - a);
    tieLabel = `Empate real: ${sizes.join(' + ')}`;
  }

  return { tieSet, tieLabel, tieGroups };
}
