export function cmpStatsDesc(a, b) {
  if (b.P !== a.P) return b.P - a.P;
  if (b.DG !== a.DG) return b.DG - a.DG;
  if (b.GF !== a.GF) return b.GF - a.GF;
  return String(a.nombre).localeCompare(String(b.nombre));
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const r = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
