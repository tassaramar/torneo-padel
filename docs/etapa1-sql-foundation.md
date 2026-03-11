# Etapa 1: Migración SQL — Foundation

## Objetivo

Preparar la base de datos para Copa Approval v2 sin cambiar código JS. La app existente sigue funcionando después de aplicar esta migración.

## Spec funcional de referencia

`docs/spec-copa-approval-v2.md` — Secciones: "Tabla general", "El sorteo como mecanismo de desempate", decisión #8 (DG falta en RPC).

## Criterios de aceptación (de la spec)

- [ ] La tabla general muestra la columna DG (Diferencia de Games)
- [ ] `obtener_standings_torneo` retorna `dg`, `gc`, `sorteo_orden`
- [ ] El ORDER BY del ROW_NUMBER incluye `dg` y `sorteo_orden`
- [ ] La tabla `sorteos` existe con RLS configurado
- [ ] `crear_partidos_copa` crea copa + partidos desde cruces JSONB sin tocar `propuestas_copa`

---

## Cambio 1: Tabla `sorteos`

### Contexto

Reemplaza conceptualmente a `posiciones_manual` (que queda como legacy sin uso). Almacena resultados de sorteos físicos que el admin ingresa para resolver empates.

Dos tipos:
- `intra_grupo`: empate dentro de un grupo (se resuelve desde Tab Grupos)
- `inter_grupo`: empate entre equipos del mismo tier de distintos grupos (se resuelve desde Tab Copas)

### SQL

```sql
-- Tabla de sorteos para desempate
CREATE TABLE IF NOT EXISTS public.sorteos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id     UUID NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  grupo_id      UUID REFERENCES public.grupos(id) ON DELETE CASCADE,  -- NULL para inter_grupo
  pareja_id     UUID NOT NULL REFERENCES public.parejas(id) ON DELETE CASCADE,
  orden_sorteo  INTEGER NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('intra_grupo', 'inter_grupo')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (torneo_id, pareja_id)
);

-- RLS
ALTER TABLE public.sorteos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden leer sorteos"
  ON public.sorteos FOR SELECT
  USING (true);

CREATE POLICY "Admin puede insertar sorteos"
  ON public.sorteos FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin puede actualizar sorteos"
  ON public.sorteos FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admin puede borrar sorteos"
  ON public.sorteos FOR DELETE
  USING (public.is_admin());
```

### Notas

- `UNIQUE (torneo_id, pareja_id)`: una pareja solo puede tener un sorteo por torneo (intra o inter, no ambos simultáneamente, porque su posición es una sola).
- `grupo_id` es nullable: para sorteos `inter_grupo` no aplica grupo específico.
- `ON DELETE CASCADE` en todas las FK para limpieza automática.

---

## Cambio 2: Fix `obtener_standings_torneo`

### Contexto

El RPC actual retorna `puntos, ds, gf, posicion_en_grupo, grupo_completo` pero le falta:
- `dg` (diferencia de games = games_for - games_against)
- `gc` (games contra)
- `sorteo_orden` (orden del sorteo si existe)

El ORDER BY del ROW_NUMBER actual es: `puntos DESC, ds DESC, gf DESC, pareja_id`.
El nuevo debe ser: `puntos DESC, ds DESC, dg DESC, gf DESC, COALESCE(sorteo_orden, 999999) ASC, pareja_id`.

### SQL actual (referencia — NO copiar)

Archivo: `supabase/migrations/20260225000000_add_esquemas_copa.sql`, líneas 94-195.

Columnas actuales del output:
```
grupo_id, pareja_id, puntos, ds, gf, posicion_en_grupo, grupo_completo
```

CTEs actuales:
- `res_a`: calcula `pg.gta AS gf` (games a favor desde perspectiva A)
- `res_b`: calcula `pg.gtb AS gf` (games a favor desde perspectiva B)
- `stats`: `SUM(gf) AS gf` — solo games a favor, NO calcula games contra ni diferencia

### SQL nuevo (reemplazo completo)

