import { cmpStandings, armarPoolParaCopa, seedingMejorPeor, optimizarEndogenos, detectarEmpates } from '../src/utils/copaMatchups.js';

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}\n     got:      ${JSON.stringify(actual)}\n     expected: ${JSON.stringify(expected)}`); failed++; }
}
function assertTrue(label, val) {
  if (val) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label} (got falsy)`); failed++; }
}

// ─── Test 1: cmpStandings ─────────────────────────────────────
console.log('\n[cmpStandings]');
const s = (puntos, ds, dg, gf, sorteo_orden, nombre) => ({ puntos, ds, dg, gf, sorteo_orden, nombre });
const arr = [
  s(6, 2, 4, 20, null, 'A'),
  s(6, 2, 2, 20, null, 'B'),
  s(6, 2, 4, 18, null, 'C'),
  s(4, 0, 0, 10, 2, 'D'),
  s(4, 0, 0, 10, 1, 'E'),
];
const sorted = [...arr].sort(cmpStandings);
assert('1° = A (mayor dg)', sorted[0].nombre, 'A');
assert('2° = C (mismo dg que A, menor gf)', sorted[1].nombre, 'C');
assert('3° = B (menor dg)', sorted[2].nombre, 'B');
assert('4° = E (sorteo_orden 1)', sorted[3].nombre, 'E');
assert('5° = D (sorteo_orden 2)', sorted[4].nombre, 'D');

// ─── Test 2: seedingMejorPeor — 2 equipos ─────────────────────
console.log('\n[seedingMejorPeor — 2 equipos]');
const p2 = [{ nombre: 'A1', grupoId: 'gA' }, { nombre: 'B1', grupoId: 'gB' }];
const c2 = seedingMejorPeor(p2);
assert('ronda = direct', c2[0].ronda, 'direct');
assert('parejaA = A1', c2[0].parejaA.nombre, 'A1');
assert('parejaB = B1', c2[0].parejaB.nombre, 'B1');
assert('no endogeno', c2[0].endogeno, false);

// ─── Test 3: seedingMejorPeor — 3 equipos (bye) ───────────────
console.log('\n[seedingMejorPeor — 3 equipos]');
const p3 = [{ nombre: '1', grupoId: 'gA' }, { nombre: '2', grupoId: 'gB' }, { nombre: '3', grupoId: 'gC' }];
const c3 = seedingMejorPeor(p3);
assert('1 cruce SF (bye al mejor)', c3.length, 1);
assert('SF: 2 vs 3', c3[0].parejaA.nombre + ' vs ' + c3[0].parejaB.nombre, '2 vs 3');

// ─── Test 4: seedingMejorPeor — 4 equipos con endógenos ────────
console.log('\n[seedingMejorPeor — 4 equipos]');
const pool4 = [
  { nombre: 'A1', grupoId: 'gA', pareja_id: 'a1' },
  { nombre: 'B1', grupoId: 'gB', pareja_id: 'b1' },
  { nombre: 'B2', grupoId: 'gB', pareja_id: 'b2' },
  { nombre: 'A2', grupoId: 'gA', pareja_id: 'a2' }
];
const c4 = seedingMejorPeor(pool4);
assert('SF1: A1 vs A2', c4[0].parejaA.nombre + ' vs ' + c4[0].parejaB.nombre, 'A1 vs A2');
assert('SF1 endogeno', c4[0].endogeno, true);
assert('SF2: B1 vs B2', c4[1].parejaA.nombre + ' vs ' + c4[1].parejaB.nombre, 'B1 vs B2');
assert('SF2 endogeno', c4[1].endogeno, true);

