/**
 * Módulo centralizado de autenticación admin.
 *
 * - No afecta a jugadores (no requiere auth para leer datos públicos)
 * - Solo verifica si hay un admin logueado via Supabase Auth
 */

/**
 * Verifica si el usuario actual es admin.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{isAdmin: boolean, user: object|null, rol: string|null, nombre: string|null}>}
 */
export async function checkAdmin(supabase) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return { isAdmin: false, user: null, rol: null, nombre: null };
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('email, nombre, rol')
      .eq('email', session.user.email)
      .single();

    if (!adminUser) {
      return { isAdmin: false, user: session.user, rol: null, nombre: null };
    }

    return {
      isAdmin: true,
      user: session.user,
      rol: adminUser.rol,
      nombre: adminUser.nombre
    };
  } catch (e) {
    console.error('Error checking admin:', e);
    return { isAdmin: false, user: null, rol: null, nombre: null };
  }
}

/**
 * Inicia login con Google OAuth.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function loginWithGoogle(supabase) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.href
    }
  });

  if (error) {
    console.error('Error en login:', error);
    throw error;
  }
}

/**
 * Cierra la sesión del admin.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function logout(supabase) {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error en logout:', error);
}
