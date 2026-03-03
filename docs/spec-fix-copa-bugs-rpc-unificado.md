# Spec: Fix bugs copa + RPC unificado `avanzar_ronda_copa`

**Estado**: 📋 PRIORIZADA — lista para implementar
**Bugs que resuelve**: Bug 1 (final no se genera) + Bug 2 (modo global genera 1 cruce en vez de 2)
**Mejora incluida**: Soporte para brackets de 8 equipos (QF) gratis

---

## Resumen

Dos cambios:
1. **Migración SQL**: fix `verificar_y_proponer_copas` (modo global) + nuevo RPC `avanzar_ronda_copa` (reemplaza `generar_finales_copa`)
2. **Frontend JS**: agregar fire-and-forget a `avanzar_ronda_copa` en 3 archivos

---

## Cambio 1: Migración SQL

**Archivo a crear**: `supabase/migrations/20260303000000_fix_copa_avanzar_ronda.sql`

Esta migración hace 3 cosas:

### 1A. Fix `verificar_y_proponer_copas` — agregar rama `modo:'global'`

**Problema**: Las reglas con `{modo:'global', desde:1, hasta:4}` no se manejan. Caen en la rama que lee `posicion` (que es NULL para reglas globales) → `WHERE posicion_en_grupo = NULL` → 0 equipos → salta el esquema → genera 0 o 1 propuesta.

**Fix**: En la función `verificar_y_proponer_copas`, dentro del loop `FOR v_regla IN ...`, agregar una rama **antes** del `END IF` de criterios (después de la rama `ELSIF v_criterio = 'peor'`):

```sql
ELSIF (v_regla->>'modo') = 'global' THEN
  -- Seeding por ranking global del torneo (tabla general)
  SELECT array_agg(ranked.pareja_id)
  INTO v_nuevos
  FROM (
    SELECT s.pareja_id
    FROM obtener_standings_torneo(p_torneo_id) s
    WHERE s.grupo_completo = TRUE
      AND s.pareja_id <> ALL(v_ya_asignados)
      AND s.pareja_id <> ALL(v_equipos)
    ORDER BY s.puntos DESC, s.ds DESC, s.gf DESC
    LIMIT ((v_regla->>'hasta')::INTEGER - (v_regla->>'desde')::INTEGER + 1)
    OFFSET ((v_regla->>'desde')::INTEGER - 1)
  ) ranked;
```

**Contexto del código existente** (en la migración `20260225000000_add_esquemas_copa.sql`, líneas 258-304):

```sql
-- Evaluar cada regla del esquema
FOR v_regla IN SELECT jsonb_array_elements(v_esquema.reglas)
LOOP
  v_posicion := (v_regla->>'posicion')::INTEGER;
  v_cantidad := (v_regla->>'cantidad')::INTEGER;
  v_criterio := v_regla->>'criterio';

  IF v_criterio IS NULL THEN
    -- tomar N-ésimo de cada grupo ...
  ELSIF v_criterio = 'mejor' THEN
    -- mejores N-ésimos ...
  ELSIF v_criterio = 'peor' THEN
    -- peores N-ésimos ...
  END IF;  -- ← AGREGAR la rama 'global' ANTES de este END IF
```

La función completa se reemplaza con `CREATE OR REPLACE FUNCTION`. Copiar todo el cuerpo actual y agregar la rama.

### 1B. Agregar soporte bracket de 8 equipos en `verificar_y_proponer_copas`

En la misma función, en la sección de creación de propuestas (líneas 317-338), agregar rama para 8 equipos **antes** de la rama `ELSIF v_len >= 4`:

