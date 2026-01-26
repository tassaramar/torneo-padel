# Guía para Restaurar Backup de Supabase

> **Nota:** Basado en las recomendaciones oficiales de Supabase AI

## Opción 1: SQL Editor del Dashboard (MÁS SIMPLE) ⭐

Esta es la forma más simple y confiable:

1. **Abre el SQL Editor:**
   - Ve a: https://supabase.com/dashboard/project/mwrruwgviwsngdwwraql/sql/new

2. **Abre el archivo de backup:**
   - El archivo está en: `backups/backup-2026-01-23-142233.sql`
   - Abre el archivo en un editor de texto
   - Copia TODO el contenido (Ctrl+A, Ctrl+C)

3. **Pega y ejecuta:**
   - Pega el contenido en el SQL Editor
   - Haz clic en "Run" o presiona Ctrl+Enter
   - Espera a que termine (puede tardar varios minutos)

4. **Verifica:**
   - Revisa que no haya errores críticos
   - Algunos errores como "already exists" son normales

---

## Opción 2: Script Node.js (Alternativa)

Si prefieres usar el script:

```powershell
# Ejecutar el script mejorado
node scripts/restore-backup-split.mjs
```

Este script:
- Divide el SQL en comandos individuales
- Maneja errores de manera más robusta
- Salta comandos de roles que pueden causar problemas
- Muestra progreso detallado

**Nota:** Necesitarás la connection string completa del dashboard.

---

## Opción 3: Usar psql directamente (RECOMENDADO por Supabase AI)

Si tienes `psql` instalado, esta es la forma recomendada oficialmente:

### Pasos:

1. **Obtener Connection String del Session Pooler:**
   - Ve a: https://supabase.com/dashboard/project/mwrruwgviwsngdwwraql/settings/database
   - En "Connection string", selecciona modo **"Session"** (pooler)
   - Copia la URI completa
   - Formato esperado: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`

2. **Verificar conexión (opcional):**
   ```powershell
   psql "postgresql://postgres.mwrruwgviwsngdwwraql:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres" -c "SELECT 1;"
   ```

3. **Restaurar el backup:**
   ```powershell
   psql "postgresql://postgres.mwrruwgviwsngdwwraql:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres" -f backups/backup-2026-01-23-142233.sql
   ```

4. **Después de restaurar, ejecutar VACUUM:**
   ```powershell
   psql "postgresql://postgres.mwrruwgviwsngdwwraql:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres" -c "VACUUM VERBOSE ANALYZE;"
   ```

**Nota:** Reemplaza `[PASSWORD]` con tu contraseña real de PostgreSQL.

---

## Solución de Problemas

### Error: "role already exists"
- **Normal:** Los roles ya existen en Supabase
- **Solución:** Ignora estos errores o elimina las líneas CREATE ROLE del backup antes de ejecutar

### Error: "relation already exists"
- **Normal:** Si ya tienes tablas, algunos comandos fallarán
- **Solución:** El script dividido maneja esto automáticamente, o puedes comentar las líneas CREATE TABLE

### Error: "permission denied"
- **Causa:** No tienes permisos suficientes
- **Solución:** Usa la connection string con usuario `postgres.[PROJECT-REF]` (Session Pooler), no `anon`

### Error: "connection ... received invalid response to GSSAPI negotiation"
- **Causa:** Versión antigua de psql
- **Solución:** Actualiza psql a la versión más reciente (>= 16 recomendado)

### Error: "Wrong password"
- **Causa:** Contraseña incorrecta o recién reseteada
- **Solución:** Si acabas de resetear la contraseña, espera unos minutos antes de reintentar

### Error: Extension no encontrada
- **Causa:** La extensión no está instalada en el proyecto
- **Solución:** Instala la extensión desde Dashboard → Database → Extensions, o elimina esas líneas del SQL

### El backup es muy grande
- **Solución:** 
  - Usa el SQL Editor del dashboard (maneja mejor archivos grandes)
  - O ejecuta desde una VM en la misma región (West US) para mejor velocidad
  - O divide el backup en partes: roles.sql, schema.sql, data.sql

### Errores con "supabase_admin" o permisos de owner
- **Causa:** El backup intenta cambiar owners a roles que no existen
- **Solución:** Comenta las líneas `ALTER ... OWNER TO supabase_admin` antes de ejecutar

---

## Recomendación Final

**Orden de preferencia:**

1. **SQL Editor del Dashboard** - Más simple, no requiere instalaciones
2. **psql con Session Pooler** - Recomendado por Supabase para backups grandes, más rápido
3. **Script Node.js** - Alternativa si no tienes psql instalado

## Notas Importantes (de Supabase AI)

- **Usa Session Pooler** en lugar de Direct Connection para mejor compatibilidad
- **Algunos errores son normales:** "already exists", "does not exist" pueden ignorarse si son benignos
- **Extensiones:** Verifica que todas las extensiones estén instaladas en el proyecto
- **Roles:** Los roles personalizados pueden necesitar recreación manual
- **Storage:** Los objetos de Storage (archivos S3) NO están en el SQL dump, se migran por separado
- **RLS y Triggers:** Verifica que RLS y triggers estén correctamente configurados después de restaurar
