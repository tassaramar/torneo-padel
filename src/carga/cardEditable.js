import { state } from './state.js';
import { validarScore } from './scores.js';

export function crearCardEditable({
  headerLeft,
  headerRight,
  nombreA,
  nombreB,
  gamesA,
  gamesB,
  onSave,
  formatoSets = 1,
  setsData = null
}) {
  const div = document.createElement('div');
  div.className = 'partido';

  const esJugado = gamesA !== null && gamesB !== null;
  const labelBtn = state.modo === 'jugados' ? 'Guardar cambios' : 'Guardar';

  if (formatoSets === 3) {
    return crearCardMultiSet({ div, headerLeft, headerRight, nombreA, nombreB, esJugado, labelBtn, onSave, setsData });
  }

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

  // Pre-rellenar si hay scores (jugados o confirmar)
  if (gamesA !== null && gamesA !== undefined && gamesB !== null && gamesB !== undefined) {
    inputA.value = gamesA;
    inputB.value = gamesB;
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

/**
 * Variante multi-set de la card editable (formato "al mejor de 3 sets")
 * Muestra 2 filas de inputs (set1+set2) con set3 condicional si hay empate 1-1.
 * onSave recibe un objeto: { set1_a, set1_b, set2_a, set2_b, set3_a, set3_b, num_sets }
 */
function crearCardMultiSet({ div, headerLeft, headerRight, nombreA, nombreB, esJugado, labelBtn, onSave, setsData }) {
  const s = setsData || {};

  div.innerHTML = `
    <div class="card-header">
      <div class="card-header-left">${headerLeft}</div>
      <div class="card-header-right">${headerRight ?? (esJugado ? 'Jugado' : 'Pendiente')}</div>
    </div>

    <div class="multiset-grid">
      <div class="multiset-header" style="grid-row:1; grid-column:1;"></div>
      <div class="multiset-header" style="grid-row:1; grid-column:2; text-align:center; font-size:12px; font-weight:700; color:var(--muted);">Set 1</div>
      <div class="multiset-header" style="grid-row:1; grid-column:3; text-align:center; font-size:12px; font-weight:700; color:var(--muted);">Set 2</div>
      <div class="multiset-header multiset-set3-header" style="grid-row:1; grid-column:4; text-align:center; font-size:12px; font-weight:700; color:var(--muted); display:none;">STB</div>

      <strong class="team-name name-a" style="grid-row:2; grid-column:1;">${nombreA ?? 'Pareja A'}</strong>
      <strong class="team-name name-b" style="grid-row:3; grid-column:1;">${nombreB ?? 'Pareja B'}</strong>

      <input class="input-score input-s1a" type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" style="grid-row:2; grid-column:2;" />
      <input class="input-score input-s1b" type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" style="grid-row:3; grid-column:2;" />
      <input class="input-score input-s2a" type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" style="grid-row:2; grid-column:3;" />
      <input class="input-score input-s2b" type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" style="grid-row:3; grid-column:3;" />
      <input class="input-score input-s3a multiset-set3" type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" style="display:none; grid-row:2; grid-column:4;" />
      <input class="input-score input-s3b multiset-set3" type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" style="display:none; grid-row:3; grid-column:4;" />
    </div>

    <div class="actions-row">
      <span class="save-msg"></span>
      <button type="button" class="btn-primary btn-save is-hidden">${labelBtn}</button>
    </div>
  `;

  const s1a = div.querySelector('.input-s1a');
  const s1b = div.querySelector('.input-s1b');
  const s2a = div.querySelector('.input-s2a');
  const s2b = div.querySelector('.input-s2b');
  const s3a = div.querySelector('.input-s3a');
  const s3b = div.querySelector('.input-s3b');
  const set3Header = div.querySelector('.multiset-set3-header');
  const actionsRow = div.querySelector('.actions-row');
  const btn = div.querySelector('.btn-save');
  const saveMsg = div.querySelector('.save-msg');
  const nameA = div.querySelector('.name-a');
  const nameB = div.querySelector('.name-b');

  // Pre-fill
  if (s.set1_a != null) s1a.value = s.set1_a;
  if (s.set1_b != null) s1b.value = s.set1_b;
  if (s.set2_a != null) s2a.value = s.set2_a;
  if (s.set2_b != null) s2b.value = s.set2_b;
  if (s.set3_a != null) s3a.value = s.set3_a;
  if (s.set3_b != null) s3b.value = s.set3_b;

  function getVal(input) {
    const v = input.value.trim();
    return v === '' ? null : Number(v);
  }

  const grid = div.querySelector('.multiset-grid');

  function actualizarSet3() {
    const v1a = getVal(s1a), v1b = getVal(s1b);
    const v2a = getVal(s2a), v2b = getVal(s2b);

    const set1Ok = v1a !== null && v1b !== null && v1a !== v1b;
    const set2Ok = v2a !== null && v2b !== null && v2a !== v2b;

    let mostrar = false;
    if (set1Ok && set2Ok) {
      const sA = (v1a > v1b ? 1 : 0) + (v2a > v2b ? 1 : 0);
      const sB = (v1b > v1a ? 1 : 0) + (v2b > v2a ? 1 : 0);
      mostrar = sA === 1 && sB === 1;
    }

    const display = mostrar ? '' : 'none';
    s3a.style.display = display;
    s3b.style.display = display;
    set3Header.style.display = display;
    grid.classList.toggle('has-set3', mostrar);
  }

  function pintarGanador() {
    nameA.classList.remove('is-winner');
    nameB.classList.remove('is-winner');

    const v1a = getVal(s1a), v1b = getVal(s1b);
    const v2a = getVal(s2a), v2b = getVal(s2b);
    const v3a = getVal(s3a), v3b = getVal(s3b);

    let sA = 0, sB = 0;
    if (v1a !== null && v1b !== null && v1a !== v1b) { v1a > v1b ? sA++ : sB++; }
    if (v2a !== null && v2b !== null && v2a !== v2b) { v2a > v2b ? sA++ : sB++; }
    if (v3a !== null && v3b !== null && v3a !== v3b) { v3a > v3b ? sA++ : sB++; }

    if (sA >= 2) nameA.classList.add('is-winner');
    else if (sB >= 2) nameB.classList.add('is-winner');
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

  function validarYActualizar() {
    const v1a = getVal(s1a), v1b = getVal(s1b);
    const v2a = getVal(s2a), v2b = getVal(s2b);

    // Set 1 obligatorio
    if (v1a === null || v1b === null || v2a === null || v2b === null) {
      saveMsg.textContent = '';
      setGuardarVisible(false);
      return;
    }

    // Validar sets individuales
    const vs1 = validarScore(v1a, v1b);
    const vs2 = validarScore(v2a, v2b);
    if (!vs1.ok) { saveMsg.textContent = `Set 1: ${vs1.msg}`; setGuardarVisible(false); return; }
    if (!vs2.ok) { saveMsg.textContent = `Set 2: ${vs2.msg}`; setGuardarVisible(false); return; }

    // Check empate 1-1 → necesita set 3
    const sA = (v1a > v1b ? 1 : 0) + (v2a > v2b ? 1 : 0);
    const sB = (v1b > v1a ? 1 : 0) + (v2b > v2a ? 1 : 0);

    if (sA === 1 && sB === 1) {
      const v3a = getVal(s3a), v3b = getVal(s3b);
      if (v3a === null || v3b === null) {
        saveMsg.textContent = 'Completá el Super Tiebreak';
        setGuardarVisible(false);
        return;
      }
      const vs3 = validarScore(v3a, v3b);
      if (!vs3.ok) { saveMsg.textContent = `STB: ${vs3.msg}`; setGuardarVisible(false); return; }
    }

    saveMsg.textContent = '';
    setGuardarVisible(true);
  }

  function onInputChange() {
    actualizarSet3();
    pintarGanador();
    validarYActualizar();
  }

  [s1a, s1b, s2a, s2b, s3a, s3b].forEach(i => i.addEventListener('input', onInputChange));

  // Init state
  actualizarSet3();
  pintarGanador();
  setGuardarVisible(false);
  validarYActualizar();

  btn.onclick = async () => {
    const data = {
      set1_a: getVal(s1a),
      set1_b: getVal(s1b),
      set2_a: getVal(s2a),
      set2_b: getVal(s2b),
      set3_a: getVal(s3a),
      set3_b: getVal(s3b),
      num_sets: 3
    };

    // Clear set3 if not in use (not 1-1 tie)
    const sA = (data.set1_a > data.set1_b ? 1 : 0) + (data.set2_a > data.set2_b ? 1 : 0);
    const sB = (data.set1_b > data.set1_a ? 1 : 0) + (data.set2_b > data.set2_a ? 1 : 0);
    if (!(sA === 1 && sB === 1)) {
      data.set3_a = null;
      data.set3_b = null;
    }

    btn.disabled = true;
    const prev = btn.innerText;
    btn.innerText = 'Guardando…';
    saveMsg.textContent = '';
    actionsRow.classList.remove('has-msg');

    const ok = await onSave(data);

    btn.disabled = false;
    btn.innerText = prev;

    saveMsg.textContent = ok ? '✅ Guardado' : '❌ Error';
    if (!ok) setGuardarVisible(true);
    else setGuardarVisible(false);
  };

  return div;
}