```sql
-- Crear propuestas según formato y cantidad de equipos
IF v_esquema.formato = 'direct' OR v_len = 2 THEN
  -- Cruce directo (sin cambios)
  ...

ELSIF v_len >= 8 THEN
  -- Bracket de 8: cuartos de final con seeding estándar
  INSERT INTO propuestas_copa (esquema_copa_id, ronda, pareja_a_id, pareja_b_id, orden)
  VALUES
    (v_esquema.id, 'QF', v_equipos[1], v_equipos[8], 1),
    (v_esquema.id, 'QF', v_equipos[2], v_equipos[7], 2),
    (v_esquema.id, 'QF', v_equipos[3], v_equipos[6], 3),
    (v_esquema.id, 'QF', v_equipos[4], v_equipos[5], 4);
  v_propuestas := v_propuestas + 4;

ELSIF v_len >= 4 THEN
  -- Bracket de 4: semifinal (sin cambios)
  ...
```

**IMPORTANTE**: La rama `v_len >= 8` debe ir ANTES de `v_len >= 4` para que 8 equipos no caigan en la rama de 4.

### 1C. Nuevo RPC `avanzar_ronda_copa` (reemplaza `generar_finales_copa`)

**Función genérica** que avanza el bracket de una copa al detectar que todos los partidos de una ronda están confirmados.

```sql
-- ============================================================
-- FUNCIÓN: avanzar_ronda_copa
-- Avanza el bracket de una copa: cuando todos los partidos de una
-- ronda están confirmados, genera los partidos de la siguiente ronda.
-- Genérico: funciona para QF→SF, SF→F(+3P), etc.
-- Idempotente: si la siguiente ronda ya tiene partidos, no crea duplicados.
-- Reemplaza a generar_finales_copa.
-- Llamar con: SELECT avanzar_ronda_copa('<copa_id>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.avanzar_ronda_copa(p_copa_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copa              RECORD;
  v_ronda_actual      TEXT;
  v_ronda_siguiente   TEXT;
  v_partidos_ronda    RECORD[];
  v_partido           RECORD;
  v_ganadores         UUID[];
  v_perdedores        UUID[];
  v_ganador           UUID;
  v_perdedor          UUID;
  v_total             INTEGER;
  v_confirmados       INTEGER;
  v_partidos_creados  INTEGER := 0;
  v_i                 INTEGER;
BEGIN
  -- Validar copa
  SELECT * INTO v_copa FROM copas WHERE id = p_copa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Copa no encontrada');
  END IF;

  -- Intentar avanzar cada ronda posible: QF → SF → F
  -- (iterar en orden, la primera que pueda avanzar se procesa)
  FOREACH v_ronda_actual IN ARRAY ARRAY['QF', 'SF']
  LOOP
    -- Determinar siguiente ronda
    IF v_ronda_actual = 'QF' THEN
      v_ronda_siguiente := 'SF';
    ELSIF v_ronda_actual = 'SF' THEN
      v_ronda_siguiente := 'F';
    END IF;

    -- Contar partidos de esta ronda
    SELECT COUNT(*) INTO v_total
    FROM partidos
    WHERE copa_id = p_copa_id AND ronda_copa = v_ronda_actual;

    -- Si no hay partidos de esta ronda, pasar a la siguiente
    IF v_total = 0 THEN
      CONTINUE;
    END IF;

    -- Contar confirmados con resultado
    SELECT COUNT(*) INTO v_confirmados
    FROM partidos
    WHERE copa_id = p_copa_id
      AND ronda_copa = v_ronda_actual
      AND estado = 'confirmado'
      AND sets_a IS NOT NULL;

    -- Si no están todos confirmados, no se puede avanzar
    IF v_confirmados < v_total THEN
      CONTINUE;
    END IF;

    -- Verificar idempotencia: si ya hay partidos de la siguiente ronda, skip
    IF EXISTS (
      SELECT 1 FROM partidos
      WHERE copa_id = p_copa_id AND ronda_copa = v_ronda_siguiente
    ) THEN
      CONTINUE;
    END IF;

    -- Recolectar ganadores y perdedores, ordenados por orden_copa
    v_ganadores := ARRAY[]::UUID[];
    v_perdedores := ARRAY[]::UUID[];

    FOR v_partido IN
      SELECT * FROM partidos
      WHERE copa_id = p_copa_id AND ronda_copa = v_ronda_actual
      ORDER BY orden_copa
    LOOP
      IF v_partido.sets_a > v_partido.sets_b THEN
        v_ganador := v_partido.pareja_a_id;
        v_perdedor := v_partido.pareja_b_id;
      ELSE
        v_ganador := v_partido.pareja_b_id;
        v_perdedor := v_partido.pareja_a_id;
      END IF;

      v_ganadores := array_append(v_ganadores, v_ganador);
      v_perdedores := array_append(v_perdedores, v_perdedor);
    END LOOP;

    -- Crear partidos de la siguiente ronda:
    -- Emparejar ganadores: [1] vs [2] → orden 1, [3] vs [4] → orden 2, etc.
    v_i := 1;
    WHILE v_i < array_length(v_ganadores, 1) LOOP
      INSERT INTO partidos (torneo_id, copa_id, ronda_copa, orden_copa, pareja_a_id, pareja_b_id, estado)
      VALUES (v_copa.torneo_id, p_copa_id, v_ronda_siguiente, (v_i + 1) / 2,
              v_ganadores[v_i], v_ganadores[v_i + 1], 'pendiente');
      v_partidos_creados := v_partidos_creados + 1;
      v_i := v_i + 2;
    END LOOP;

    -- Crear 3er y 4to puesto SOLO cuando avanzamos a Final (SF → F)
    -- y hay exactamente 2 perdedores
    IF v_ronda_siguiente = 'F' AND array_length(v_perdedores, 1) = 2 THEN
      -- Solo crear si no existe ya
      IF NOT EXISTS (
        SELECT 1 FROM partidos
        WHERE copa_id = p_copa_id AND ronda_copa = '3P'
      ) THEN
        INSERT INTO partidos (torneo_id, copa_id, ronda_copa, orden_copa, pareja_a_id, pareja_b_id, estado)
        VALUES (v_copa.torneo_id, p_copa_id, '3P', 1,
                v_perdedores[1], v_perdedores[2], 'pendiente');
        v_partidos_creados := v_partidos_creados + 1;
      END IF;
    END IF;

    -- Se procesó una ronda, retornar (una ronda por llamada)
    RETURN jsonb_build_object(
      'ronda_completada', v_ronda_actual,
      'ronda_creada', v_ronda_siguiente,
      'partidos_creados', v_partidos_creados
    );

  END LOOP;

  -- Ninguna ronda pudo avanzar
  RETURN jsonb_build_object('msg', 'Nada que avanzar');
END;
$$;
```

