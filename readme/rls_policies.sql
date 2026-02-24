-- RLS status:
-- copas: RLS ON
-- grupos: RLS ON
-- parejas: RLS ON
-- partidos: RLS ON
-- torneos: RLS ON
-- posiciones_manual: RLS ON  (antes estaba OFF)
-- tracking_eventos: RLS ON
-- admin_users: RLS ON
--
-- Modelo de acceso (alineado con modelo de autenticación de la app):
--   anon (sin login):
--     - SELECT en todas las tablas
--     - UPDATE en partidos (cargar resultados, cambiar estado)
--     - UPDATE en parejas (marcar presentes)
--     - INSERT en tracking_eventos
--
--   authenticated + is_admin():
--     - Todo lo anterior
--     - INSERT/UPDATE/DELETE estructural en torneos, grupos, parejas, partidos, copas, posiciones_manual
--     - SELECT en tracking_eventos
--
--   admin_users:
--     - Cada usuario autenticado solo puede leer su propia fila
--     - Sin escritura desde cliente (gestión vía Supabase dashboard)
--
-- Ver migración: supabase/migrations/20260224000000_fix_rls_policies.sql

ALTER TABLE public.copas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parejas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torneos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posiciones_manual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- === FUNCIÓN HELPER ===
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.email())
$$;

-- === torneos ===
-- Leer: todos. Escribir: admin autenticado.
CREATE POLICY "torneos_select" ON public.torneos FOR SELECT TO public USING (true);
CREATE POLICY "torneos_write_admin" ON public.torneos FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- === grupos ===
-- Leer: todos. Escribir: admin autenticado.
CREATE POLICY "grupos_select" ON public.grupos FOR SELECT TO public USING (true);
CREATE POLICY "grupos_write_admin" ON public.grupos FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- === parejas ===
-- Leer: todos. UPDATE: público (marcar presentes sin login).
-- INSERT/DELETE: admin autenticado.
CREATE POLICY "parejas_select" ON public.parejas FOR SELECT TO public USING (true);
CREATE POLICY "parejas_update_public" ON public.parejas FOR UPDATE TO public
  USING (true) WITH CHECK (true);
CREATE POLICY "parejas_insert_admin" ON public.parejas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "parejas_delete_admin" ON public.parejas FOR DELETE TO authenticated
  USING (public.is_admin());

-- === partidos ===
-- Leer: todos. UPDATE: público (cargar resultados y cambiar estado sin login).
-- INSERT/DELETE: admin autenticado.
CREATE POLICY "partidos_select" ON public.partidos FOR SELECT TO public USING (true);
CREATE POLICY "partidos_update_public" ON public.partidos FOR UPDATE TO public
  USING (true) WITH CHECK (true);
CREATE POLICY "partidos_insert_admin" ON public.partidos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "partidos_delete_admin" ON public.partidos FOR DELETE TO authenticated
  USING (public.is_admin());

-- === copas ===
-- Leer: todos. Escribir: admin autenticado.
CREATE POLICY "copas_select" ON public.copas FOR SELECT TO public USING (true);
CREATE POLICY "copas_write_admin" ON public.copas FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- === tracking_eventos ===
-- INSERT: público (jugadores trackeados sin login).
-- SELECT: solo admin autenticado (para analytics).
-- UPDATE/DELETE: nadie desde cliente (log inmutable).
CREATE POLICY "tracking_insert_public" ON public.tracking_eventos FOR INSERT TO public
  WITH CHECK (true);
CREATE POLICY "tracking_select_admin" ON public.tracking_eventos FOR SELECT TO authenticated
  USING (public.is_admin());

-- === posiciones_manual ===
-- Leer: todos. Escribir: admin autenticado.
CREATE POLICY "posiciones_select" ON public.posiciones_manual FOR SELECT TO public USING (true);
CREATE POLICY "posiciones_write_admin" ON public.posiciones_manual FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- === admin_users ===
-- Cada usuario autenticado puede leer solo su propia fila.
-- Sin escritura desde cliente.
CREATE POLICY "admin_users_select_own" ON public.admin_users FOR SELECT TO authenticated
  USING (email = auth.email());
