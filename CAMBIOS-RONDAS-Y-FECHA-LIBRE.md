# Cambios: Rondas y Fecha Libre

## Resumen de mejoras

### Problema anterior
- Los partidos "Por jugar" se mostraban como lista plana
- No se veía el orden/paralelismo de las rondas
- No se indicaba cuándo la pareja tenía fecha libre

### Solución implementada ✅

**1. Agrupamiento por rondas**
- Los partidos se agrupan en rondas según paralelismo
- Una ronda = partidos que pueden jugarse al mismo tiempo
- Separadores visuales entre rondas (solo si hay más de una)

**2. Detección de fecha libre**
- Se detecta automáticamente cuando la pareja no juega en una ronda
- Mensaje claro: "Tenés fecha libre en esta ronda"
- Frase divertida/motivadora random

**3. Orden lógico**
- Partidos ordenados por ronda
- Más fácil de entender qué se juega primero

---

## Cómo funciona

### Algoritmo de agrupamiento

**Usa Circle Method (Berger Tables):**
1. Obtener TODOS los partidos del grupo (no solo los míos)
2. Aplicar Circle Method para generar el esquema completo de rondas
3. Identificar en qué ronda está cada uno de mis partidos pendientes
4. Mostrar TODAS las rondas hasta la última donde tengo partido pendiente

```
Ejemplo con 5 parejas (A, B, C, D, E):

Torneo completo:
  Ronda 1: A-B, C-D  → E libre
  Ronda 2: A-C, D-E  → B libre
  Ronda 3: A-D, B-E  → C libre
  Ronda 4: A-E, B-C  → D libre
  Ronda 5: B-D, C-E  → A libre

Si soy la pareja E y ya jugué vs A:
  Ronda 1: ☕ Fecha libre
  Ronda 2: vs D (pendiente)
  Ronda 3: vs B (pendiente)
  Ronda 4: vs A (ya jugado, no aparece)
  Ronda 5: vs C (pendiente)

Si soy la pareja D:
  Ronda 1: vs C (pendiente)
  Ronda 2: vs E (pendiente) ← MISMO NÚMERO que para pareja E
  Ronda 3: vs A (pendiente)
  Ronda 4: ☕ Fecha libre
  Ronda 5: vs B (pendiente)
```

**✅ Garantía de consistencia:**  
El partido D vs E aparece en **Ronda 2** para ambas parejas (D y E).

### Detección de fecha libre

Si mi pareja NO aparece en ningún partido de una ronda específica:
→ Mostrar "Tenés fecha libre"

**Importante:** Solo se muestran rondas hasta la última donde tengo un partido pendiente.
Rondas futuras sin partidos pendientes no se muestran.

---

## Ejemplo visual

### Vista "Por jugar" con rondas:

```
🟢 Por jugar (3)

┌─ Ronda 1 ─────────────────┐
│                            │
│ vs Carlos - Ana            │
│ 📝 Cargar resultado        │
│                            │
└────────────────────────────┘

┌─ Ronda 2 ─────────────────┐
│                            │
│ vs Luis - María            │
│ 📝 Cargar resultado        │
│                            │
│ ☕ Tenés fecha libre        │
│ "Aprovechá para estirar"   │
│                            │
└────────────────────────────┘

┌─ Ronda 3 ─────────────────┐
│                            │
│ vs Pedro - Sofía           │
│ 📝 Cargar resultado        │
│                            │
└────────────────────────────┘
```

---

## Archivos modificados

### 1. `src/viewer/vistaPersonal.js`

**Nueva función: `agruparPartidosEnRondas(misPartidos, todosPartidosGrupo, identidad)`**
- Usa Circle Method para generar el esquema COMPLETO de rondas del torneo
- Identifica en qué ronda está cada partido pendiente
- Detecta si mi pareja tiene fecha libre en cada ronda
- **CRÍTICO:** Guarda el número de ronda REAL (no el índice del array filtrado)
- Muestra todas las rondas hasta la última con partido pendiente
- Retorna: `[{ numeroRonda: number, partidos: [...], tengoFechaLibre: bool, tengoPartidoEnEstaRonda: bool }]`

**Consistencia entre parejas:**
- Todas las parejas usan el MISMO esquema de rondas (Circle Method)
- El número de ronda es ABSOLUTO, no relativo a cada pareja
- Si un partido está en "Ronda 3" para una pareja, está en "Ronda 3" para ambas parejas
- Las fechas libres respetan la numeración global

**Nuevas funciones auxiliares:**
- `circleMethod(equipos)`: Algoritmo de Berger para round-robin óptimo
- `crearMapaPartidos(partidos)`: Mapa bidireccional para búsqueda rápida

**Función modificada: `renderPartidosCargar(partidos, todosPartidosGrupo, identidad)`**
- Usa el nuevo agrupamiento por rondas
- Muestra separador de ronda (si hay más de una)
- Renderiza fecha libre cuando corresponde
- Usa frases divertidas únicas

