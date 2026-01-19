# Testing: Formatos Variables de Torneo

## Cambios Implementados

### ✅ Validaciones Flexibles
- `calcularTablaGrupoDB()`: Ahora acepta grupos con 2+ parejas (antes solo 3)
- `analizarEstadoCopa()`: Valida dinámicamente el número de parejas
- Todas las funciones de copas: Detectan formato y muestran mensajes informativos

### ✅ Detección Automática de Formato
Nueva función `detectarFormatoTorneo()` que analiza:
- Número de grupos
- Número de parejas totales
- Parejas por grupo
- Si es formato estándar (4x3) o no

### ✅ Guards en Funciones de Copas
Las siguientes funciones ahora detectan formato no estándar y muestran mensajes claros:
- `sugerirAsignacionesAutomaticas()`
- `aplicarAsignacionesAutomaticas()`
- `generarCopasYSemis()`

## Testing Manual - Formato 2x5

### Paso 1: Preparar Datos de Prueba

Usá el archivo `test-2x5-parejas.txt` en la raíz del proyecto. Contiene:
- 10 parejas
- 2 grupos (A y B)
- 5 parejas por grupo
- Formato: `Nombre TAB Grupo`

### Paso 2: Importar Parejas

1. Abrí `http://localhost:5173/admin.html`
2. Andá a la sección **"Importar parejas"**
3. Copiá el contenido de `test-2x5-parejas.txt`
4. Pegalo en el textarea
5. Click en **"Vista Previa"**
6. Verificá que muestre:
   - ✅ 10 parejas
   - ✅ 2 grupos (A, B)
7. Click en **"Importar"**
8. Confirmá la acción (borra datos existentes)

**Resultado esperado:**
```
✅ Import terminado.
Estado actual en DB: 10 parejas · 2 grupos
```

### Paso 3: Generar Partidos de Grupos

1. En la sección **"Partidos de Grupos"**
2. Click en **"Generar Partidos Grupos"**

**Resultado esperado en consola:**
```
Generando partidos para grupo A: ['Pareja 1 - Pareja 2', 'Pareja 3 - Pareja 4', ...]
Generando partidos para grupo B: ['Pareja 11 - Pareja 12', 'Pareja 13 - Pareja 14', ...]
✅ 20 partidos de grupos creados
```

**Cálculo:**
- Grupo A: 5 parejas → C(5,2) = 10 partidos
- Grupo B: 5 parejas → C(5,2) = 10 partidos
- **Total: 20 partidos**

### Paso 4: Verificar Estructura en Supabase (Opcional)

Ejecutá en SQL Editor:

```sql
-- Ver grupos
SELECT * FROM grupos WHERE torneo_id = 'tu-torneo-id';

-- Ver parejas
SELECT COUNT(*) as total, 
       COUNT(*) FILTER (WHERE orden <= 5) as grupo_a,
       COUNT(*) FILTER (WHERE orden > 5) as grupo_b
FROM parejas WHERE torneo_id = 'tu-torneo-id';

-- Ver partidos
SELECT g.nombre as grupo, COUNT(*) as partidos
FROM partidos p
JOIN grupos g ON p.grupo_id = g.id
WHERE p.torneo_id = 'tu-torneo-id' AND p.copa_id IS NULL
GROUP BY g.nombre;
```

### Paso 5: Cargar Resultados en /carga

1. Abrí `http://localhost:5173/carga.html`
2. Deberías ver las 2 tabs: **Grupo A** y **Grupo B**
3. En cada tab, deberías ver 10 partidos pendientes

**Cargar algunos resultados de prueba:**
- Grupo A, Partido 1: 6 - 4
- Grupo A, Partido 2: 6 - 2
- Grupo B, Partido 1: 6 - 3
- Grupo B, Partido 2: 6 - 1

4. Click en **"Ver Posiciones"**

**Resultado esperado:**
- Tabla de posiciones para Grupo A (5 parejas)
- Tabla de posiciones para Grupo B (5 parejas)
- Estadísticas correctas (PJ, PG, PP, GF, GC, DG, P)

### Paso 6: Verificar Guards de Copas

1. Volvé a `http://localhost:5173/admin.html`
2. Sección **"Copas"**
3. Click en **"🤖 Asignar Grupos Terminados"**

**Resultado esperado en consola:**
```
🤖 Analizando estado del torneo...
ℹ️ Formato detectado: 2 grupos × 5 parejas
ℹ️ Las copas automáticas solo funcionan con formato 4 grupos × 3 parejas
💡 Para este formato, usá solo la fase de grupos.
💡 Los cruces directos se pueden agregar manualmente como partidos de copa desde Supabase.
```

4. Click en **"🏆 Generar TODO (Copas + Semis)"**

**Resultado esperado:**
```
🏆 Generar Copas + Semis: validando…
ℹ️ Formato detectado: 2 grupos × 5 parejas
ℹ️ La generación automática de copas solo funciona con formato 4 grupos × 3 parejas
💡 Para este formato, usá solo la fase de grupos.
```

### Paso 7: Testing Completo de Fase de Grupos

**Cargar TODOS los partidos:**
1. Completá los 20 partidos de grupos con resultados aleatorios
2. Verificá que las tablas de posiciones se actualicen correctamente
3. Verificá que cada grupo muestre correctamente las 5 parejas ordenadas

**Criterios de éxito:**
- ✅ 20 partidos generados correctamente
- ✅ Resultados se cargan sin errores
- ✅ Tablas de posiciones se calculan correctamente
- ✅ Orden automático funciona (basado en P, DG, GF)
- ✅ Funciones de copas no causan errores, solo muestran mensajes informativos

## Testing - Volver a Formato 4x3

Para verificar que el formato original sigue funcionando:

1. Importá 12 parejas en 4 grupos (A, B, C, D)
2. Generá partidos de grupos (debe crear 18 partidos)
3. Completá todos los partidos
4. Las funciones de copas deben funcionar normalmente

## Verificación Final

- [ ] Formato 2x5: Fase de grupos funciona perfectamente
- [ ] Formato 2x5: Copas muestran mensajes informativos (no causan errores)
- [ ] Formato 4x3: Todo sigue funcionando como antes
- [ ] No hay errores en consola del navegador
- [ ] No hay errores de linter en el código

## Próximos Pasos

Para el torneo del miércoles:
1. Importá las 10 parejas reales
2. Generá partidos de grupos
3. Usá `/carga` para ir cargando resultados a medida que juegan
4. Las tablas de posiciones se actualizarán en tiempo real

Para los cruces directos (1° vs 1°, etc.):
- Se pueden agregar manualmente después del miércoles
- O se puede implementar una funcionalidad específica post-miércoles
