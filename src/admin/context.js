import { createClient } from '@supabase/supabase-js';
import { obtenerTorneoActivo } from '../utils/torneoActivo.js';

export let TORNEO_ID = null;

export async function initTorneo() {
  TORNEO_ID = await obtenerTorneoActivo(supabase);
  return TORNEO_ID;
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const dom = {
  log: document.getElementById('log'),
  contGrupos: document.getElementById('grupos-admin'),
  contCopas: document.getElementById('copas-admin'),
};

export function logMsg(msg) {
  if (!dom.log) return;

  // Empty string = spacer, no timestamp
  if (!msg) {
    const p = document.createElement('p');
    p.innerHTML = '&nbsp;';
    dom.log.prepend(p);
    return;
  }

  const ts = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const isOk   = msg.startsWith('✅');
  const isErr  = msg.startsWith('❌');
  const isWarn = msg.startsWith('⚠️');
  const type   = isOk ? 'ok' : isErr ? 'err' : isWarn ? 'warn' : '';

  const p = document.createElement('p');
  if (type) p.dataset.type = type;
  p.innerHTML = `<span class="log-ts">${ts}</span>${msg}`;
  dom.log.prepend(p);

  // Toast para mensajes accionables
  const toastEl = document.getElementById('admin-toast');
  if (!toastEl) return;
  if (isOk || isErr || isWarn) {
    toastEl.textContent = msg;
    toastEl.className = `toast toast-show ${isOk ? 'toast-success' : isErr ? 'toast-error' : 'toast-info'}`;
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => { toastEl.className = 'toast'; }, 3000);
  }
}

export function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (html) node.innerHTML = html;
  return node;
}
