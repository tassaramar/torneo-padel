-- Migración: Ajustar RLS para alinear con el nuevo modelo de autenticación
--
-- Modelo de acceso:
--   - anon (sin login): puede leer todo, y hacer escrituras operacionales
--     (cargar resultados, cambiar estado partidos, marcar presentes, insertar tracking)
--   - authenticated + is_admin(): escrituras estructurales
--     (crear/editar grupos, parejas, copas, torneos, copas)
--   - admin_users: solo el propio usuario puede leer su fila


-- ============================================================
-- FUNCIÓN HELPER: is_admin()
-- Verifica si el usuario autenticado actual es admin.
-- SECURITY DEFINER permite leer admin_users aunque tenga RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE email = auth.email()
  )
$$;


-- ============================================================
-- TABLA: torneos
-- Leer: todos. Escribir: solo admin autenticado.
-- ============================================================
DROP POLICY IF EXISTS "public access torneos" ON public.torneos;
DROP POLICY IF EXISTS "torneos_select" ON public.torneos;
DROP POLICY IF EXISTS "torneos_write_admin" ON public.torneos;

CREATE POLICY "torneos_select"
ON public.torneos FOR SELECT
TO public
USING (true);

CREATE POLICY "torneos_write_admin"
ON public.torneos FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ============================================================
-- TABLA: grupos
-- Leer: todos. Escribir: solo admin autenticado.
-- ============================================================
DROP POLICY IF EXISTS "public access grupos" ON public.grupos;
DROP POLICY IF EXISTS "grupos_select" ON public.grupos;
DROP POLICY IF EXISTS "grupos_write_admin" ON public.grupos;

CREATE POLICY "grupos_select"
ON public.grupos FOR SELECT
TO public
USING (true);

CREATE POLICY "grupos_write_admin"
ON public.grupos FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ============================================================
-- TABLA: parejas
-- Leer: todos.
-- UPDATE: público (anon necesita actualizar presentes desde presente.html e index.html)
-- INSERT/DELETE: solo admin autenticado.
-- ============================================================
DROP POLICY IF EXISTS "public access parejas" ON public.parejas;
DROP POLICY IF EXISTS "parejas_select" ON public.parejas;
DROP POLICY IF EXISTS "parejas_update_public" ON public.parejas;
DROP POLICY IF EXISTS "parejas_insert_admin" ON public.parejas;
DROP POLICY IF EXISTS "parejas_delete_admin" ON public.parejas;

CREATE POLICY "parejas_select"
ON public.parejas FOR SELECT
TO public
USING (true);

CREATE POLICY "parejas_update_public"
ON public.parejas FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "parejas_insert_admin"
ON public.parejas FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "parejas_delete_admin"
ON public.parejas FOR DELETE
TO authenticated
USING (public.is_admin());


-- ============================================================
-- TABLA: partidos
-- Leer: todos.
-- UPDATE: público (fixture.html y carga.html cambian estado y cargan resultados sin login)
-- INSERT/DELETE: solo admin autenticado.
-- ============================================================
DROP POLICY IF EXISTS "public access partidos" ON public.partidos;
DROP POLICY IF EXISTS "partidos_select" ON public.partidos;
DROP POLICY IF EXISTS "partidos_update_public" ON public.partidos;
DROP POLICY IF EXISTS "partidos_insert_admin" ON public.partidos;
DROP POLICY IF EXISTS "partidos_delete_admin" ON public.partidos;

CREATE POLICY "partidos_select"
ON public.partidos FOR SELECT
TO public
USING (true);

CREATE POLICY "partidos_update_public"
ON public.partidos FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "partidos_insert_admin"
ON public.partidos FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "partidos_delete_admin"
ON public.partidos FOR DELETE
TO authenticated
USING (public.is_admin());


-- ============================================================
-- TABLA: copas
-- Leer: todos. Escribir: solo admin autenticado.
-- ============================================================
DROP POLICY IF EXISTS "copas_delete_public" ON public.copas;
DROP POLICY IF EXISTS "copas_insert" ON public.copas;
DROP POLICY IF EXISTS "copas_insert_anon" ON public.copas;
DROP POLICY IF EXISTS "copas_read_only" ON public.copas;
DROP POLICY IF EXISTS "copas_select" ON public.copas;
DROP POLICY IF EXISTS "copas_select_anon" ON public.copas;
DROP POLICY IF EXISTS "copas_update_public" ON public.copas;
DROP POLICY IF EXISTS "copas_write_admin" ON public.copas;

CREATE POLICY "copas_select"
ON public.copas FOR SELECT
TO public
USING (true);

CREATE POLICY "copas_write_admin"
ON public.copas FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ============================================================
-- TABLA: tracking_eventos
-- INSERT: público (index.html registra visitas y cargas sin login)
-- SELECT: solo admin autenticado (para analytics)
-- UPDATE/DELETE: nadie desde el cliente (log inmutable)
-- ============================================================
DROP POLICY IF EXISTS "public_access_tracking" ON public.tracking_eventos;
DROP POLICY IF EXISTS "tracking_insert_public" ON public.tracking_eventos;
DROP POLICY IF EXISTS "tracking_select_admin" ON public.tracking_eventos;

CREATE POLICY "tracking_insert_public"
ON public.tracking_eventos FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "tracking_select_admin"
ON public.tracking_eventos FOR SELECT
TO authenticated
USING (public.is_admin());


-- ============================================================
-- TABLA: posiciones_manual
-- Habilitar RLS (estaba OFF). Leer: todos. Escribir: solo admin.
-- ============================================================
ALTER TABLE public.posiciones_manual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posiciones_select" ON public.posiciones_manual;
DROP POLICY IF EXISTS "posiciones_write_admin" ON public.posiciones_manual;

CREATE POLICY "posiciones_select"
ON public.posiciones_manual FOR SELECT
TO public
USING (true);

CREATE POLICY "posiciones_write_admin"
ON public.posiciones_manual FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ============================================================
-- TABLA: admin_users
-- Habilitar RLS. Cada usuario autenticado solo puede leer su propia fila.
-- Sin escritura desde el cliente (gestión vía Supabase dashboard).
-- ============================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;

CREATE POLICY "admin_users_select_own"
ON public.admin_users FOR SELECT
TO authenticated
USING (email = auth.email());
