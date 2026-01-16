// src/admin/safetyLock.js
export function initSafetyLock() {
  const toggle = document.getElementById('admin-safe-toggle');
  const badge = document.getElementById('admin-safe-badge');
  const bar = document.getElementById('admin-safe-bar');

  function setLocked(btn, locked) {
    if (!btn) return;

    if (locked) {
      // guardamos el estado previo solo la primera vez
      if (btn.dataset.lockPrevDisabled === undefined) {
        btn.dataset.lockPrevDisabled = btn.disabled ? '1' : '0';
      }
      btn.disabled = true;
      btn.title = 'Modo seguro activo: desbloqueá arriba para habilitar esto.';
    } else {
      const prev = btn.dataset.lockPrevDisabled;
      btn.disabled = (prev === '1'); // restaura estado previo
      btn.title = '';
    }
  }

  function apply() {
    const unlocked = !!toggle?.checked;

    document
      .querySelectorAll('[data-danger="hard"]')
      .forEach((btn) => setLocked(btn, !unlocked));

    if (badge) badge.textContent = unlocked ? 'DESBLOQUEADO' : 'Modo seguro';
    if (bar) bar.classList.toggle('is-unlocked', unlocked);
  }

  toggle?.addEventListener('change', apply);
  apply();
}