```sql
CREATE OR REPLACE FUNCTION public.obtener_standings_torneo(p_torneo_id UUID)
RETURNS TABLE (
  grupo_id          UUID,
  pareja_id         UUID,
  puntos            INTEGER,
  ds                INTEGER,
  gf                INTEGER,
  gc                INTEGER,           -- NUEVO: games contra
  dg                INTEGER,           -- NUEVO: diferencia de games (gf - gc)
  posicion_en_grupo INTEGER,
  grupo_completo    BOOLEAN,
  sorteo_orden      INTEGER            -- NUEVO: orden del sorteo (NULL si no hay)
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH
  pg AS (
    SELECT
      pt.grupo_id,
      pt.pareja_a_id,
      pt.pareja_b_id,
      pt.estado,
      pt.sets_a,
      pt.sets_b,
      COALESCE(pt.games_totales_a, 0) AS gta,
      COALESCE(pt.games_totales_b, 0) AS gtb
    FROM partidos pt
    WHERE pt.torneo_id   = p_torneo_id
      AND pt.copa_id     IS NULL
      AND pt.grupo_id    IS NOT NULL
  ),

  gc AS (
    SELECT grupo_id
    FROM pg
    GROUP BY grupo_id
    HAVING COUNT(*) > 0
       AND COUNT(*) = COUNT(CASE WHEN sets_a IS NOT NULL THEN 1 END)
  ),

  res_a AS (
    SELECT
      pg.grupo_id,
      pg.pareja_a_id AS pareja_id,
      CASE WHEN pg.sets_a > pg.sets_b THEN 2 ELSE 1 END AS pts,
      pg.sets_a AS sf,
      pg.sets_b AS sc,
      pg.gta    AS gf,
      pg.gtb    AS gc          -- NUEVO: games contra desde perspectiva A
    FROM pg
    WHERE pg.sets_a IS NOT NULL
  ),

  res_b AS (
    SELECT
      pg.grupo_id,
      pg.pareja_b_id AS pareja_id,
      CASE WHEN pg.sets_b > pg.sets_a THEN 2 ELSE 1 END AS pts,
      pg.sets_b AS sf,
      pg.sets_a AS sc,
      pg.gtb    AS gf,
      pg.gta    AS gc          -- NUEVO: games contra desde perspectiva B
    FROM pg
    WHERE pg.sets_a IS NOT NULL
  ),

  stats AS (
    SELECT
      grupo_id,
      pareja_id,
      SUM(pts)::integer            AS puntos,
      (SUM(sf) - SUM(sc))::integer AS ds,
      SUM(gf)::integer             AS gf,
      SUM(gc)::integer             AS gc,                        -- NUEVO
      (SUM(gf) - SUM(gc))::integer AS dg                        -- NUEVO
    FROM (SELECT * FROM res_a UNION ALL SELECT * FROM res_b) r
    GROUP BY grupo_id, pareja_id
  ),

  ranked AS (
    SELECT
      s.*,
      ROW_NUMBER() OVER (
        PARTITION BY s.grupo_id
        ORDER BY
          s.puntos DESC,
          s.ds     DESC,
          s.dg     DESC,                                         -- NUEVO
          s.gf     DESC,
          COALESCE(so.orden_sorteo, 999999) ASC,                 -- NUEVO
          s.pareja_id
      )::integer AS posicion_en_grupo
    FROM stats s
    LEFT JOIN sorteos so                                          -- NUEVO
      ON so.torneo_id = p_torneo_id
      AND so.pareja_id = s.pareja_id
  )

  SELECT
    r.grupo_id,
    r.pareja_id,
    r.puntos,
    r.ds,
    r.gf,
    r.gc,                                                         -- NUEVO
    r.dg,                                                         -- NUEVO
    r.posicion_en_grupo,
    (gcomp.grupo_id IS NOT NULL) AS grupo_completo,
    so.orden_sorteo AS sorteo_orden                               -- NUEVO
  FROM ranked r
  LEFT JOIN gc gcomp ON gcomp.grupo_id = r.grupo_id
  LEFT JOIN sorteos so                                            -- NUEVO
    ON so.torneo_id = p_torneo_id
    AND so.pareja_id = r.pareja_id;
$$;
```

### Cambios respecto al original

| Aspecto | Antes | Después |
|---------|-------|---------|
| Columnas output | `puntos, ds, gf, posicion_en_grupo, grupo_completo` | + `gc, dg, sorteo_orden` |
| `res_a` / `res_b` | Solo `gf` | + `gc` (games contra) |
| `stats` | Solo `gf` | + `gc`, `dg = gf - gc` |
| ROW_NUMBER ORDER BY | `puntos, ds, gf, pareja_id` | `puntos, ds, dg, gf, COALESCE(sorteo, 999999), pareja_id` |
| JOINs | Ninguno extra | LEFT JOIN `sorteos` (2 veces: en ranked y en SELECT final) |

