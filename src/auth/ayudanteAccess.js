/**
 * Acceso de ayudante via gesto secreto (7 taps) + PIN.
 *
 * - initAyudanteGesture: configura el gesto en el elemento de versión
 * - tryShowAyudanteBar: muestra barra flotante si el ayudante ya está validado
 * - clearAyudante: limpia el acceso de ayudante
 */

const LS_KEY = 'torneo_ayudante';
const TAPS_REQUIRED = 7;
const TAP_WINDOW_MS = 3000;

/**
 * Guarda/lee estado de ayudante en localStorage.
 */
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
 * Configura el gesto de 7 taps en el elemento .app-version.
 * Al completar, pide PIN y verifica via RPC.
 */
export function initAyudanteGesture(supabase, torneoId) {
  // Si ya es ayudante, no necesita el gesto
  if (getAyudante()) return;

  const versionEl = document.querySelector('.app-version');
  if (!versionEl) return;

  let tapCount = 0;
  let tapTimer = null;

  versionEl.style.cursor = 'default';
  versionEl.addEventListener('click', async () => {
    tapCount++;
    clearTimeout(tapTimer);

    if (tapCount >= TAPS_REQUIRED) {
      tapCount = 0;
      await pedirPin(supabase, torneoId);
      return;
    }

    tapTimer = setTimeout(() => { tapCount = 0; }, TAP_WINDOW_MS);
  });
}

async function pedirPin(supabase, torneoId) {
  const pin = prompt('PIN de organizador:');
  if (!pin) return;

  try {
    const { data, error } = await supabase.rpc('verificar_pin_ayudante', {
      p_torneo_id: torneoId,
      p_pin: pin.trim()
    });

    if (error) throw error;

    if (data === true) {
      saveAyudante();
      mostrarBarraAyudante();
    } else {
      alert('PIN incorrecto');
    }
  } catch (e) {
    console.error('Error verificando PIN:', e);
    alert('Error al verificar. Intentá de nuevo.');
  }
}

/**
 * Si el ayudante ya está validado (localStorage), muestra la barra flotante.
 */
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