### 1D. Eliminar `generar_finales_copa`

Al final de la migración:
```sql
DROP FUNCTION IF EXISTS public.generar_finales_copa(UUID);
```

---

## Cambio 2: Frontend JS (3 archivos)

### 2A. `src/viewer/cargarResultado.js`

Hay 2 lugares donde se confirma un resultado (fire-and-forget a `verificar_y_proponer_copas`). Después de cada uno, agregar el fire-and-forget a `avanzar_ronda_copa`.

**Lugar 1 — línea ~128-132** (confirmación directa, ambas parejas coinciden):

```javascript
// CÓDIGO EXISTENTE (no tocar):
// Fire-and-forget: disparar motor de propuestas de copas
if (partido.torneo_id) {
  supabase.rpc('verificar_y_proponer_copas', { p_torneo_id: partido.torneo_id })
    .then(({ error }) => { if (error) console.warn('Motor copas:', error.message); })
    .catch(err => console.warn('Motor copas:', err));
}

// AGREGAR DESPUÉS:
// Fire-and-forget: avanzar bracket si es partido de copa
if (partido.copa_id) {
  supabase.rpc('avanzar_ronda_copa', { p_copa_id: partido.copa_id })
    .then(({ error }) => { if (error) console.warn('Avanzar ronda copa:', error.message); });
}
```

**Lugar 2 — línea ~316-321** (aceptar resultado del otro en revisión):

Mismo patrón: después del `verificar_y_proponer_copas` existente, agregar el bloque de `avanzar_ronda_copa`.

### 2B. `src/carga/partidosGrupos.js`

