/**
 * Inyecta links de admin en la vista del jugador (index.html).
 * Solo se muestran si hay un admin logueado.
 */

import { checkAdmin, logout } from './adminAuth.js';

/**
 * Si el usuario actual es admin, inyecta una barra flotante con links de navegación.
 * Si no es admin, no hace nada (el jugador no nota diferencia).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function tryShowAdminLinks(supabase) {
  const result = await checkAdmin(supabase);

  if (!result.isAdmin) return;

  const bar = document.createElement('div');
  bar.className = 'admin-floating-bar';
  bar.innerHTML = `
    <div class="admin-floating-links">
      <a href="/admin">Admin</a>
      <a href="/fixture">Fixture</a>
      <a href="/carga">Cargar</a>
      <a href="/presente">Presentismo</a>
      <a href="/analytics">Analytics</a>
      <button id="admin-bar-logout" class="admin-bar-btn">Salir</button>
    </div>
  `;

  document.body.appendChild(bar);

  document.getElementById('admin-bar-logout').addEventListener('click', async () => {
    await logout(supabase);
    bar.remove();
  });
}
