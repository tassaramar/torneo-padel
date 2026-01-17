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
  div.style.border = '1px solid #ddd';
  div.style.borderRadius = '10px';
  div.style.padding = '12px';
  div.style.marginBottom = '10px';

  const esJugado = gamesA !== null && gamesB !== null;
  const labelBtn = state.modo === 'jugados' ? 'Guardar cambios' : 'Guardar';

  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <div class="card-header-left" style="font-size:14px;">${headerLeft}</div>
      <div style="font-size:12px; opacity:0.8;">${headerRight ?? (esJugado ? 'Jugado' : 'Pendiente')}</div>
    </div>

    <div class="row row-a" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <strong class="team-name name-a">${nombreA ?? 'Pareja A'}</strong>
      <input
        type="number"
        inputmode="numeric"
        pattern="[0-9]*"
        min="0"
        step="1"
        style="width:80px; font-size:18px; padding:8px; text-align:center;"
      />
    </div>

    <div class="row row-b" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <strong class="team-name name-b">${nombreB ?? 'Pareja B'}</strong>
      <input
        type="number"
        inputmode="numeric"
        pattern="[0-9]*"
        min="0"
        step="1"
        style="width:80px; font-size:18px; padding:8px; text-align:center;"
      />
    </div>

    <div class="actions-row"
         style="
           display:flex;
           justify-content:flex-end;
           gap:8px;
           align-items:center;
           margin-top:0px;
           min-height:0px;
           transition: margin-top 140ms ease, min-height 140ms ease;
         ">
      <span class="save-msg" style="font-size:13px; opacity:0.85;"></span>
      <button type="button" style="padding:10px 14px; font-size:16px;">${labelBtn}</button>
    </div>
  `;

  const [inputA, inputB] = div.querySelectorAll('input');
  const actionsRow = div.querySelector('.actions-row');
  const btn = div.querySelector('button');
  const saveMsg = div.querySelector('.save-msg');
  const nameA = div.querySelector('.name-a');
  const nameB = div.querySelector('.name-b');

  if (state.modo === 'jugados') {
    inputA.value = gamesA ?? '';
    inputB.value = gamesB ?? '';
  }

  function pintarGanador() {
    nameA.style.color = '';
    nameB.style.color = '';

    if (inputA.value === '' || inputB.value === '') return;

    const ga = Number(inputA.value);
    const gb = Number(inputB.value);
    if (Number.isNaN(ga) || Number.isNaN(gb)) return;

    if (ga === gb) return;

    if (ga > gb) nameA.style.color = '#1a7f37';
    else nameB.style.color = '#1a7f37';
  }

  function setGuardarVisible(visible) {
    btn.style.display = visible ? 'inline-block' : 'none';

    if (visible) {
      actionsRow.style.marginTop = '10px';
      actionsRow.style.minHeight = '44px';
    } else {
      const tieneMensaje = (saveMsg.textContent || '').trim() !== '';
      actionsRow.style.marginTop = tieneMensaje ? '6px' : '0px';
      actionsRow.style.minHeight = tieneMensaje ? '22px' : '0px';
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

    const ok = await onSave(ga, gb);

    btn.disabled = false;
    btn.innerText = prev;

    saveMsg.textContent = ok ? '✅ Guardado' : '❌ Error';
    if (!ok) setGuardarVisible(true);
  };

  return div;
}
