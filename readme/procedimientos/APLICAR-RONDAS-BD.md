# Implementación: Rondas en Base de Datos

## Problema resuelto

Antes las rondas se calculaban dinámicamente cada vez que se renderizaba la vista, causando inconsistencias cuando había partidos en diferentes estados (pendiente, esperando confirmación, etc.).

**Ejemplo del problema:**
- Partido R1 "Ger - Pau vs Max - Nati" esperando confirmación aparecía al final de la lista
- No respetaba el orden lógico de rondas

**Solución:**
- Guardar el número de ronda en la base de datos
- Calcular rondas UNA VEZ usando Circle Method
- Ordenar siempre por ronda, independiente del estado

---

## Pasos para aplicar

### 1. Aplicar migración de base de datos

**Opción A: Con Supabase CLI**

```bash
cd c:\torneo-padel
supabase db push
```

**Opción B: Manualmente en Dashboard**

1. Abrí [Supabase Dashboard](https://supabase.com/dashboard)
2. SQL Editor
3. Copiá y pegá el contenido de: `supabase/migrations/20260120000000_add_ronda_to_partidos.sql`
4. Click "Run"

---

### 2. Calcular y asignar rondas a partidos existentes

1. Abrí en el navegador: `http://localhost:5173/calcular-rondas.html`
2. Click en **"Calcular y Asignar Rondas"**
3. Esperá a que termine el proceso
4. Verificá que todos los partidos fueron actualizados

**Qué hace este script:**
- Obtiene todos los grupos y partidos del torneo
- Para cada grupo:
  - Extrae las parejas únicas
  - Calcula el esquema de rondas con Circle Method
  - Asigna el número de ronda a cada partido en la BD

**Resultado esperado:**
```
🎉 ¡Proceso completado!
📊 Total de partidos actualizados: X
```

---

### 3. Verificar que funcionó

#### En la vista de todos los grupos:

1. Abrí `http://localhost:5173/`
2. Login como cualquier pareja
3. Click en "Ver todos los grupos"
4. Desplegá "Ver partidos del grupo"
5. ✅ **Verificá que:**
   - Partidos están ordenados por ronda (R1, R2, R3...)
   - Partidos con "Esperando confirmación" aparecen en su ronda correcta
   - Partidos en revisión también están en orden de ronda

#### En la vista personalizada:

1. En tu vista personalizada
2. Mirá la sección "Por jugar"
3. ✅ **Verificá que:**
   - Rondas están en orden (Ronda 1, Ronda 2, etc.)
   - Fechas libres aparecen en la ronda correcta

---

### 4. Deploy a producción

Una vez que verificaste localmente:

1. Aplicar migración en producción:
   ```bash
   supabase db push --linked
   ```

2. Subir el archivo `calcular-rondas.html` a tu hosting

3. Acceder a `https://tu-sitio.com/calcular-rondas.html` y ejecutar

4. Hacer deploy del código actualizado (`src/viewer.js`, `src/viewer/vistaPersonal.js`)

---

## Archivos modificados

### Base de datos

- **`supabase/migrations/20260120000000_add_ronda_to_partidos.sql`** (NUEVO)
  - Agrega columna `ronda INTEGER` a tabla `partidos`
  - Crea índice para performance

### Scripts

- **`calcular-rondas.html`** (NUEVO)
  - Script standalone para calcular y asignar rondas
  - Con UI bonita y logs detallados
  - Se ejecuta una sola vez (o cuando agregás nuevos partidos)

### Código

- **`src/viewer.js`**
  - `fetchAll()`: Ahora obtiene campo `ronda`
  - `renderPartidosConRondas()`: Usa `ronda` de BD en lugar de calcularla
  - Ordena por ronda, luego por estado

- **`src/viewer/vistaPersonal.js`**
  - Fetch incluye campo `ronda`
  - `agruparPartidosEnRondas()`: Simplificada, usa ronda de BD
  - Fechas libres se calculan solo para detectar cuándo mostrarlas

---

## Beneficios

✅ **Consistencia**: Ronda siempre es la misma, sin importar el estado  
✅ **Performance**: No recalcular Circle Method cada renderizado  
✅ **Simplicidad**: Ordenar por un número es trivial  
✅ **Mantenibilidad**: Si cambia el algoritmo, se ejecuta una vez  
✅ **Flexibilidad**: Podés ajustar rondas manualmente si es necesario  

---

## Crear partidos nuevos (futuro)

Cuando creés partidos de un nuevo torneo o grupo:

1. Calcular parejas del grupo
2. Aplicar Circle Method para generar pairings
3. Al crear cada partido, asignar su ronda:

```javascript
// Pseudo-código
const pairings = circleMethod(parejas);

pairings.forEach((rondaPairings, rondaIdx) => {
  rondaPairings.forEach(([pareja1, pareja2]) => {
    await supabase.from('partidos').insert({
      pareja_a_id: pareja1.id,
      pareja_b_id: pareja2.id,
      ronda: rondaIdx + 1, // ← Asignar ronda aquí
      // ... otros campos
    });
  });
});
```

O simplemente ejecutar `calcular-rondas.html` después de crear los partidos.

---

## Troubleshooting

### "No se actualizaron todos los partidos"

- Verificá que todos los partidos tienen `grupo_id`
- Verificá que las parejas tienen nombres únicos

### "Aparece R? en lugar de R1, R2..."

- La ronda es NULL en la BD
- Ejecutá `calcular-rondas.html` nuevamente

### "Fechas libres no aparecen"

- Las fechas libres se calculan dinámicamente con Circle Method
- Son correctas aunque no estén en la BD

---

## ¿Preguntas?

Si algo no funciona, verificá:
1. ✅ Migración aplicada correctamente
2. ✅ Script de cálculo ejecutado sin errores
3. ✅ Código actualizado y desplegado
4. ✅ Cache del navegador limpio (Ctrl+Shift+R)
