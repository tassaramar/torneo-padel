# Guía de Gestión de Backups

## 📦 Crear un Backup

### Opción 1: Desde el Dashboard de Supabase (Recomendado)

1. Ve a: https://supabase.com/dashboard/project/mwrruwgviwsngdwwraql/settings/database
2. Scroll hasta la sección **"Database Backups"**
3. Haz clic en **"Download backup"**
4. El archivo se descargará como `.sql` o `.backup` (formato PostgreSQL)

### Opción 2: Usando Supabase CLI

```powershell
# Obtener connection string del dashboard (Session Pooler)
# Luego ejecutar:
pg_dump "postgresql://postgres.mwrruwgviwsngdwwraql:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres" > backups/backup-$(Get-Date -Format "yyyy-MM-dd-HHmmss").sql
```

## 🔄 Restaurar un Backup

### Paso 1: Limpiar el Backup

Antes de restaurar, siempre limpia el backup para evitar errores de constraints duplicados:

```powershell
node scripts/clean-backup.mjs
```

Esto genera un archivo `backup-YYYY-MM-DD-HHMMSS-cleaned.sql` que:
- Comenta PRIMARY KEYs (ya están en CREATE TABLE)
- Elimina constraints antes de crearlos (FOREIGN KEY, UNIQUE, CHECK)
- Elimina índices antes de crearlos
- Elimina políticas RLS antes de crearlas
- Agrega `ON CONFLICT DO NOTHING` a todos los INSERTs
- Comenta comandos de roles problemáticos

### Paso 2: Restaurar el Backup Limpiado

#### Opción A: SQL Editor del Dashboard (MÁS SIMPLE) ⭐

1. Ve a: https://supabase.com/dashboard/project/mwrruwgviwsngdwwraql/sql/new
2. Abre el archivo `backups/backup-YYYY-MM-DD-HHMMSS-cleaned.sql`
3. Copia TODO el contenido (Ctrl+A, Ctrl+C)
4. Pégalo en el SQL Editor
5. Haz clic en "Run" o presiona Ctrl+Enter
6. Espera a que termine (puede tardar varios minutos)

#### Opción B: Usando psql (Recomendado por Supabase)

```powershell
# 1. Obtener connection string del Session Pooler desde el dashboard
# 2. Ejecutar:
psql "postgresql://postgres.mwrruwgviwsngdwwraql:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres" -f backups/backup-YYYY-MM-DD-HHMMSS-cleaned.sql

# 3. Después de restaurar, ejecutar VACUUM:
psql "postgresql://postgres.mwrruwgviwsngdwwraql:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres" -c "VACUUM VERBOSE ANALYZE;"
```

#### Opción C: Script Node.js

```powershell
node scripts/restore-backup.mjs
# O con el script dividido (maneja mejor errores):
node scripts/restore-backup-split.mjs
```

## 📁 Estructura de Backups

Los backups se guardan en la carpeta `backups/` con el formato:
- `backup-YYYY-MM-DD-HHMMSS.sql` - Backup original
- `backup-YYYY-MM-DD-HHMMSS-cleaned.sql` - Backup limpiado (generado automáticamente)

## ⚠️ Errores Comunes y Soluciones

### Error: "multiple primary keys"
- **Causa:** El backup intenta crear PRIMARY KEYs que ya existen
- **Solución:** Usa el script de limpieza (`clean-backup.mjs`) que comenta estas líneas

### Error: "constraint already exists"
- **Causa:** Constraints (FOREIGN KEY, UNIQUE, etc.) ya existen
- **Solución:** El script de limpieza agrega `DROP CONSTRAINT IF EXISTS` antes de crear

### Error: "index already exists"
- **Causa:** Índices ya existen
- **Solución:** El script de limpieza agrega `DROP INDEX IF EXISTS` antes de crear

### Error: "policy already exists"
- **Causa:** Políticas RLS ya existen
- **Solución:** El script de limpieza agrega `DROP POLICY IF EXISTS` antes de crear

### Error: "duplicate key value"
- **Causa:** Intentando insertar datos que ya existen
- **Solución:** El script de limpieza agrega `ON CONFLICT DO NOTHING` a todos los INSERTs

## 🔧 Scripts Disponibles

### `scripts/clean-backup.mjs`
Limpia un backup SQL para evitar errores de duplicados:
- Comenta PRIMARY KEYs
- Elimina constraints/índices/políticas antes de crearlos
- Agrega `ON CONFLICT DO NOTHING` a INSERTs

**Uso:**
```powershell
node scripts/clean-backup.mjs [archivo-entrada.sql] [archivo-salida.sql]
```

### `scripts/restore-backup.mjs`
Script principal para restaurar backups usando Node.js:
- Detecta automáticamente el backup más reciente
- Construye connection string automáticamente
- Ejecuta la restauración

**Uso:**
```powershell
node scripts/restore-backup.mjs [archivo-backup.sql] [connection-string]
```

### `scripts/restore-backup-split.mjs`
Script alternativo que divide el SQL en comandos individuales:
- Maneja errores de manera más robusta
- Salta comandos problemáticos
- Muestra progreso detallado

**Uso:**
```powershell
node scripts/restore-backup-split.mjs [archivo-backup.sql] [connection-string]
```

## 📝 Mejores Prácticas

1. **Siempre limpia el backup antes de restaurar** usando `clean-backup.mjs`
2. **Usa el SQL Editor del dashboard** para restauraciones simples (más confiable)
3. **Usa psql con Session Pooler** para backups grandes (más rápido)
4. **Verifica después de restaurar** que los datos se restauraron correctamente
5. **Ejecuta VACUUM** después de restaurar para optimizar la base de datos

## 🔗 Referencias

- [Guía completa de restauración](./RESTAURAR-BACKUP.md)
- [Documentación oficial de Supabase sobre backups](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
