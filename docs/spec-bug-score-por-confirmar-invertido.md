# Spec: BUG — score invertido en index.html (sistema-wide)

**Estado**: 📋 PRIORIZADA
**Score owner**: pendiente (bug reportado en torneo real)
**Backlog**: "BUG index.html — score invertido cuando jugador es pareja_b"

---

## El problema

Cuando el jugador es `pareja_b` en un partido, los scores en el home se muestran en orden de BD — es decir, con el score del rival primero y el del jugador segundo.

**Ejemplo reportado**:
- El rival (Gaby Z - Uri) cargó que ganó 6 a 0
- En BD: `set1_a = 6` (Gaby Z, pareja_a), `set1_b = 0` (jugador, pareja_b)
- El jugador ve: **"Gaby Z - Uri cargó: 6-0 😤 Perdiste"**
- Debería ver: **"Gaby Z - Uri cargó: 0-6 😤 Perdiste"** (mi score primero)

El mensaje "Perdiste" es correcto — `getMensajeResultado` ya recibe `soyA` y calcula bien el ganador. Solo el **score textual** está invertido.

**Regla universal**: en todo el home del jugador, el score siempre se muestra `mi_score - rival_score`, independientemente de si el jugador es `pareja_a` o `pareja_b` en la BD.

---

## Alcance — todas las secciones afectadas

Tres funciones en `src/viewer/vistaPersonal.js` muestran scores con el bug:

### 1. `renderPartidosConfirmar` (línea ~1120) — "Por confirmar"

```javascript
// Línea ~1146 — bug:
<div class="resultado-score">${formatearResultado(p)}</div>
```

### 2. `renderPartidosRevision` (línea ~1041) — "En revisión"

```javascript
// Líneas ~1075 y ~1077 — bug en ambos scores:
const res1 = p.set1_a !== null ? formatearResultado(p) : ...
const res2 = p.set1_temp_a !== null ? formatearResultado(tempPartido) : ...
```

### 3. `renderPartidosConfirmados` (línea ~1453) — "Partidos jugados"

```javascript
// Línea ~1479 — bug:
<div class="resultado-score ${ganador === 'yo' ? 'ganador' : ...}">${formatearResultado(p)}</div>
```

En "Partidos jugados" el bug es más grave porque no hay label "Ganaste/Perdiste" — el score es la única info que tiene el jugador para saber qué pasó.

---

## La solución

### Utilidad compartida: `invertirScoresPartido`

El helper `orientarPartido` en `modalConsulta.js` ya resuelve este problema para el modal. La lógica de inversión de scores debe vivir en `src/utils/formatoResultado.js` como función exportable — **fuente única de verdad**.

**Nueva función en `src/utils/formatoResultado.js`**:

```javascript
/**
 * Devuelve una copia del partido con los campos de score invertidos (A↔B).
 * Útil para renderizar desde la perspectiva de pareja_b.
 * NO modifica el objeto original.
 */
export function invertirScoresPartido(partido) {
  return {
    ...partido,
    set1_a: partido.set1_b, set1_b: partido.set1_a,
    set2_a: partido.set2_b, set2_b: partido.set2_a,
    set3_a: partido.set3_b, set3_b: partido.set3_a,
    sets_a: partido.sets_b, sets_b: partido.sets_a,
    games_totales_a: partido.games_totales_b, games_totales_b: partido.games_totales_a,
  };
}
```

### Fix en `renderPartidosConfirmar`

`soyA` ya está calculado (línea ~1126):

```javascript
const partidoOrientado = soyA ? p : invertirScoresPartido(p);
// ...
<div class="resultado-score">${formatearResultado(partidoOrientado)}</div>
```

### Fix en `renderPartidosRevision`

`soyA` ya está calculado (línea ~1048). Aplicar en ambos scores:

```javascript
const res1 = p.set1_a !== null
  ? formatearResultado(soyA ? p : invertirScoresPartido(p))
  : `${gamesA1} - ${gamesB1}`;

const tempPartido = { ...p, set1_a: p.set1_temp_a, set1_b: p.set1_temp_b, ... };
const res2 = p.set1_temp_a !== null
  ? formatearResultado(soyA ? tempPartido : invertirScoresPartido(tempPartido))
  : `${gamesA2} - ${gamesB2}`;
```

### Fix en `renderPartidosConfirmados`

`getGanador(p, identidad)` ya calcula correctamente quién ganó. Solo falta orientar el score:

```javascript
const soyA = p.pareja_a?.id === identidad.parejaId;
const partidoOrientado = soyA ? p : invertirScoresPartido(p);
// ...
<div class="resultado-score ${ganador === 'yo' ? 'ganador' : ganador === 'rival' ? 'perdedor' : ''}">
  ${formatearResultado(partidoOrientado)}
</div>
```

### Colores en "Partidos jugados"

Verificar que las clases CSS `ganador` y `perdedor` usen los mismos colores que la tabla de posiciones en Grupos:
- Verde (`#16A34A`) = ganaste
- Rojo (`#DC2626`) = perdiste

Si las clases existen pero usan otros colores, alinearlas. Si no existen, crearlas.

### Actualizar `orientarPartido` en `modalConsulta.js`

Una vez que `invertirScoresPartido` existe en `formatoResultado.js`, `modalConsulta.js` puede importarla y simplificar su swap interno en vez de duplicar la lógica.

---

## Lo que NO cambia

- `getMensajeResultado(gamesA, gamesB, soyA)` — calcula el ganador correctamente, no tocar
- `calcularSetsGanados` — opera sobre datos originales de BD, correcto
- Los textos "Ganaste" / "Perdiste" en confirmar y revisión — ya son correctos
- La lógica de `esParejaCargadora` en revisión — no afectada

---

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/utils/formatoResultado.js` | Agregar y exportar `invertirScoresPartido(partido)` |
| `src/viewer/vistaPersonal.js` | Importar `invertirScoresPartido`. Aplicar en `renderPartidosConfirmar` (1 lugar), `renderPartidosRevision` (2 lugares) y `renderPartidosConfirmados` (1 lugar). Verificar colores en `renderPartidosConfirmados`. |
| `src/viewer/modalConsulta.js` | Importar `invertirScoresPartido` y simplificar el swap en `orientarPartido`. |

---

## Criterios de aceptación

- [ ] Jugador `pareja_b` — "Por confirmar": score muestra **su score primero** (ej: "0-6")
- [ ] Jugador `pareja_a` — "Por confirmar": score sin cambios (ya era correcto)
- [ ] "En revisión": ambos scores (original y temporal) orientados al jugador
- [ ] "Partidos jugados": score orientado al jugador, sin label "Ganaste/Perdiste" pero con color correcto
- [ ] "Partidos jugados": verde = ganaste, rojo = perdiste (alineado con colores de Tablas/Grupos)
- [ ] "Ganaste" / "Perdiste" sigue siendo correcto en todos los casos
- [ ] `invertirScoresPartido` no modifica el objeto original (retorna copia)
- [ ] `npm run build` sin errores nuevos