// ─── Test 5: seedingMejorPeor — 8 equipos ─────────────────────
console.log('\n[seedingMejorPeor — 8 equipos]');
const pool8 = [
  { nombre: 'A1', grupoId: 'gA', pareja_id: 'a1' },
  { nombre: 'B1', grupoId: 'gB', pareja_id: 'b1' },
  { nombre: 'C1', grupoId: 'gC', pareja_id: 'c1' },
  { nombre: 'D1', grupoId: 'gD', pareja_id: 'd1' },
  { nombre: 'D2', grupoId: 'gD', pareja_id: 'd2' },
  { nombre: 'C2', grupoId: 'gC', pareja_id: 'c2' },
  { nombre: 'B2', grupoId: 'gB', pareja_id: 'b2' },
  { nombre: 'A2', grupoId: 'gA', pareja_id: 'a2' }
];
const c8 = seedingMejorPeor(pool8);
assert('QF1: A1 vs A2', c8[0].parejaA.nombre + ' vs ' + c8[0].parejaB.nombre, 'A1 vs A2');
assert('QF2: B1 vs B2', c8[1].parejaA.nombre + ' vs ' + c8[1].parejaB.nombre, 'B1 vs B2');
assert('QF3: C1 vs C2', c8[2].parejaA.nombre + ' vs ' + c8[2].parejaB.nombre, 'C1 vs C2');
assert('QF4: D1 vs D2', c8[3].parejaA.nombre + ' vs ' + c8[3].parejaB.nombre, 'D1 vs D2');
assertTrue('todos endogenos antes de optimizar', c8.every(c => c.endogeno));

// ─── Test 6: optimizarEndogenos — 4 grupos (resolución) ───────
console.log('\n[optimizarEndogenos — 4 grupos]');
const opt8 = optimizarEndogenos(c8, new Set());
assert('QF1: A1 vs B2 (cross)', opt8[0].parejaA.nombre + ' vs ' + opt8[0].parejaB.nombre, 'A1 vs B2');
assert('QF1 no endogeno', opt8[0].endogeno, false);
assert('QF2: B1 vs A2 (cross)', opt8[1].parejaA.nombre + ' vs ' + opt8[1].parejaB.nombre, 'B1 vs A2');
assert('QF2 no endogeno', opt8[1].endogeno, false);
assert('QF3: C1 vs D2 (cross)', opt8[2].parejaA.nombre + ' vs ' + opt8[2].parejaB.nombre, 'C1 vs D2');
assert('QF4: D1 vs C2 (cross)', opt8[3].parejaA.nombre + ' vs ' + opt8[3].parejaB.nombre, 'D1 vs C2');
assertTrue('todos no-endogenos', opt8.every(c => !c.endogeno));

// ─── Test 7: optimizarEndogenos — 1 grupo (irresolvable) ──────
console.log('\n[optimizarEndogenos — 1 grupo]');
const pool1g = [
  { nombre: 'E1', grupoId: 'g1', pareja_id: 'e1' },
  { nombre: 'E2', grupoId: 'g1', pareja_id: 'e2' },
  { nombre: 'E3', grupoId: 'g1', pareja_id: 'e3' },
  { nombre: 'E4', grupoId: 'g1', pareja_id: 'e4' }
];
const c1g = seedingMejorPeor(pool1g);
const opt1g = optimizarEndogenos(c1g, new Set());
assertTrue('todos endogenos (irresolvable)', opt1g.every(c => c.endogeno === true));

// ─── Test 8: optimizarEndogenos — no muta input ────────────────
console.log('\n[optimizarEndogenos — inmutabilidad]');
const c8snapshot = JSON.stringify(c8);
optimizarEndogenos(c8, new Set());
assertTrue('c8 no mutado', JSON.stringify(c8) === c8snapshot);

// ─── Test 9: optimizarEndogenos — equipos protegidos ──────────
console.log('\n[optimizarEndogenos — equipos protegidos]');
const c4b = seedingMejorPeor(pool4);
// a2 es parejaB de SF1 (endógeno) — si está protegido, no se puede mover
const opt4prot = optimizarEndogenos(c4b, new Set(['a2']));
assert('SF1 sigue endogeno (a2 protegido)', opt4prot[0].endogeno, true);

