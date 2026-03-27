-- Multi-torneo MVP 1.0: estado, slug, campos de info, constraint de único activo

-- 1. Nuevas columnas en torneos
ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'activo', 'finalizado')),
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS fecha DATE,
  ADD COLUMN IF NOT EXISTS duracion TEXT,
  ADD COLUMN IF NOT EXISTS ubicacion_nombre TEXT,
  ADD COLUMN IF NOT EXISTS ubicacion_coords TEXT;

-- 2. Constraint: máximo 1 torneo activo
CREATE UNIQUE INDEX idx_torneos_unico_activo ON torneos ((true)) WHERE estado = 'activo';

-- 3. Marcar el torneo existente como activo
UPDATE torneos SET estado = 'activo' WHERE id = 'ad58a855-fa74-4c2e-825e-32c20f972136';

-- 4. RPC para obtener el torneo activo
CREATE OR REPLACE FUNCTION obtener_torneo_activo()
RETURNS UUID AS $$
  SELECT id FROM torneos WHERE estado = 'activo' LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. Grants
GRANT EXECUTE ON FUNCTION obtener_torneo_activo() TO anon, authenticated;