**Función modificada: `renderVistaPersonal(..., todosPartidosGrupo, ...)`**
- Acepta y pasa `todosPartidosGrupo` a las funciones de renderizado

**Fetch adicional en `cargarVistaPersonalizada()`:**
- Obtiene TODOS los partidos del grupo (no solo los de la pareja)
- Necesario para calcular el esquema completo de rondas

**Nuevas importaciones:**
- `obtenerFrasesUnicas` de utils/frasesFechaLibre.js

### 2. `style.css`

**Nuevos estilos:**

```css
.ronda-separator {
  /* Separador visual entre rondas */
  background: celeste suave
  border-left: azul fuerte
}

.fecha-libre {
  /* Card de fecha libre */
  display: flex
  border: dashed
  opacity: 0.8
}

.fecha-libre-icon {
  /* Emoji grande (☕) */
}

.fecha-libre-text {
  /* Texto y frase */
}
```

---

## Casos de uso

### Caso 1: Sin fecha libre
```
Ronda 1:
  - vs Carlos - Ana
  
Ronda 2:
  - vs Luis - María
```
→ Solo muestra partidos

### Caso 2: Con fecha libre (ejemplo real)
```
Grupo con 5 parejas, soy "Yo - Mi compañero":

Ronda 1:
  ☕ Tenés fecha libre
  "Momento perfecto para hidratarte"
  
Ronda 2:
  - vs Carlos - Ana (pendiente)
  
Ronda 3:
  - vs Luis - María (pendiente)
  
(Ronda 4 ya jugada, no se muestra)

Ronda 5:
  - vs Pedro - Sofía (pendiente)
```
→ Muestra TODAS las rondas hasta la última con partido pendiente

### Caso 3: Una sola ronda
```
Por jugar (1)

vs Carlos - Ana
📝 Cargar resultado
```
→ NO muestra separador (innecesario)

### Caso 4: Múltiples rondas
```
Por jugar (4)

Ronda 1
  - vs A
  - vs B

Ronda 2
  - vs C
  - vs D
```
→ Muestra separadores para cada ronda

---

## Frases de fecha libre

Usa las mismas frases que `src/utils/frasesFechaLibre.js`:
- "Aprovechá para estirar"
- "Momento perfecto para hidratarte"
- "Andá a ver otros partidos"
- ... y más (únicas, no se repiten)

---

## Testing recomendado

### Test 1: Partidos en múltiples rondas
1. Crear grupo con 4 parejas
2. 3 partidos pendientes para una pareja
3. ✅ Ver separadores "Ronda 1, 2, 3"
4. ✅ Partidos agrupados correctamente

### Test 1b: Consistencia entre parejas ⭐
1. Login como Pareja A, ver que el partido vs Pareja B está en "Ronda X"
2. Logout, login como Pareja B
3. ✅ Verificar que el partido vs Pareja A está también en "Ronda X"
4. ✅ Los números de ronda deben coincidir entre ambas parejas

### Test 2: Fecha libre visible
1. Grupo con número impar de parejas (ej: 5)
2. En alguna ronda, no hay partido para ti
3. ✅ Ver card con ☕ "Tenés fecha libre"
4. ✅ Ver frase divertida

### Test 3: Una sola ronda
1. Solo 1 partido pendiente
2. ✅ NO ver separador de ronda
3. ✅ Solo ver el partido

### Test 4: Sin partidos
1. Todos los partidos jugados
2. ✅ Sección "Por jugar" no se muestra

### Test 5: Múltiples fechas libres
1. Torneo con muchas rondas
2. Varias fechas libres
3. ✅ Cada una con frase diferente
4. ✅ No se repiten las frases

---

## Impacto en UX

**Más claro:**
- Se entiende el orden de los partidos
- Se ve cuándo podés descansar
- Estructura visual más organizada

**Más útil:**
- Sabés cuándo tenés fecha libre
- Podés planificar mejor el día
- Frases divertidas hacen más ameno

**Más realista:**
- Refleja cómo se juega realmente
- Partidos en paralelo están juntos
- Fechas libres son explícitas

---

## Consideraciones técnicas

**Performance:**
- El algoritmo es O(n²) pero con n pequeño (máx 10-15 partidos)
- Se ejecuta solo al renderizar, no en tiempo real
- Muy eficiente para casos reales

**Edge cases manejados:**
- Una sola ronda → no muestra separador
- Sin fecha libre → no muestra card
- Sin partidos → no se renderiza nada
- Múltiples fechas libres → frases únicas

**Limitaciones:**
- Solo muestra rondas hasta la última con partido pendiente
- No muestra rondas futuras si no hay partidos pendientes
- Requiere fetch adicional de todos los partidos del grupo

---

## Próximos pasos

1. Probar con datos reales del torneo
2. Verificar que las rondas se agrupan bien
3. Ajustar frases si hace falta más variedad
4. Deploy a producción
