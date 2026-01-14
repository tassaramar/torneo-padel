import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

const cont = document.getElementById('bracket');
const statusEl = document.getElementById('bracket-status');
const btnRefresh = document.getElementById('bracket-refresh');

btnRefresh?.addEventListener('click', () => cargarBracket());

function setStatus(txt) {
  if (statusEl) statusEl.textContent = txt;
}

function teamLine(nombre, score, winner, pending) {
  return `
    <div class="bracket-team ${winner ? 'is-winner' : ''} ${pending ? 'is-pending' : ''}">
      <span class="bracket-team-name">${nombre ?? '—'}</span>
      <span class="bracket-team-score">${score ?? ''}</span>
    </div>
  `;
}

function matchCard({ title, aName, bName, aScore, bScore, winnerSide }) {
  const pending = (aScore === null || bScore === null);

  const aWinner = !pending && winnerSide === 'A';
  const bWinner = !pending && winnerSide === 'B';

  return `
    <div class="bracket-match ${pending ? 'is-pending' : ''}">
      <div class="bracket-match-title">${title}</div>
      ${teamLine(aName, pending ? '' : aScore, aWinner, pending)}
      ${teamLine(bName, pending ? '' : bScore, bWinner, pending)}
    </div>
  `;
}

function winnerSideFromScores(ga, gb) {
  if (ga === null || gb === null) return null;
  if (ga === gb) return null; // por si alguien mete empate, que no explote
  return ga > gb ? 'A' : 'B';
}

function byOrdenCopa(a, b) {
  return (a.orden_copa ?? 999) - (b.orden_copa ?? 999);
}

async function fetchData() {
  const { data: copas, error: errC } = await supabase
    .from('copas')
    .select('id, nombre, orden')
    .eq('torneo_id', TORNEO_ID)
    .order('orden', { ascending: true });

  if (errC) throw errC;

  const { data: partidos, error: errP } = await supabase
    .from('partidos')
    .select(`
      id,
      copa_id,
      ronda_copa,
      orden_copa,
      games_a,
      games_b,
      pareja_a:parejas!partidos_pareja_a_id_fkey ( nombre ),
      pareja_b:parejas!partidos_pareja_b_id_fkey ( nombre )
    `)
    .eq('torneo_id', TORNEO_ID)
    .not('copa_id', 'is', null);

  if (errP) throw errP;

  return { copas: copas || [], partidos: partidos || [] };
}

function groupByCopa(partidos) {
  const map = new Map();
  for (const p of partidos) {
    if (!map.has(p.copa_id)) map.set(p.copa_id, []);
    map.get(p.copa_id).push(p);
  }
  // orden interno
  for (const arr of map.values()) arr.sort(byOrdenCopa);
  return map;
}

function render({ copas, partidos }) {
  cont.innerHTML = '';

  if (!copas.length) {
    cont.innerHTML = `<p>No hay copas todavía. Generalas desde /admin.</p>`;
    return;
  }

  const byCopa = groupByCopa(partidos);

  for (const copa of copas) {
    const arr = byCopa.get(copa.id) || [];

    const sf = arr.filter(x => x.ronda_copa === 'SF').sort(byOrdenCopa);
    const fin = arr.find(x => x.ronda_copa === 'F') || null;
    const p3 = arr.find(x => x.ronda_copa === '3P') || null;

    const sf1 = sf[0] || null;
    const sf2 = sf[1] || null;

    const html = `
      <div class="bracket-copa">
        <div class="bracket-copa-title">🏆 ${copa.nombre}</div>

        <div class="bracket-grid">
          <div class="bracket-col">
            <div class="bracket-col-title">Semis</div>
            ${
              sf1
                ? matchCard({
                    title: `Semi 1`,
                    aName: sf1.pareja_a?.nombre,
                    bName: sf1.pareja_b?.nombre,
                    aScore: sf1.games_a,
                    bScore: sf1.games_b,
                    winnerSide: winnerSideFromScores(sf1.games_a, sf1.games_b),
                  })
                : `<div class="bracket-empty">Sin Semi 1</div>`
            }
            ${
              sf2
                ? matchCard({
                    title: `Semi 2`,
                    aName: sf2.pareja_a?.nombre,
                    bName: sf2.pareja_b?.nombre,
                    aScore: sf2.games_a,
                    bScore: sf2.games_b,
                    winnerSide: winnerSideFromScores(sf2.games_a, sf2.games_b),
                  })
                : `<div class="bracket-empty">Sin Semi 2</div>`
            }
          </div>

          <div class="bracket-col">
            <div class="bracket-col-title">Final</div>
            ${
              fin
                ? matchCard({
                    title: `Final`,
                    aName: fin.pareja_a?.nombre,
                    bName: fin.pareja_b?.nombre,
                    aScore: fin.games_a,
                    bScore: fin.games_b,
                    winnerSide: winnerSideFromScores(fin.games_a, fin.games_b),
                  })
                : `<div class="bracket-empty">Todavía no hay Final</div>`
            }
          </div>

          <div class="bracket-col">
            <div class="bracket-col-title">3° Puesto</div>
            ${
              p3
                ? matchCard({
                    title: `3/4`,
                    aName: p3.pareja_a?.nombre,
                    bName: p3.pareja_b?.nombre,
                    aScore: p3.games_a,
                    bScore: p3.games_b,
                    winnerSide: winnerSideFromScores(p3.games_a, p3.games_b),
                  })
                : `<div class="bracket-empty">Todavía no hay 3° Puesto</div>`
            }
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    cont.appendChild(wrapper.firstElementChild);
  }
}

async function cargarBracket() {
  try {
    setStatus('Cargando…');
    const { copas, partidos } = await fetchData();
    render({ copas, partidos });

    const now = new Date();
    setStatus(`Actualizado ${now.toLocaleTimeString()}`);
  } catch (e) {
    console.error(e);
    setStatus('❌ Error cargando bracket (ver consola)');
    cont.innerHTML = `<p>❌ Error cargando bracket. Probablemente RLS o query.</p>`;
  }
}

cargarBracket();
