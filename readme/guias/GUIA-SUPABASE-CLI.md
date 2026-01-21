# Guía: Configurar Supabase CLI y Aplicar Migración

## Paso 1: Verificar instalación del CLI

Abrí PowerShell o terminal y ejecutá:

```bash
supabase --version
```

✅ Debería mostrar algo como: `supabase 1.x.x`

---

## Paso 2: Login en Supabase

```bash
supabase login
```

Esto va a:
1. Abrir tu navegador
2. Pedirte que inicies sesión en Supabase
3. Generar un access token
4. Guardarlo automáticamente

✅ Cuando termine, deberías ver: "Finished supabase login."

---

## Paso 3: Vincular tu proyecto local con el remoto

### 3a. Obtener el ID de tu proyecto

1. Abrí [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleccioná tu proyecto (torneo-padel)
3. Andá a "Settings" (⚙️) → "General"
4. Copiá el **Reference ID** (algo como: `abcdefghijklmnopqrst`)

### 3b. Vincular el proyecto

En tu terminal, desde la carpeta del proyecto (`c:\torneo-padel`):

```bash
supabase link --project-ref TU_REFERENCE_ID
```

Reemplazá `TU_REFERENCE_ID` con el ID que copiaste.

✅ Si te pide la contraseña de la base de datos, la podés encontrar en:
- Dashboard → Settings → Database → Database password
- (O usá la que configuraste cuando creaste el proyecto)

El comando va a mostrar algo como:
```
Finished supabase link.
```

---

## Paso 4: Verificar la conexión

```bash
supabase db remote get
```

Esto debería mostrarte información de tu base de datos remota.

---

## Paso 5: Aplicar la migración

Ahora sí, aplicar la migración nueva:

```bash
supabase db push
```

Esto va a:
1. Revisar qué migraciones locales no están en producción
2. Mostrar un resumen
3. Aplicarlas a tu base de datos remota

✅ Deberías ver:
```
Applying migration 20260119140000_add_estado_partidos.sql...
Finished supabase db push.
```

---

## Paso 6: Verificar que se aplicó correctamente

### Opción A: Desde el Dashboard

1. Abrí Supabase Dashboard
2. Table Editor → partidos
3. Verificá que ahora tengas las columnas nuevas:
   - `estado`
   - `cargado_por_pareja_id`
   - `resultado_temp_a`
   - `resultado_temp_b`
   - `notas_revision`

### Opción B: Desde la consola (cuando pruebes localmente)

```javascript
// En consola del navegador (localhost)
const { supabase } = await import('./src/carga/context.js');
const { data } = await supabase.from('partidos').select('estado').limit(1);
console.log('Campo estado existe:', data[0].hasOwnProperty('estado'));
```

Debería mostrar: `true`

---

## Troubleshooting

### Error: "supabase: command not found"

El CLI no está en tu PATH. Opciones:
- Reinstalá: `npm install -g supabase`
- O usá npx: `npx supabase login`

### Error: "Project ref is invalid"

Verificá que copiaste bien el Reference ID del Dashboard.

### Error: "Failed to connect to database"

Verificá la contraseña de la base de datos. La podés resetear en:
Dashboard → Settings → Database → Reset database password

### Error: "Migration already applied"

Ya está aplicada, no pasa nada. Podés verificar con:

```bash
supabase migration list
```

---

## Resumen de Comandos

```bash
# 1. Login
supabase login

# 2. Vincular proyecto
supabase link --project-ref TU_REFERENCE_ID

# 3. Ver estado de migraciones
supabase migration list

# 4. Aplicar migraciones
supabase db push

# 5. Ver info de la DB remota
supabase db remote get
```

---

## ¿Qué hacer después?

Una vez que la migración esté aplicada, continuá con el **Paso 2** de `PASOS-PARA-APLICAR.md`:

1. Probá localmente: `npm run dev`
2. Verificá que todo funciona
3. Hacé deploy del código

---

## Alternativa: Sin CLI (Opción B del archivo PASOS-PARA-APLICAR.md)

Si tenés problemas con el CLI, podés aplicar la migración manualmente:

1. Abrí [Supabase Dashboard](https://supabase.com/dashboard)
2. SQL Editor
3. Abrí el archivo: `supabase/migrations/20260119140000_add_estado_partidos.sql`
4. Copiá TODO el contenido
5. Pegalo en el SQL Editor
6. Click "Run"
7. Verificá que no haya errores

Esta opción es más simple pero menos recomendada para proyectos grandes.
