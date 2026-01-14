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

  const tieSet = new Set();
  const sizes = [];

  for (const arr of buckets.values()) {
    if (arr.length >= 2) {
      sizes.push(arr.length);
      arr.forEach(x => tieSet.add(x.pareja_id));
    }
  }

  let tieLabel = '';
  if (sizes.length) {
    sizes.sort((a, b) => b - a);
    tieLabel = `Empate real: ${sizes.join(' + ')}`;
  }

  return { tieSet, tieLabel };
}
