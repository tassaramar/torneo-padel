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

function clearInlineHit(el) {
  if (!el) return;
  el.style.background = '';
  el.style.borderRadius = '';
  el.style.padding = '';
}

function applyInlineHit(el) {
  if (!el) return;
  el.style.background = 'rgba(0, 255, 204, 0.14)';
  el.style.borderRadius = '12px';
   el.style.boxShadow = 'inset 0 0 0 9999px rgba(0, 255, 204, 0.10)';
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

  // Limpieza: no queremos que quede highlight viejo pegado
  for (const c of cards) {
    c.classList.remove('is-match'); // por si quedó de versiones anteriores
    const headerEl = c.querySelector('.card-header-left');
    const nameAEl = c.querySelector('.name-a');
    const nameBEl = c.querySelector('.name-b');

    clearInlineHit(headerEl);
    clearInlineHit(nameAEl?.parentElement); // fila A (div flex)
    clearInlineHit(nameBEl?.parentElement); // fila B (div flex)
    clearInlineHit(nameAEl); // por si querés que resalte solo el texto
    clearInlineHit(nameBEl);
  }

  // Para evitar “tipeo 1 letra y desaparece todo”
  const puedeFiltrar = q.length >= 2;

  let visible = 0;

  for (const c of cards) {
    const headerEl = c.querySelector('.card-header-left');
    const nameAEl = c.querySelector('.name-a');
    const nameBEl = c.querySelector('.name-b');

    const headerText = norm(headerEl?.textContent || '');
    const aText = norm(nameAEl?.textContent || '');
    const bText = norm(nameBEl?.textContent || '');

    const matchHeader = puedeFiltrar && headerText.includes(q);
    const matchA = puedeFiltrar && aText.includes(q);
    const matchB = puedeFiltrar && bText.includes(q);

    // Fallback: si por alguna razón no tenemos textos, usamos dataset.search
    const hay = norm(c.dataset.search || '');
    const matchFallback = puedeFiltrar && hay.includes(q);

    const show = !puedeFiltrar || matchHeader || matchA || matchB || matchFallback;

    c.style.display = show ? '' : 'none';
    if (show) visible += 1;

    // Highlight SOLO donde matchea (fila dentro del card)
    if (show && puedeFiltrar) {
      if (matchHeader) applyInlineHit(headerEl);

      // Para “fila”, resaltamos el contenedor (parentElement) y/o el nombre
      if (matchA) applyInlineHit(nameAEl?.parentElement || nameAEl);
      if (matchB) applyInlineHit(nameBEl?.parentElement || nameBEl);
    }
  }

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
