import { state } from './state.js';
import { validarScore } from './scores.js';

export function crearCardEditable({
  headerLeft,
  headerRight,
  nombreA,
  nombreB,
  gamesA,
  gamesB,
  onSave
}) {
  const div = document.createElement('div');
  div.className = 'partido';

  const esJugado = gamesA !== null && gamesB !== null;
  const labelBtn = state.modo === 'jugados' ? 'Guardar cambios' : 'Guardar';

  div.innerHTML = `
    <div class="card-header">
      <div class="card-header-left">${headerLeft}</div>
      <div class="card-header-right">${headerRight ?? (esJugado ? 'Jugado' : 'Pendiente')}</div>
    </div>

    <div class="row row-a">
      <strong class="team-name name-a">${nombreA ?? 'Pareja A'}</strong>
      <input
        class="input-score input-a"
        type="number"
        inputmode="numeric"
        pattern="[0-9]*"
        min="0"
        step="1"
      />
    </div>

    <div class="row row-b">
      <strong class="team-name name-b">${nombreB ?? 'Pareja B'}</strong>
      <input
        class="input-score input-b"
        type="number"
        inputmode="numeric"
        pattern="[0-9]*"
        min="0"
        step="1"
      />
    </div>

    <div class="actions-row">
      <span class="save-msg"></span>
      <button type="button" class="btn-primary btn-save is-hidden">${labelBtn}</button>
    </div>
  `;

  const inputA = div.querySelector('.input-a');
  const inputB = div.querySelector('.input-b');
  const actionsRow = div.querySelector('.actions-row');
  const btn = div.querySelector('.btn-save');
  const saveMsg = div.querySelector('.save-msg');
  const nameA = div.querySelector('.name-a');
  const nameB = div.querySelector('.name-b');

  if (state.modo === 'jugados') {
    inputA.value = gamesA ?? '';
    inputB.value = gamesB ?? '';
  }

  function pintarGanador() {
    nameA.classList.remove('is-winner');
    nameB.classList.remove('is-winner');

    if (inputA.value === '' || inputB.value === '') return;

    const ga = Number(inputA.value);
    const gb = Number(inputB.value);
    if (Number.isNaN(ga) || Number.isNaN(gb)) return;

    if (ga === gb) return;

    if (ga > gb) nameA.classList.add('is-winner');
    else nameB.classList.add('is-winner');
  }

  function setGuardarVisible(visible) {
    btn.classList.toggle('is-hidden', !visible);

    actionsRow.classList.toggle('is-visible', visible);

    if (!visible) {
      const tieneMensaje = (saveMsg.textContent || '').trim() !== '';
      actionsRow.classList.toggle('has-msg', tieneMensaje);
    } else {
      actionsRow.classList.remove('has-msg');
    }
  }

  function actualizarUIGuardar() {
    const a = inputA.value.trim();
    const b = inputB.value.trim();

    if (a === '' || b === '') {
      saveMsg.textContent = '';
      setGuardarVisible(false);
      return;
    }

    const ga = Number(a);
    const gb = Number(b);

    const v = validarScore(ga, gb);
    if (v.ok) {
      saveMsg.textContent = '';
      setGuardarVisible(true);
    } else {
      saveMsg.textContent = v.msg;
      setGuardarVisible(false);
    }
  }

  function onInputChange() {
    pintarGanador();
    actualizarUIGuardar();
  }

  inputA.addEventListener('input', onInputChange);
  inputB.addEventListener('input', onInputChange);

  setGuardarVisible(false);
  pintarGanador();
  actualizarUIGuardar();

  btn.onclick = async () => {
    if (inputA.value === '' || inputB.value === '') {
      alert('Completá ambos resultados');
      return;
    }

    const ga = Number(inputA.value);
    const gb = Number(inputB.value);

    const v = validarScore(ga, gb);
    if (!v.ok) {
      alert(v.msg);
      return;
    }

    btn.disabled = true;
    const prev = btn.innerText;
    btn.innerText = 'Guardando…';
    saveMsg.textContent = '';
    actionsRow.classList.remove('has-msg');

    const ok = await onSave(ga, gb);

    btn.disabled = false;
    btn.innerText = prev;

    saveMsg.textContent = ok ? '✅ Guardado' : '❌ Error';
    if (!ok) setGuardarVisible(true);
    else setGuardarVisible(false);
  };

  return div;
}
