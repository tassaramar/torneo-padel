# Spec: Polish visual de copa en vista del jugador

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 1 — Polish
**Ítems del backlog**: "Partidos de copa sin distinción visual" + "Colores en tablas/copas — verde para ganar, otro para perder"

---

## Contexto

El sistema de copas funciona, pero la vista del jugador carece de dos mejoras visuales que hacen la diferencia en la experiencia:

1. Las cards de partidos de copa no muestran el **nombre completo de la copa** — solo se muestra la ronda ("Semifinal") sin contexto de en qué copa es.
2. En el **modal de consulta**, todas las apariciones del jugador se resaltan en verde, tanto victorias como derrotas, haciendo imposible distinguir a simple vista cuándo ganó y cuándo perdió.

Ambos son cambios visuales de bajo riesgo que mejoran significativamente la legibilidad.

---

## Ítem 1 — Nombre de copa en cards de partidos (index.html)

### Estado actual

`src/viewer/vistaPersonal.js` carga los partidos de copa con `copa_id` y `ronda_copa` (línea ~167-168), y los renderiza en la sección "🏆 Copa" (línea ~1412) con un badge de ronda:

```javascript
const _RONDA_COPA_LABEL = { SF: 'Semi', F: 'Final', '3P': '3° Puesto', direct: 'Cruce' };
const rondalabel = _RONDA_COPA_LABEL[p.ronda_copa] || p.ronda_copa || 'Copa';
```

El badge muestra "🏆 Semi", "🏆 Final", etc., pero **no se carga ni muestra el nombre de la copa** ("Copa Oro", "Copa Plata").

### Fix

**Paso 1 — Agregar join en la query SELECT**

En la query de `vistaPersonal.js` que carga los partidos (línea ~167), agregar:

```javascript
// Antes: copa_id, ronda_copa
// Después:
copa_id, ronda_copa, copa:copas ( id, nombre )
```

Supabase devuelve el objeto `copa: { id: '...', nombre: 'Copa Oro' }` embebido en cada partido.

**Paso 2 — Actualizar el badge en las cards**

En el template de la card de partido de copa, cambiar el badge de:

```html
🏆 ${rondalabel}
```

A:

```html
🏆 ${p.copa?.nombre || 'Copa'} — ${rondalabel}
```

Resultado visible: **"🏆 Copa Oro — Semi"**, **"🏆 Copa Plata — Final"**, etc.

**Nota**: El mismo join aplica para los partidos de copa que aparecen en "Partidos confirmados" (historial). Revisar la función `renderPartidosConfirmados()` (línea ~1459) para asegurar consistencia.

### Archivos a modificar

- `src/viewer/vistaPersonal.js` — query SELECT (línea ~167), template del badge de copa (~1412 y ~1459)

---

## Ítem 2 — Colores victoria/derrota en el modal de consulta

### Pregunta de usuario que resuelve

> "¿Cómo me fue en el torneo?" — El jugador abre el modal y ve sus partidos pasados, pero no puede distinguir de un vistazo cuáles ganó y cuáles perdió: todo está en verde.

### Estado actual

En `src/viewer/modalConsulta.js`, los tabs "Mi grupo" y "Otros grupos" renderizan los partidos jugados del grupo. La fila de la pareja del jugador se resalta en **verde** siempre, sin distinción entre victorias y derrotas.

### Fix

**Lógica de victoria/derrota**

Dado que el modelo es de sets (set1_p1, set1_p2, set2_p1, set2_p2), determinar quién ganó:

```javascript
function determinarResultadoParaJugador(partido, parejaId) {
  const esPareja1 = partido.pareja1_id === parejaId;
  let setsP1 = 0, setsP2 = 0;
  if (partido.set1_p1 != null && partido.set1_p2 != null) {
    if (partido.set1_p1 > partido.set1_p2) setsP1++;
    else if (partido.set1_p2 > partido.set1_p1) setsP2++;
  }
  if (partido.set2_p1 != null && partido.set2_p2 != null) {
    if (partido.set2_p1 > partido.set2_p2) setsP1++;
    else if (partido.set2_p2 > partido.set2_p1) setsP2++;
  }
  const ganoP1 = setsP1 > setsP2;
  return (esPareja1 ? ganoP1 : !ganoP1) ? 'victoria' : 'derrota';
}
```

**Aplicación en el renderizado**

- `resultado === 'victoria'` → verde (`#16A34A`)
- `resultado === 'derrota'` → rojo/naranja (`#EF4444`)

**Scope de la distinción**:
- ✅ Aplica a: partidos jugados en tabs "Mi grupo" y "Otros grupos" del modal
- ✅ Aplica a: partidos de copa en el **nuevo tab "Copas"** (de Doc 1) — si la pareja del jugador participa, marcar sus resultados con victoria/derrota
- ❌ NO aplica a: la fila de posición en la tabla de posiciones (mantiene verde neutro de "mi pareja")

**Nota**: La función `determinarResultadoParaJugador` se necesita en el modal (grupos + copas) y potencialmente en Doc 7 (mensaje final). Considerar ubicarla en `src/utils/` para reutilizar.

### Archivos a modificar

- `src/viewer/modalConsulta.js` — función que renderiza partidos en "Mi grupo", "Otros grupos" y "Copas"
- `src/style.css` — clases `.resultado-victoria` y `.resultado-derrota` (si se necesitan en más de un lugar)

---

## Dependencia entre ítems

El Ítem 1 (nombre de copa en cards de `vistaPersonal.js`) es prerequisito del [Doc 7 (mensaje final)](spec-vista-jugador-mensaje-final.md), que también necesita cargar `copa:copas(nombre)`. Conviene implementar ambos en el mismo bloque para no hacer el join dos veces.

---

## Criterios de aceptación

- [ ] Cards de partidos de copa muestran "🏆 [Nombre Copa] — [Ronda]" en lugar de solo "🏆 [Ronda]"
- [ ] El nombre de copa es correcto (viene de `copas.nombre` en BD, no hardcodeado)
- [ ] Partidos confirmados del historial también muestran el nombre de copa
- [ ] En el modal, partidos ganados → resaltado verde; partidos perdidos → resaltado rojo/naranja
- [ ] La fila de posición en la tabla NO cambia de color (mantiene verde neutro)
- [ ] El cambio de color funciona tanto en tab "Mi grupo" como "Otros grupos"
- [ ] `npm run build` sin errores nuevos
