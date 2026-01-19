
-- RLS status (según tus queries):
-- copas: RLS ON
-- grupos: RLS ON
-- parejas: RLS ON
-- partidos: RLS ON
-- torneos: RLS ON
-- posiciones_manual: RLS OFF

ALTER TABLE public.copas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parejas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torneos ENABLE ROW LEVEL SECURITY;

-- posiciones_manual explícitamente SIN RLS
ALTER TABLE public.posiciones_manual DISABLE ROW LEVEL SECURITY;

-- Policies
-- Nota: Uso "IF EXISTS" para que sea re-ejecutable sin romper.
-- Nota 2: Tus policies usan roles {public} y también {anon,authenticated}.
--         En Postgres, "public" es un rol especial (todos los roles lo heredan).

-- === copas ===
DROP POLICY IF EXISTS "copas_delete_public" ON public.copas;
CREATE POLICY "copas_delete_public"
ON public.copas
AS PERMISSIVE
FOR DELETE
TO public
USING (true);

DROP POLICY IF EXISTS "copas_insert" ON public.copas;
CREATE POLICY "copas_insert"
ON public.copas
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "copas_insert_anon" ON public.copas;
CREATE POLICY "copas_insert_anon"
ON public.copas
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK ((torneo_id = 'ad58a855-fa74-4c2e-825e-32c20f972136'::uuid));

DROP POLICY IF EXISTS "copas_read_only" ON public.copas;
CREATE POLICY "copas_read_only"
ON public.copas
AS PERMISSIVE
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "copas_select" ON public.copas;
CREATE POLICY "copas_select"
ON public.copas
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "copas_select_anon" ON public.copas;
CREATE POLICY "copas_select_anon"
ON public.copas
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING ((torneo_id = 'ad58a855-fa74-4c2e-825e-32c20f972136'::uuid));

DROP POLICY IF EXISTS "copas_update_public" ON public.copas;
CREATE POLICY "copas_update_public"
ON public.copas
AS PERMISSIVE
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- === grupos ===
DROP POLICY IF EXISTS "public access grupos" ON public.grupos;
CREATE POLICY "public access grupos"
ON public.grupos
AS PERMISSIVE
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- === parejas ===
DROP POLICY IF EXISTS "public access parejas" ON public.parejas;
CREATE POLICY "public access parejas"
ON public.parejas
AS PERMISSIVE
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- === partidos ===
DROP POLICY IF EXISTS "public access partidos" ON public.partidos;
CREATE POLICY "public access partidos"
ON public.partidos
AS PERMISSIVE
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- === torneos ===
DROP POLICY IF EXISTS "public access torneos" ON public.torneos;
CREATE POLICY "public access torneos"
ON public.torneos
AS PERMISSIVE
FOR ALL
TO public
USING (true)
WITH CHECK (true);
