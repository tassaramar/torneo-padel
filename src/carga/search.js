import { state } from './state.js';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // saca tildes
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aplicarZebraVisible(listCont) {
  const visibles = Array.from(listCont.querySelectorAll('.partido'))
    .filter(c => c.style.display !== 'none');

  visibles.forEach((c, i) => {
    c.classList.toggle('is-even', i % 2 === 0);
    c.classList.toggle('is-odd', i % 2 === 1);
  });
}

export function initSearchUI({ input, clearBtn, onChange }) {
  if (!input) return;

  input.value = state.search || '';

  input.addEventListener('input', () => {
    state.search = input.value || '';
    onChange?.();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.search = '';
      input.value = '';
      input.focus();
      onChange?.();
    });
  }
}

export function applySearchToPartidos({ listCont, msgCont }) {
  if (!listCont) return;

  const raw = state.search || '';
  const q = norm(raw);
  const cards = Array.from(listCont.querySelectorAll('.partido'));

  // Limpieza de hits
  for (const c of cards) {
    c.querySelector('.card-header-left')?.classList.remove('hit');
    c.querySelector('.row-a')?.classList.remove('hit');
    c.querySelector('.row-b')?.classList.remove('hit');
  }

  const puedeFiltrar = q.length >= 2;
  let visible = 0;

  for (const c of cards) {
    const headerEl = c.querySelector('.card-header-left');
    const nameAEl = c.querySelector('.name-a');
    const nameBEl = c.querySelector('.name-b');
    const rowA = c.querySelector('.row-a');
    const rowB = c.querySelector('.row-b');

    const headerText = norm(headerEl?.textContent || '');
    const aText = norm(nameAEl?.textContent || '');
    const bText = norm(nameBEl?.textContent || '');

    const matchHeader = puedeFiltrar && headerText.includes(q);
    const matchA = puedeFiltrar && aText.includes(q);
    const matchB = puedeFiltrar && bText.includes(q);

    const hay = norm(c.dataset.search || '');
    const matchFallback = puedeFiltrar && hay.includes(q);

    const show = !puedeFiltrar || matchHeader || matchA || matchB || matchFallback;

    c.style.display = show ? '' : 'none';
    if (show) visible += 1;

    if (show && puedeFiltrar) {
      if (matchHeader) headerEl?.classList.add('hit');
      if (matchA) rowA?.classList.add('hit');
      if (matchB) rowB?.classList.add('hit');
    }
  }

  // IMPORTANTÍSIMO: zebra recalculado sobre visibles
  aplicarZebraVisible(listCont);

  if (!msgCont) return;

  if (!raw) {
    if (
      msgCont.textContent?.startsWith('Mostrando') ||
      msgCont.textContent?.startsWith('Escribí')
    ) msgCont.textContent = '';
    return;
  }

  if (!puedeFiltrar) {
    msgCont.textContent = 'Escribí al menos 2 letras para filtrar.';
    return;
  }

  msgCont.textContent = `Mostrando ${visible} de ${cards.length} (filtro: "${raw}")`;
}
