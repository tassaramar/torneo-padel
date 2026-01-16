export function validarScore(gamesA, gamesB) {
  if (gamesA === null || gamesB === null) return { ok: false, msg: 'Completá ambos resultados' };

  if (Number.isNaN(gamesA) || Number.isNaN(gamesB)) return { ok: false, msg: 'Resultado inválido' };
  if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB)) return { ok: false, msg: 'Usá números enteros' };
  if (gamesA < 0 || gamesB < 0) return { ok: false, msg: 'No se permiten números negativos' };

  if (gamesA === gamesB) return { ok: false, msg: 'No se permiten empates (games iguales)' };

  return { ok: true, msg: '' };
}
