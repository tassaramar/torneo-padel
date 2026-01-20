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

  // estructura fija (sin estilos inline)
  app.innerHTML = `
    <div id="partidos-controls" class="segmented" role="group" aria-label="Modo de carga">
      <button id="btn-pendientes" class="segmented__btn" type="button" aria-pressed="true">Pendientes</button>
      <button id="btn-jugados" class="segmented__btn" type="button" aria-pressed="false">Jugados</button>
      <button id="btn-disputas" class="segmented__btn" type="button" aria-pressed="false">Disputas</button>
    </div>

    <div id="search-row" class="search">
      <input
        id="search-partidos"
        class="search__input"
        type="text"
        autocomplete="off"
        inputmode="search"
        placeholder="Buscar jugador o grupo…"
      />
      <button id="search-clear" class="btn-icon" type="button" aria-label="Limpiar búsqueda">✖</button>
    </div>

    <div id="partidos-msg" class="search-msg"></div>
    <div id="partidos-list"></div>
  `;

  const btnPendientes = document.getElementById('btn-pendientes');
  const btnJugados = document.getElementById('btn-jugados');
  const btnDisputas = document.getElementById('btn-disputas');
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
    btnDisputas,
    msgCont,
    listCont,
    searchInput,
    searchClearBtn
  };
}

export function pintarModoToggle(dom) {
  const isPendientes = state.modo === 'pendientes';
  const isJugados = state.modo === 'jugados';
  const isDisputas = state.modo === 'disputas';

  dom.btnPendientes.classList.toggle('is-active', isPendientes);
  dom.btnJugados.classList.toggle('is-active', isJugados);
  dom.btnDisputas.classList.toggle('is-active', isDisputas);

  dom.btnPendientes.setAttribute('aria-pressed', String(isPendientes));
  dom.btnJugados.setAttribute('aria-pressed', String(isJugados));
  dom.btnDisputas.setAttribute('aria-pressed', String(isDisputas));
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

  dom.btnDisputas.onclick = async () => {
    state.modo = 'disputas';
    await onChange?.();
  };
}
