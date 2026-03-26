/**
 * Acceso de ayudante via gesto animado + PIN numérico.
 *
 * Tocar la versión la hace crecer. Si se deja de tocar, se achica.
 * Al alcanzar el tamaño objetivo (ghost gris), se muestra modal de PIN.
 */

const LS_KEY = 'torneo_ayudante';
const SCALE_PER_TAP = 0.6;
const SCALE_TARGET = 5;
const SHRINK_DELAY_MS = 900;
const SHRINK_SPEED = 1.5; // scale units / segundo

function getAyudante() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveAyudante() {
  localStorage.setItem(LS_KEY, JSON.stringify({ activado: true, ts: Date.now() }));
}

export function clearAyudante() {
  localStorage.removeItem(LS_KEY);
}

/**
 * Configura el gesto animado en el elemento .app-version.
 * Cada tap agranda el texto; si dejás de tocar, se achica.
 * Al llegar al tamaño del ghost gris → modal de PIN.
 */
export function initAyudanteGesture(supabase, torneoId) {
  if (getAyudante()) return;

  const versionEl = document.querySelector('.app-version');
  if (!versionEl) return;

  let scale = 1;
  let shrinkTimer = null;
  let rafId = null;
  let targetEl = null;

  versionEl.style.transformOrigin = 'bottom right';

  function applyScale() {
    const t = Math.min((scale - 1) / (SCALE_TARGET - 1), 1);
    versionEl.style.transform = `scale(${scale})`;
    versionEl.style.opacity = String(0.35 + t * 0.65);
  }

  function showTarget() {
    if (targetEl) return;
    targetEl = versionEl.cloneNode(true);
    targetEl.classList.add('version-target');
    targetEl.style.transformOrigin = 'bottom right';
    targetEl.style.transform = `scale(${SCALE_TARGET})`;
    document.body.appendChild(targetEl);
  }

  function hideTarget() {
    targetEl?.remove();
    targetEl = null;
  }

  function resetVisual() {
    scale = 1;
    applyScale();
    hideTarget();
  }

  function stopShrink() {
    clearTimeout(shrinkTimer);
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function startShrink() {
    let prev = performance.now();
    function frame(now) {
      scale = Math.max(1, scale - SHRINK_SPEED * (now - prev) / 1000);
      prev = now;
      applyScale();
      if (scale <= 1) { rafId = null; hideTarget(); return; }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
  }

  versionEl.addEventListener('click', async (e) => {
    e.preventDefault();
    stopShrink();

    scale = Math.min(scale + SCALE_PER_TAP, SCALE_TARGET + 1);

    if (scale >= SCALE_TARGET) {
      resetVisual();
      await mostrarPinModal(supabase, torneoId);
      return;
    }

    showTarget();
    applyScale();
    shrinkTimer = setTimeout(startShrink, SHRINK_DELAY_MS);
  });
}

/* =============================
   Modal PIN numérico
============================= */

function mostrarPinModal(supabase, torneoId) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'pin-overlay';
    overlay.innerHTML = `
      <div class="pin-modal">
        <div class="pin-title">PIN de organizador</div>
        <input class="pin-input" type="text" inputmode="numeric" pattern="[0-9]*"
               maxlength="6" autocomplete="off" placeholder="····" />
        <div class="pin-error" style="display:none;">PIN incorrecto</div>
        <div class="pin-actions">
          <button class="pin-btn pin-cancel">Cancelar</button>
          <button class="pin-btn pin-submit">Verificar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    // Forzar reflow para activar transición de entrada
    overlay.offsetHeight;
    overlay.classList.add('visible');

    const input = overlay.querySelector('.pin-input');
    const errorEl = overlay.querySelector('.pin-error');
    const btnCancel = overlay.querySelector('.pin-cancel');
    const btnSubmit = overlay.querySelector('.pin-submit');

    // Solo permitir dígitos
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '');
    });

    setTimeout(() => input.focus(), 100);

    function close() {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      resolve();
    }

    async function submit() {
      const pin = input.value.trim();
      if (!pin) return;

      btnSubmit.disabled = true;
      btnSubmit.textContent = '...';
      errorEl.style.display = 'none';

      try {
        const { data, error } = await supabase.rpc('verificar_pin_ayudante', {
          p_torneo_id: torneoId,
          p_pin: pin
        });

        if (error) throw error;

        if (data === true) {
          saveAyudante();
          overlay.remove();
          mostrarBarraAyudante();
          resolve();
        } else {
          errorEl.textContent = 'PIN incorrecto';
          errorEl.style.display = 'block';
          input.value = '';
          input.focus();
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Verificar';
        }
      } catch (e) {
        console.error('Error verificando PIN:', e);
        errorEl.textContent = 'Error al verificar';
        errorEl.style.display = 'block';
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Verificar';
      }
    }

    btnCancel.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    btnSubmit.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') close();
    });
  });
}

/* =============================
   Barra flotante de ayudante
============================= */

export function tryShowAyudanteBar() {
  if (!getAyudante()) return;
  mostrarBarraAyudante();
}

function mostrarBarraAyudante() {
  if (document.getElementById('ayudante-bar')) return;

  const bar = document.createElement('div');
  bar.id = 'ayudante-bar';
  bar.className = 'admin-floating-bar';
  bar.innerHTML = `
    <div class="admin-floating-links">
      <a href="/fixture">Fixture</a>
      <a href="/carga">Cargar</a>
      <a href="/presente">Presentismo</a>
      <button id="ayudante-bar-salir" class="admin-bar-btn">Salir</button>
    </div>
  `;

  document.body.appendChild(bar);

  document.getElementById('ayudante-bar-salir').addEventListener('click', () => {
    clearAyudante();
    bar.remove();
  });
}