// ─── Test 10: armarPoolParaCopa — modo global ──────────────────
console.log('\n[armarPoolParaCopa — global]');
const standings = [
  { pareja_id: 'p1', grupo_id: 'gA', puntos: 6, ds: 2, dg: 4, gf: 20, posicion_en_grupo: 1, grupo_completo: true, grupoNombre: 'A', nombre: 'X1' },
  { pareja_id: 'p2', grupo_id: 'gB', puntos: 6, ds: 2, dg: 2, gf: 20, posicion_en_grupo: 1, grupo_completo: true, grupoNombre: 'B', nombre: 'Y1' },
  { pareja_id: 'p3', grupo_id: 'gA', puntos: 4, ds: 0, dg: 0, gf: 15, posicion_en_grupo: 2, grupo_completo: true, grupoNombre: 'A', nombre: 'X2' },
  { pareja_id: 'p4', grupo_id: 'gB', puntos: 2, ds: -2, dg: -4, gf: 10, posicion_en_grupo: 2, grupo_completo: true, grupoNombre: 'B', nombre: 'Y2' },
];
const grupos = [{ id: 'gA', nombre: 'A' }, { id: 'gB', nombre: 'B' }];
const reglaGlobal = [{ modo: 'global', desde: 1, hasta: 2 }];
const { pool: poolG, pendientes: pendG } = armarPoolParaCopa(standings, grupos, reglaGlobal, new Set());
assert('pool global tiene 2 eq', poolG.length, 2);
assert('seed1 = X1 (mayor dg)', poolG[0].nombre, 'X1');
assert('seed2 = Y1', poolG[1].nombre, 'Y1');
assert('no pendientes (todos completos)', pendG.length, 0);

// Excluir equipos ya usados
const { pool: poolExc } = armarPoolParaCopa(standings, grupos, reglaGlobal, new Set(['p1']));
assert('excluye p1 → seed1 = Y1', poolExc[0].nombre, 'Y1');

// Grupo incompleto
const standingsInc = standings.map(s => s.grupo_id === 'gB' ? { ...s, grupo_completo: false } : s);
const { pool: poolInc, pendientes: pendInc } = armarPoolParaCopa(standingsInc, grupos, reglaGlobal, new Set());
// Con gB incompleto, el global toma los top 2 de grupos completos (ambos de gA)
assert('pool = 2 eq de gA (gB incompleto)', poolInc.length, 2);
assert('pendiente gB reportado', pendInc[0].grupoId, 'gB');

// ─── Test 11: armarPoolParaCopa — modo posición ────────────────
console.log('\n[armarPoolParaCopa — posicion]');
const reglaPos = [{ posicion: 1 }, { posicion: 2, criterio: 'mejor', cantidad: 1 }];
const { pool: poolP } = armarPoolParaCopa(standings, grupos, reglaPos, new Set());
assert('3 eq (2 primeros + mejor 2°)', poolP.length, 3);
assert('seed3 = X2 (mejor 2°, mayor dg)', poolP[2].nombre, 'X2');

// ─── Test 12: detectarEmpates — empate_frontera ────────────────
console.log('\n[detectarEmpates — empate_frontera]');
const standingsEmp = [
  { pareja_id: 'p1', grupo_id: 'gA', puntos: 6, ds: 2, dg: 4, gf: 20, posicion_en_grupo: 1, grupo_completo: true, grupoNombre: 'A', nombre: 'X1' },
  { pareja_id: 'p2', grupo_id: 'gB', puntos: 4, ds: 0, dg: 0, gf: 15, posicion_en_grupo: 1, grupo_completo: true, grupoNombre: 'B', nombre: 'Y1' },
  { pareja_id: 'p3', grupo_id: 'gA', puntos: 4, ds: 0, dg: 0, gf: 15, posicion_en_grupo: 2, grupo_completo: true, grupoNombre: 'A', nombre: 'X2' },
];
const poolEmp = [
  { ...standingsEmp[0], seed: 1, grupoId: 'gA' },
  { ...standingsEmp[1], seed: 2, grupoId: 'gB' },
];
const { warnings: warnEmp } = detectarEmpates(poolEmp, standingsEmp, [{ modo: 'global', desde: 1, hasta: 2 }]);
assertTrue('detecta empate_frontera', warnEmp.some(w => w.tipo === 'empate_frontera'));
const ef = warnEmp.find(w => w.tipo === 'empate_frontera');
assert('2 equipos empatados en frontera', ef?.equipos.length, 2);

