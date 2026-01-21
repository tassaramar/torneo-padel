# Políticas RLS (Row Level Security) - Estado Actual

**Fecha:** 2026-01-21  
**Proyecto:** torneo-padel

## 📋 Estado de RLS por Tabla

| Tabla | RLS Habilitado | Políticas Activas | Acceso |
|-------|----------------|-------------------|--------|
| `torneos` | ✅ Sí | 1 | Público completo |
| `copas` | ✅ Sí | 7 | Público + reglas específicas |
| `grupos` | ✅ Sí | 1 | Público completo |
| `parejas` | ✅ Sí | 1 | Público completo |
| `partidos` | ✅ Sí | 1 | Público completo |
| `posiciones_manual` | ❌ No | 0 | Sin RLS (acceso completo) |
| `tracking_eventos` | ⚠️ Por verificar | ? | A revisar |

## 📝 Políticas Detalladas por Tabla

### 1. Tabla: `torneos`

**RLS:** ✅ Habilitado

```sql
-- Policy: public access torneos
-- Permite: SELECT, INSERT, UPDATE, DELETE
-- Roles: public
-- Condición: Sin restricciones (true)
```

**Resumen:** Acceso público completo a todos los torneos.

---

### 2. Tabla: `copas`

**RLS:** ✅ Habilitado

La tabla `copas` tiene múltiples políticas que pueden causar confusión. A continuación las políticas activas:

#### Políticas de SELECT (Lectura)

```sql
-- Policy: copas_read_only
-- Permite: SELECT
-- Roles: public
-- Condición: true (sin restricciones)

-- Policy: copas_select
-- Permite: SELECT  
-- Roles: anon, authenticated
-- Condición: true (sin restricciones)

-- Policy: copas_select_anon
-- Permite: SELECT
-- Roles: anon, authenticated
-- Condición: torneo_id = 'ad58a855-fa74-4c2e-825e-32c20f972136'
```

#### Políticas de INSERT (Creación)

```sql
-- Policy: copas_insert
-- Permite: INSERT
-- Roles: anon, authenticated
-- Condición: true (sin restricciones)

-- Policy: copas_insert_anon
-- Permite: INSERT
-- Roles: anon, authenticated
-- Condición: torneo_id = 'ad58a855-fa74-4c2e-825e-32c20f972136'
```

#### Políticas de UPDATE (Actualización)

```sql
-- Policy: copas_update_public
-- Permite: UPDATE
-- Roles: public
-- Condición: true (sin restricciones)
```

#### Políticas de DELETE (Eliminación)

```sql
-- Policy: copas_delete_public
-- Permite: DELETE
-- Roles: public
-- Condición: true (sin restricciones)
```

**⚠️ Nota:** Hay políticas contradictorias en `copas`. Algunas restringen a un torneo específico mientras otras permiten acceso completo. Se recomienda limpiar estas políticas.

---

### 3. Tabla: `grupos`

**RLS:** ✅ Habilitado

```sql
-- Policy: public access grupos
-- Permite: SELECT, INSERT, UPDATE, DELETE (ALL)
-- Roles: public
-- Condición: Sin restricciones (true)
```

**Resumen:** Acceso público completo a todos los grupos.

---

### 4. Tabla: `parejas`

**RLS:** ✅ Habilitado

```sql
-- Policy: public access parejas
-- Permite: SELECT, INSERT, UPDATE, DELETE (ALL)
-- Roles: public
-- Condición: Sin restricciones (true)
```

**Resumen:** Acceso público completo a todas las parejas.

---

### 5. Tabla: `partidos`

**RLS:** ✅ Habilitado

```sql
-- Policy: public access partidos
-- Permite: SELECT, INSERT, UPDATE, DELETE (ALL)
-- Roles: public
-- Condición: Sin restricciones (true)
```

**Resumen:** Acceso público completo a todos los partidos.

---

### 6. Tabla: `posiciones_manual`

**RLS:** ❌ **Explícitamente DESHABILITADO**

```sql
ALTER TABLE public.posiciones_manual DISABLE ROW LEVEL SECURITY;
```

**Resumen:** Sin restricciones RLS. Acceso completo desde cualquier rol.

---

### 7. Tabla: `tracking_eventos`

**RLS:** ⚠️ Estado por verificar

Esta tabla fue agregada recientemente. Se necesita verificar:
- Si RLS está habilitado
- Qué políticas están aplicadas
- Si requiere restricciones específicas

---

## 🔍 Observaciones y Recomendaciones

### ⚠️ Problemas Detectados

1. **Políticas Redundantes en `copas`**
   - Múltiples políticas con diferentes restricciones para los mismos roles
   - Algunas políticas contradictorias (unas permiten todo, otras restringen a un torneo específico)
   - **Recomendación:** Limpiar y consolidar en un conjunto simple de políticas

2. **UUID Hardcodeado**
   - Varias políticas en `copas` tienen el UUID `ad58a855-fa74-4c2e-825e-32c20f972136` hardcodeado
   - **Recomendación:** Eliminar estas políticas específicas si no son necesarias

3. **Acceso Público Completo**
   - La mayoría de las tablas tienen acceso público sin restricciones
   - **Pregunta:** ¿Es intencional que todo sea público? ¿O se necesita autenticación?

4. **Tabla `tracking_eventos` Sin Políticas Documentadas**
   - **Recomendación:** Definir políticas para la nueva tabla

### ✅ Configuración Actual

La configuración actual permite:
- ✅ Lectura pública de todos los datos
- ✅ Escritura pública en todas las tablas
- ✅ Sin autenticación requerida

Esta configuración es apropiada para:
- Aplicaciones completamente públicas
- Prototipos y desarrollo
- Torneos sin información sensible

### 🔒 Si Se Necesita Mayor Seguridad

Si se requiere restringir accesos, considerar:

1. **Lectura pública, escritura autenticada:**
```sql
-- SELECT: permitir a public
-- INSERT/UPDATE/DELETE: solo authenticated
```

2. **Restricción por torneo:**
```sql
-- Solo permitir acceso a datos del torneo específico
-- Usar una función que identifique el torneo del usuario
```

3. **Control por pareja:**
```sql
-- Las parejas solo pueden editar sus propios resultados
-- Requiere identificación de pareja en la sesión
```

---

## 📚 Archivos Relacionados

- `rls_policies.sql` - Script SQL con políticas actuales
- `dbPolicies.json` - Políticas en formato JSON
- `schema-actualizado-2026-01-21.sql` - Schema completo de la base de datos

---

## 🔧 Scripts Útiles

### Verificar Estado de RLS

```sql
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Listar Todas las Políticas

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Verificar Políticas de una Tabla Específica

```sql
SELECT 
    policyname,
    cmd,
    roles,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'nombre_tabla'
ORDER BY cmd, policyname;
```
