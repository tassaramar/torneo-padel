import { supabase, TORNEO_ID, logMsg, el } from '../context.js';
import { showToast } from '../../utils/toast.js';

function normNombrePareja(raw) {
  let s = String(raw ?? '').trim();
  s = s.replace(/\s*-\s*/g, ' - ');
  s = s.replace(/\s+/g, ' ');
  return s;
}

function groupSort(a, b) {
  return String(a).localeCompare(String(b));
}

async function fetchEstado() {
  const { data: grupos, error: eg } = await supabase
    .from('grupos')
    .select('id, nombre')
    .eq('torneo_id', TORNEO_ID)
    .order('nombre');

  if (eg) return { ok: false, msg: 'Error leyendo grupos', grupos: [], parejas: [] };

  const { data: parejas, error: ep } = await supabase
    .from('parejas')
    .select('id, nombre, orden')
    .eq('torneo_id', TORNEO_ID)
    .order('orden');

  if (ep) return { ok: false, msg: 'Error leyendo parejas', grupos: grupos ?? [], parejas: [] };

  return { ok: true, grupos: grupos ?? [], parejas: parejas ?? [] };
}

function inferGroupMap(grupos, parejas) {
  // asignación “por bloques” (como hoy funciona tu sistema)
  const map = new Map(); // pareja_id -> { grupo, idxEnGrupo }
  if (!grupos?.length || !parejas?.length) return map;

  const n = grupos.length;
  const per = parejas.length / n;
  if (!Number.isInteger(per)) return map;

  const orderedGroups = [...grupos].map(g => g.nombre).sort(groupSort);

  let cursor = 0;
  for (let gi = 0; gi < orderedGroups.length; gi++) {
    const gname = orderedGroups[gi];
    const slice = parejas.slice(cursor, cursor + per);
    cursor += per;

    slice.forEach((p, i) => {
      map.set(p.id, { grupo: gname, idx: i + 1 });
    });
  }
  return map;
}

// Variable global para la función refresh (necesaria para rollback)
let globalRefresh = null;

function renderList(container, estado, filterText) {
  container.innerHTML = '';

  if (!estado.ok) {
    container.appendChild(el('div', { style: 'color:#f88;' }, estado.msg));
    return;
  }

  const grupos = estado.grupos ?? [];
  const parejas = estado.parejas ?? [];
  const inferred = inferGroupMap(grupos, parejas);

  if (!parejas.length) {
    container.appendChild(el('div', { style: 'opacity:.8;' }, 'No hay parejas cargadas.'));
    return;
  }

  const q = String(filterText ?? '').trim().toLowerCase();

  const visible = q
    ? parejas.filter(p => (p.nombre ?? '').toLowerCase().includes(q))
    : parejas;

  if (!visible.length) {
    container.appendChild(el('div', { style: 'opacity:.8;' }, 'No hay coincidencias.'));
    return;
  }

  visible.forEach(p => {
    const g = inferred.get(p.id);
    const grupoTxt = g?.grupo ? `Grupo ${g.grupo}` : 'Grupo ?';

    const card = el('div', {
      style: 'padding:10px; border:1px solid #333; border-radius:12px; margin-bottom:10px;'
    });

    const top = el('div', { style: 'display:flex; justify-content:space-between; gap:10px; align-items:center;' });
    top.appendChild(el('div', { style: 'font-weight:700;' }, `${grupoTxt} · #${p.orden ?? '-'}`));

    const btnEdit = el('button', {}, '✏️ Editar');
    top.appendChild(btnEdit);

    card.appendChild(top);

    const viewLine = el('div', { style: 'margin-top:8px;' }, p.nombre ?? '');
    card.appendChild(viewLine);

    const editBox = el('div', { style: 'margin-top:10px; display:none;' });
    const input = el('input', {
      value: p.nombre ?? '',
      style: 'width:100%; padding:10px; border-radius:10px; border:1px solid #333; background:#111; color:#fff;'
    });

    const actions = el('div', { class: 'admin-actions', style: 'margin-top:10px;' });
    const btnSave = el('button', {}, '💾 Guardar');
    const btnCancel = el('button', {}, 'Cancelar');

    actions.appendChild(btnSave);
    actions.appendChild(btnCancel);

    editBox.appendChild(input);
    editBox.appendChild(actions);
    card.appendChild(editBox);

    btnEdit.addEventListener('click', () => {
      editBox.style.display = editBox.style.display === 'none' ? 'block' : 'none';
      if (editBox.style.display === 'block') input.focus();
    });

    btnCancel.addEventListener('click', () => {
      input.value = p.nombre ?? '';
      editBox.style.display = 'none';
    });

    btnSave.addEventListener('click', async () => {
      const nuevo = normNombrePareja(input.value);
      if (!nuevo) {
        alert('Nombre vacío no. Somos gente civilizada.');
        return;
      }

      // OPTIMISTIC UI: Capturar estado previo
      const nombreAnterior = viewLine.textContent;

      // Actualizar UI inmediatamente + deshabilitar botones
      viewLine.textContent = nuevo;
      editBox.style.display = 'none';
      btnSave.disabled = true;
      btnCancel.disabled = true;

      // Backend call
      const { error } = await supabase
        .from('parejas')
        .update({ nombre: nuevo })
        .eq('id', p.id);

      // Re-habilitar botones
      btnSave.disabled = false;
      btnCancel.disabled = false;

      if (error) {
        // ROLLBACK: Revert + Notify + Refresh
        viewLine.textContent = nombreAnterior;
        editBox.style.display = 'block';
        console.error(error);
        showToast('Error al guardar pareja', 'error');
        if (globalRefresh) await globalRefresh(); // ← Garantizar consistencia
        return;
      }

      // Success: Log + Refresh
      logMsg(`✅ Pareja actualizada: ${nuevo}`);
      if (globalRefresh) await globalRefresh(); // ← Garantizar consistencia
    });

    container.appendChild(card);
  });
}

export function initParejasEdit() {
  const listEl = document.getElementById('parejas-list');
  if (!listEl) return;

  const searchEl = document.getElementById('parejas-search');
  const btnRefresh = document.getElementById('parejas-refresh');

  let estado = { ok: true, grupos: [], parejas: [] };

  const refresh = async () => {
    listEl.innerHTML = '<div style="opacity:.8;">Cargando…</div>';
    estado = await fetchEstado();
    renderList(listEl, estado, searchEl?.value ?? '');
  };

  // Asignar a variable global para que btnSave pueda usarla en rollback
  globalRefresh = refresh;

  btnRefresh?.addEventListener('click', refresh);

  searchEl?.addEventListener('input', () => {
    renderList(listEl, estado, searchEl?.value ?? '');
  });

  // carga inicial
  refresh();
}