// ─── Test 13: detectarEmpates — empate_inter_grupo ────────────
console.log('\n[detectarEmpates — empate_inter_grupo]');
const standingsInterEmp = [
  { pareja_id: 'p1', grupo_id: 'gA', puntos: 6, ds: 2, dg: 4, gf: 20, posicion_en_grupo: 1, grupo_completo: true, grupoNombre: 'A', nombre: 'A1', sorteo_orden: null },
  { pareja_id: 'p2', grupo_id: 'gB', puntos: 6, ds: 2, dg: 4, gf: 20, posicion_en_grupo: 1, grupo_completo: true, grupoNombre: 'B', nombre: 'B1', sorteo_orden: null },
];
const poolInter = standingsInterEmp.map((t, i) => ({ ...t, seed: i+1, grupoId: t.grupo_id }));
const { warnings: warnInter } = detectarEmpates(poolInter, standingsInterEmp, [{ posicion: 1 }]);
assertTrue('detecta empate_inter_grupo', warnInter.some(w => w.tipo === 'empate_inter_grupo'));
const ei = warnInter.find(w => w.tipo === 'empate_inter_grupo');
assert('resueltoPorSorteo = false', ei?.resueltoPorSorteo, false);

// Resuelto por sorteo
const standingsSorteo = standingsInterEmp.map((t, i) => ({ ...t, sorteo_orden: i + 1 }));
const poolSorteo = standingsSorteo.map((t, i) => ({ ...t, seed: i+1, grupoId: t.grupo_id }));
const { warnings: warnSorteo } = detectarEmpates(poolSorteo, standingsSorteo, [{ posicion: 1 }]);
assertTrue('sin warning si resueltoPorSorteo', !warnSorteo.some(w => w.tipo === 'empate_inter_grupo'));

// ─── Test 14: detectarEmpates — empate_intra_grupo ────────────
console.log('\n[detectarEmpates — empate_intra_grupo]');
const standingsIntra = [
  { pareja_id: 'p1', grupo_id: 'gA', puntos: 4, ds: 0, dg: 0, gf: 10, posicion_en_grupo: 1, grupo_completo: true, grupoNombre: 'A', nombre: 'A1' },
  { pareja_id: 'p2', grupo_id: 'gA', puntos: 4, ds: 0, dg: 0, gf: 10, posicion_en_grupo: 2, grupo_completo: true, grupoNombre: 'A', nombre: 'A2' },
  { pareja_id: 'p3', grupo_id: 'gA', puntos: 4, ds: 0, dg: 0, gf: 10, posicion_en_grupo: 3, grupo_completo: true, grupoNombre: 'A', nombre: 'A3' },
];
const { warnings: warnIntra } = detectarEmpates([], standingsIntra, []);
assertTrue('detecta empate_intra_grupo (3+)', warnIntra.some(w => w.tipo === 'empate_intra_grupo'));
const eit = warnIntra.find(w => w.tipo === 'empate_intra_grupo');
assert('grupo A', eit?.grupoNombre, 'A');
assert('3 equipos empatados', eit?.equipos.length, 3);

// ─── Test 15: optimizarEndogenos — 2 grupos seeding global ─────
console.log('\n[optimizarEndogenos — 2 grupos, seeding global]');
// Con 2 grupos y seeding global, los mejores pueden coincidir en el mismo grupo
// seed1:gA, seed2:gA, seed3:gB, seed4:gB → SF1: seed1 vs seed4 (cross ok), SF2: seed2 vs seed3 (cross ok)
const pool2g = [
  { nombre: 'A1', grupoId: 'gA', pareja_id: 'a1' },
  { nombre: 'A2', grupoId: 'gA', pareja_id: 'a2' },
  { nombre: 'B1', grupoId: 'gB', pareja_id: 'b1' },
  { nombre: 'B2', grupoId: 'gB', pareja_id: 'b2' }
];
const c2g = seedingMejorPeor(pool2g);
// SF1: A1 vs B2 (cross) — no endogeno ya de entrada
assert('SF1: A1 vs B2', c2g[0].parejaA.nombre + ' vs ' + c2g[0].parejaB.nombre, 'A1 vs B2');
assert('SF1 no endogeno', c2g[0].endogeno, false);
// SF2: A2 vs B1 (cross) — no endogeno
assert('SF2: A2 vs B1', c2g[1].parejaA.nombre + ' vs ' + c2g[1].parejaB.nombre, 'A2 vs B1');
assert('SF2 no endogeno', c2g[1].endogeno, false);

// ─── Resumen ──────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
