import { createClient } from '@supabase/supabase-js';

export const TORNEO_ID = 'ad58a855-fa74-4c2e-825e-32c20f972136';

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
  const p = document.createElement('p');
  p.textContent = msg;
  dom.log.appendChild(p);
}

export function el(tag, attrs = {}, html = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (html) node.innerHTML = html;
  return node;
}
