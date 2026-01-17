import { state } from './state.js';

export function initCargaLayout() {
  const app = document.getElementById('app');
  if (!app) throw new Error('No existe #app en el HTML');

  let posicionesCont = document.getElementById('posiciones');
  if (!posicionesCont) {
    posicionesCont = document.createElement('div');
    posicionesCont.id = 'posiciones';
    document.body.appendChild(posicionesCont);
  }

  let copasCont = document.getElementById('copas');
  if (!copasCont) {
    copasCont = document.createElement('div');
    copasCont.id = 'copas';
    document.body.appendChild(copasCont);
  }

  // estructura fija
  app.innerHTML = `
    <div id="partidos-controls" style="display:flex; gap:8px; margin-bottom:10px;">
      <button id="btn-pendientes" type="button" style="flex:1; padding:10px; font-size:16px;">Pendientes</button>
      <button id="btn-jugados" type="button" style="flex:1; padding:10px; font-size:16px;">Jugados</button>
    </div>

    <div id="search-row" style="display:flex; gap:8px; margin-bottom:12px;">
      <input
        id="search-partidos"
        type="text"
        autocomplete="off"
        inputmode="search"
        placeholder="Buscar jugador o grupo…"
        style="flex:1; padding:12px; font-size:16px; border:1px solid #ccc; border-radius:10px;"
      />
      <button id="search-clear" type="button" style="padding:12px 14px; font-size:16px; border:1px solid #ccc; border-radius:10px;">
        ✖
      </button>
    </div>

    <div id="partidos-msg" style="margin:10px 0; font-size:14px;"></div>

    <div id="partidos-list"></div>
  `;

  const btnPendientes = document.getElementById('btn-pendientes');
  const btnJugados = document.getElementById('btn-jugados');
  const msgCont = document.getElementById('partidos-msg');
  const listCont = document.getElementById('partidos-list');
  const searchInput = document.getElementById('search-partidos');
  const searchClearBtn = document.getElementById('search-clear');

  // inicializar valor del input con el state
  if (searchInput) searchInput.value = state.search || '';

  return {
    app,
    posicionesCont,
    copasCont,
    btnPendientes,
    btnJugados,
    msgCont,
    listCont,
    searchInput,
    searchClearBtn
  };
}

export function pintarModoToggle(dom) {
  const activeStyle = 'border:2px solid #333; font-weight:700;';
  const normalStyle = 'border:1px solid #ccc; font-weight:400;';

  dom.btnPendientes.style = `flex:1; padding:10px; font-size:16px; ${state.modo === 'pendientes' ? activeStyle : normalStyle}`;
  dom.btnJugados.style = `flex:1; padding:10px; font-size:16px; ${state.modo === 'jugados' ? activeStyle : normalStyle}`;
}

export function wireModoToggle(dom, onChange) {
  dom.btnPendientes.onclick = async () => {
    state.modo = 'pendientes';
    await onChange?.();
  };

  dom.btnJugados.onclick = async () => {
    state.modo = 'jugados';
    await onChange?.();
  };
}