Archivo: ya tiene `dispararMotorCopas()` en línea 7-11 que llama `verificar_y_proponer_copas`.

**No necesita cambios para `avanzar_ronda_copa`** porque este archivo solo maneja partidos de GRUPOS (no de copa). Los partidos de copa se manejan en `src/carga/copas.js`.

### 2C. `src/carga/copas.js`

**Problema**: Al guardar resultado de un partido de copa desde `carga.html`, no se dispara ningún RPC.

**Fix**: Después de guardar exitosamente en `guardarResultadoComoSet` (dentro del `onSave` callback, línea ~120-124), agregar fire-and-forget.

El `onSave` actual es:
```javascript
onSave: async (ga, gb) => {
  const ok = await guardarResultadoComoSet(supabase, p.id, ga, gb);
  if (ok) {
    await onAfterSave?.();
  }
  return ok;
}
```

Cambiar a:
```javascript
onSave: async (ga, gb) => {
  const ok = await guardarResultadoComoSet(supabase, p.id, ga, gb);
  if (ok) {
    // Fire-and-forget: avanzar bracket de copa
    if (p.copas?.id) {
      supabase.rpc('avanzar_ronda_copa', { p_copa_id: p.copas.id })
        .then(({ error }) => { if (error) console.warn('Avanzar ronda copa:', error.message); });
    }
    await onAfterSave?.();
  }
  return ok;
}
```

**Nota sobre `p.copas.id`**: El query de copas.js ya hace `.select('copas ( id, nombre, orden )')` (línea 46), así que `p.copas.id` tiene el ID de la copa.

### 2D. `src/admin/copas/planService.js`

**Renombrar** la función `generarFinalesCopa` a `avanzarRondaCopa` y cambiar el RPC que llama:

```javascript
// ANTES (líneas 202-212):
export async function generarFinalesCopa(supabase, copaId) {
  const { data, error } = await supabase
    .rpc('generar_finales_copa', { p_copa_id: copaId });
  ...
}

// DESPUÉS:
export async function avanzarRondaCopa(supabase, copaId) {
  const { data, error } = await supabase
    .rpc('avanzar_ronda_copa', { p_copa_id: copaId });

  if (error) {
    console.error('Error avanzando ronda copa:', error);
    return { ok: false, msg: error.message };
  }

  return { ok: true, partidos_creados: data?.partidos_creados ?? 0, msg: data?.msg };
}
```

**Buscar importadores de `generarFinalesCopa`**: Verificar con grep que nadie importa esta función. Si alguien la importa, actualizar el import al nuevo nombre.

---

## Verificación

1. `npm run build` — sin errores
2. Testing manual siguiendo [testing-guide-copas.md](testing-guide-copas.md):
   - **Bug 2 (paso 9)**: Crear preset custom con seeding global para copa de 4 equipos → aprobar → debe generar 2 cruces de semifinal (no 1)
   - **Bug 1 (paso 18)**: Confirmar ambas semis → la final + 3er puesto deben crearse automáticamente
3. Idempotencia: refrescar la página después de que se generen las finales → no deben duplicarse

---

## Archivos tocados (resumen)

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/20260303000000_fix_copa_avanzar_ronda.sql` | **CREAR** — migración con fix de verificar_y_proponer_copas + nuevo avanzar_ronda_copa + drop generar_finales_copa |
| `src/viewer/cargarResultado.js` | **EDITAR** — agregar fire-and-forget a `avanzar_ronda_copa` en 2 lugares |
| `src/carga/copas.js` | **EDITAR** — agregar fire-and-forget a `avanzar_ronda_copa` en onSave |
| `src/admin/copas/planService.js` | **EDITAR** — renombrar `generarFinalesCopa` → `avanzarRondaCopa`, cambiar RPC |

---

## Aplicar migración en Supabase

La migración debe aplicarse en la BD de producción. Dos opciones:
- **Supabase Dashboard** → SQL Editor → pegar el contenido de la migración
- **Supabase MCP** → usar `apply_migration` con el contenido SQL
