# Copas Flexibles - Guía de Implementación

## 🎯 Objetivo

Permitir generar copas de forma flexible durante el torneo, sin esperar a que todos los grupos terminen.

## 📋 Estado de Implementación

✅ **Código JavaScript implementado**
✅ **Migración de base de datos creada**
⏳ **Pendiente: Aplicar migración a Supabase**

---

## 🔧 Paso 1: Aplicar la Migración

La migración agrega el campo `copa_asignada_id` a la tabla `parejas`.

### Opción A: Desde el Dashboard de Supabase

1. Abrí https://supabase.com y entrá a tu proyecto
2. Andá a **SQL Editor**
3. Copiá y pegá el contenido del archivo:
   ```
   supabase/migrations/20260119130203_add_copa_asignada_to_parejas.sql
   ```
4. Ejecutá el SQL
5. Verificá que no haya errores

### Opción B: Con Supabase CLI (si lo tenés instalado)

```bash
supabase db push
```

### Verificación

Para verificar que la migración se aplicó correctamente, ejecutá en el SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'parejas'
AND column_name = 'copa_asignada_id';
```

Deberías ver:
- `column_name`: copa_asignada_id
- `data_type`: uuid
- `is_nullable`: YES

---

## 🎮 Paso 2: Usar la Nueva Funcionalidad

### Flujo Típico Durante el Torneo

#### 1. **Crear las Copas Vacías**

Primero creá las 3 copas (Oro, Plata, Bronce) sin equipos:

- En `/admin`, sección **Copas**
- Click en **"🤖 Asignar Equipos Auto"** SI los grupos ya terminaron
- O esperá y asigná manualmente conforme avancen

#### 2. **Asignar Equipos Manualmente**

Cuando un equipo ya tenga su posición definitiva:

- En la card de cada copa, verás **"Equipos asignados: 0/4"**
- Click en **"+ Asignar Equipo"**
- Seleccioná el equipo del dropdown
- Click en **"Asignar"**

#### 3. **Generar Semis**

Cuando tengas 2+ equipos asignados:

- Aparece el botón **"⚡ Generar Semis"**
- Click para crear los partidos de semifinales
- Con 2 equipos: crea 1 semi
- Con 3 equipos: crea 1 semi (seed 2 vs seed 3)
- Con 4 equipos: crea 2 semis (sistema de bombos)

#### 4. **Quitar Equipos (si te equivocaste)**

- En la lista de equipos asignados, click en **"✕ Quitar"**
- El equipo vuelve a estar disponible

---

## 🤖 Asignación Automática

Si **todos los grupos terminaron** y querés el flujo tradicional:

1. Click en **"🤖 Asignar Equipos Auto"**
   - Calcula automáticamente 1°, 2°, 3° de cada grupo
   - Asigna: 1° → Oro, 2° → Plata, 3° → Bronce

2. Luego generá las semis manualmente o con **"🏆 Generar TODO"**

---

## 🆚 Comparación: Nuevo vs Antiguo

### Flujo Antiguo

1. Esperar a que **TODOS** los grupos terminen
2. Click en **"🏆 Generar Copas + Semis"**
3. Todo se genera de una vez

❌ **Problema:** No podías jugar copas hasta que todo termine

### Flujo Nuevo

1. Asignar equipos **conforme avanzan** los grupos
2. Generar semis **cuando tengas 2+ equipos**
3. Jugar mientras otros grupos siguen

✅ **Ventaja:** Flexibilidad total, el torneo no se frena

---

## 🎯 Casos de Uso Reales

### Caso 1: "Dos grupos atrasados"

- Grupos A y B terminaron rápido
- Grupos C y D están atrasados
- **Solución:**
  1. Asigná los equipos de A y B a sus copas
  2. Si tenés 2 en Bronce → generá su semi y que jueguen
  3. Cuando C y D terminen, asignás los que faltan

### Caso 2: "Un equipo perdió todo"

- Equipo X perdió sus 2 partidos de grupo
- Ya sabés que va a Bronce
- **Solución:**
  1. Asignalo manualmente a Bronce
  2. Esperá otro equipo para generar la semi

### Caso 3: "Flujo tradicional"

- Todos los grupos terminaron "normalmente"
- **Solución:**
  1. Click en **"🤖 Asignar Equipos Auto"**
  2. Click en **"⚡ Generar Semis"** en cada copa
  3. O usá **"🏆 Generar TODO"** como antes

---

## 🔄 Compatibilidad con el Sistema Anterior

El botón **"🏆 Generar TODO (Copas + Semis)"** sigue funcionando:

- Crea las 3 copas
- Calcula automáticamente el orden de los grupos
- Asigna los 12 equipos
- Genera las 6 semis (2 por copa)

Es el flujo rápido si todos los grupos terminaron.

---

## 🐛 Troubleshooting

### "No puedo asignar un equipo"

- Verificá que la migración se haya aplicado
- Verificá que el equipo no esté ya asignado a otra copa

### "El botón Generar Semis no aparece"

- Necesitás al menos 2 equipos asignados

### "Error al generar semis"

- Verificá que no hayan semis ya creadas para esa copa
- Si hay, borrá los partidos primero con **"Reset Copas"**

---

## 📊 Datos Técnicos

### Nuevo Campo en DB

```sql
ALTER TABLE parejas 
ADD COLUMN copa_asignada_id uuid REFERENCES copas(id);
```

### Nuevas Funciones JS

- `asignarParejaACopa(parejaId, copaId)`
- `quitarParejaDecopa(parejaId)`
- `obtenerEquiposAsignados(copaId)`
- `sugerirAsignacionesAutomaticas()`
- `aplicarAsignacionesAutomaticas()`
- `generarSemisConAsignados(copaId, copaNombre)`

---

## ✅ Testing Sugerido

Antes del próximo torneo, probá estos escenarios:

1. ✅ Asignar un equipo manualmente
2. ✅ Generar semi con 2 equipos
3. ✅ Quitar un equipo y reasignarlo
4. ✅ Usar asignación automática
5. ✅ Generar TODO (flujo tradicional)
6. ✅ Reset y volver a empezar

---

## 🚀 Próximos Pasos (Opcionales)

Posibles mejoras futuras:

- 💡 Notificaciones visuales cuando un grupo termina
- 💡 Drag & drop para reasignar equipos entre copas
- 💡 Vista de "grupos terminados" vs "en progreso"
- 💡 Confirmación antes de generar semis con 3 equipos

---

¿Preguntas? Revisá el código en `src/admin/copas/index.js`