### Nota sobre alias de CTE

El CTE `gc` (grupos completos) colisiona con la nueva columna `gc` (games contra). En el SQL de arriba, el CTE `gc` se renombró a `gcomp` en el SELECT final para evitar ambigüedad. **El implementador debe usar `gcomp` como alias del CTE de grupos completos en el LEFT JOIN final.**

---

## Cambio 3: Nueva RPC `crear_partidos_copa`

### Contexto

Reemplaza a `aprobar_propuestas_copa` para el flujo v2. En lugar de leer de `propuestas_copa`, recibe los cruces calculados client-side como JSONB y crea copa + partidos directamente.

La lógica de creación de copa + partidos se toma de `aprobar_propuestas_copa` (archivo `supabase/migrations/20260309100000_propuestas_progresivas.sql`, líneas 297-370) pero sin tocar `propuestas_copa`.

### Formato del parámetro `p_cruces`

```json
[
  { "ronda": "SF",  "orden": 1, "pareja_a_id": "uuid-1", "pareja_b_id": "uuid-2" },
  { "ronda": "SF",  "orden": 2, "pareja_a_id": "uuid-3", "pareja_b_id": "uuid-4" }
]
```

Valores válidos de `ronda`: `'SF'`, `'F'`, `'3P'`, `'QF'`, `'direct'`.

### SQL

```sql
CREATE OR REPLACE FUNCTION public.crear_partidos_copa(
  p_esquema_copa_id UUID,
  p_cruces          JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_esquema   RECORD;
  v_copa_id   UUID;
  v_torneo_id UUID;
  v_cruce     JSONB;
  v_partidos  INTEGER := 0;
BEGIN
  -- Cargar esquema
  SELECT ec.id, ec.torneo_id, ec.nombre, ec.orden
  INTO v_esquema
  FROM esquemas_copa ec
  WHERE ec.id = p_esquema_copa_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Esquema no encontrado');
  END IF;

  v_torneo_id := v_esquema.torneo_id;

  -- Crear copa si no existe (reutilizar en aprobaciones progresivas/parciales)
  SELECT id INTO v_copa_id
  FROM copas
  WHERE torneo_id = v_torneo_id
    AND esquema_copa_id = p_esquema_copa_id
  LIMIT 1;

  IF v_copa_id IS NULL THEN
    INSERT INTO copas (torneo_id, nombre, orden, esquema_copa_id)
    VALUES (v_torneo_id, v_esquema.nombre, v_esquema.orden, p_esquema_copa_id)
    RETURNING id INTO v_copa_id;
  END IF;

  -- Crear partidos desde cruces JSONB
  FOR v_cruce IN SELECT * FROM jsonb_array_elements(p_cruces)
  LOOP
    -- Validar que ambas parejas estén definidas
    IF (v_cruce->>'pareja_a_id') IS NULL OR (v_cruce->>'pareja_b_id') IS NULL THEN
      CONTINUE;  -- Saltar cruces incompletos (slots pendientes)
    END IF;

    -- Evitar duplicados: no crear si ya existe partido con mismas parejas en misma copa+ronda
    IF EXISTS (
      SELECT 1 FROM partidos
      WHERE copa_id = v_copa_id
        AND ronda_copa = v_cruce->>'ronda'
        AND orden_copa = (v_cruce->>'orden')::integer
    ) THEN
      CONTINUE;  -- Ya existe, saltar
    END IF;

    INSERT INTO partidos (
      torneo_id, copa_id, ronda_copa, orden_copa,
      pareja_a_id, pareja_b_id, estado
    )
    VALUES (
      v_torneo_id,
      v_copa_id,
      v_cruce->>'ronda',
      (v_cruce->>'orden')::integer,
      (v_cruce->>'pareja_a_id')::uuid,
      (v_cruce->>'pareja_b_id')::uuid,
      'pendiente'
    );

    v_partidos := v_partidos + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'copa_id', v_copa_id,
    'partidos_creados', v_partidos
  );
END;
$$;
```

### Diferencias con `aprobar_propuestas_copa`

