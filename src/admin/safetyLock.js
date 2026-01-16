// src/admin/safetyLock.js
import { logMsg } from './context.js';

export function initSafetyLock() {
  const toggle = document.getElementById('admin-safe-toggle');
  const badge = document.getElementById('admin-safe-badge');
  const bar = document.getElementById('admin-safe-bar');

  const dangerButtons = Array.from(document.querySelectorAll('[data-danger="hard"]'));

  function unlocked() {
    return !!toggle?.checked;
  }

  function applyUI() {
    const u = unlocked();
    dangerButtons.forEach((btn) => {
      btn.classList.toggle('is-locked', !u);
      btn.setAttribute('aria-disabled', u ? 'false' : 'true');
      btn.title = u ? '' : 'Modo seguro activo: desbloqueá arriba para habilitar esto.';
    });

    if (badge) badge.textContent = u ? 'DESBLOQUEADO' : 'Modo seguro';
    if (bar) bar.classList.toggle('is-unlocked', u);
  }

  // Guard: cuando está bloqueado, corta el click ANTES de que llegue a cualquier handler real.
  function guardClick(e) {
    if (unlocked()) return;

    e.preventDefault();
    // ESTE es el punto: corta también otros listeners en el mismo botón.
    e.stopImmediatePropagation();

    const label = e.currentTarget?.textContent?.trim() || 'Acción peligrosa';
    logMsg(`🔒 Bloqueado por Modo seguro: "${label}". Desbloqueá arriba para ejecutar.`);
  }

  dangerButtons.forEach((btn) => {
    btn.addEventListener('click', guardClick, true); // capture
  });

  toggle?.addEventListener('change', () => {
    applyUI();
    logMsg(unlocked() ? '🔓 Acciones peligrosas DESBLOQUEADAS' : '🔒 Acciones peligrosas BLOQUEADAS');
  });

  applyUI();
  logMsg(unlocked() ? '🔓 Acciones peligrosas DESBLOQUEADAS' : '🔒 Acciones peligrosas BLOQUEADAS');
}