| Aspecto | `aprobar_propuestas_copa` | `crear_partidos_copa` |
|---------|--------------------------|----------------------|
| Input | Lee de `propuestas_copa` | Recibe `p_cruces` JSONB |
| Side effects | Actualiza `propuestas_copa.estado` | No toca `propuestas_copa` |
| Idempotencia | Reutiliza copa existente | Reutiliza copa existente + skip duplicados por `copa_id + ronda + orden` |
| Parámetros | `p_esquema_copa_id, p_propuesta_ids[]` | `p_esquema_copa_id, p_cruces JSONB` |
| Return | `{copa_id, partidos_creados}` | `{copa_id, partidos_creados}` (mismo formato) |

---

## Archivo de migración completo

Crear: `supabase/migrations/20260310000000_copa_approval_v2_foundation.sql`

El archivo debe contener los 3 cambios en este orden:
1. `CREATE TABLE sorteos` + RLS policies
2. `CREATE OR REPLACE FUNCTION obtener_standings_torneo` (reemplazo completo)
3. `CREATE OR REPLACE FUNCTION crear_partidos_copa` (nueva)

---

## Verificación

### Paso 1: Aplicar migración
Ejecutar el SQL en el dashboard de Supabase o via CLI.

### Paso 2: Verificar `sorteos`
```sql
-- Debe retornar columnas: id, torneo_id, grupo_id, pareja_id, orden_sorteo, tipo, created_at
SELECT * FROM sorteos LIMIT 0;
```

### Paso 3: Verificar `obtener_standings_torneo`
```sql
-- Usar el TORNEO_ID conocido
SELECT * FROM obtener_standings_torneo('ad58a855-fa74-4c2e-825e-32c20f972136');
```

Verificar que:
- Las columnas `dg`, `gc`, `sorteo_orden` aparecen en el output
- `dg = gf - gc` para cada fila
- `sorteo_orden` es NULL (no hay sorteos cargados aún)
- `posicion_en_grupo` es coherente con el orden esperado

### Paso 4: Verificar `crear_partidos_copa`
```sql
-- Test con datos de prueba (requiere un esquema_copa_id válido y parejas válidas)
-- NOTA: Esto crea datos reales. Usar reset_copas_torneo después si es necesario.
SELECT crear_partidos_copa(
  'ESQUEMA_ID_AQUI'::uuid,
  '[
    {"ronda": "SF", "orden": 1, "pareja_a_id": "PAREJA_1", "pareja_b_id": "PAREJA_2"},
    {"ronda": "SF", "orden": 2, "pareja_a_id": "PAREJA_3", "pareja_b_id": "PAREJA_4"}
  ]'::jsonb
);

-- Verificar que se crearon copa y partidos
SELECT * FROM copas WHERE esquema_copa_id = 'ESQUEMA_ID_AQUI';
SELECT * FROM partidos WHERE copa_id = (SELECT id FROM copas WHERE esquema_copa_id = 'ESQUEMA_ID_AQUI' LIMIT 1);

-- Limpiar si es necesario
SELECT reset_copas_torneo('ad58a855-fa74-4c2e-825e-32c20f972136');
```

### Paso 5: Verificar app existente
- `npm run dev` → abrir la app
- Navegar a admin.html → Tab Copas → debe funcionar igual que antes
- Navegar a index.html → vista de jugador → debe funcionar igual

### Paso 6: Build
```bash
npm run build
```
Debe compilar sin errores (no hay cambios JS en esta etapa).

---

## Notas para el implementador

1. **No modificar ningún archivo JS** en esta etapa. Solo crear el archivo SQL de migración.
2. **No borrar tablas ni RPCs existentes**. `propuestas_copa`, `posiciones_manual`, `verificar_y_proponer_copas`, `aprobar_propuestas_copa` siguen existiendo.
3. El CTE `gc` del RPC original (grupos completos) se renombró a `gcomp` en el SELECT final para evitar colisión con la nueva columna `gc` (games contra). Respetar este rename.
4. El LEFT JOIN a `sorteos` aparece DOS veces: una en el CTE `ranked` (para el ORDER BY del ROW_NUMBER) y otra en el SELECT final (para retornar `sorteo_orden` al caller).
5. El `COALESCE(so.orden_sorteo, 999999)` asegura que equipos sin sorteo queden al final del desempate (orden alto = peor posición).
