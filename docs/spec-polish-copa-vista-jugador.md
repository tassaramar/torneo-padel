# Spec: Polish visual de copa en vista del jugador

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 1 — Polish
**Ítems del backlog**: "Partidos de copa sin distinción visual" + "Colores en tablas/copas — verde para ganar, otro para perder"

---

## Contexto

El sistema de copas funciona, pero la vista del jugador carece de dos mejoras visuales que hacen la diferencia en la experiencia:

1. Las cards de partidos de copa no muestran el **nombre completo de la copa** — solo se muestra la ronda ("Semi") sin contexto de en qué copa es.
2. En el **modal de consulta**, todas las apariciones del jugador se resaltan en verde, tanto victorias como derrotas, haciendo imposible distinguir a simple vista cuándo ganó y cuándo perdió.

Ambos son cambios visuales de bajo riesgo que mejoran significativamente la legibilidad.

---

## Ítem 1 — Nombre de copa en cards de partidos (index.html)

### Estado actual

`src/viewer/vistaPersonal.js` carga los partidos de copa con `copa_id` y `ronda_copa` (línea ~168-169), y los renderiza con un badge de ronda usando `labelRonda()` (importada de `src/utils/copaRondas.js`):

```javascript
// línea ~1420
const rondalabel = labelRonda(p.ronda_copa, true) || 'Copa';
// línea ~1426
<div class="partido-badge badge-copa">${escapeHtml(rondalabel)}</div>
```

El badge muestra "Semi", "Final", etc., pero **no muestra el nombre de la copa** ("Copa Oro", "Copa Plata").

### Fix

**Paso 1 — Agregar join en la query SELECT**

En la query de `vistaPersonal.js` que carga los partidos (línea ~168), agregar:

```javascript
// Antes: copa_id, ronda_copa
// Después:
copa_id, ronda_copa, copa:copas ( id, nombre )
```

Supabase devuelve el objeto `copa: { id: '...', nombre: 'Copa Oro' }` embebido en cada partido.

**Paso 2 — Actualizar el badge en las cards de copa pendientes**

En el template de la card de partido de copa (~línea 1426), cambiar el badge de:

```html
${escapeHtml(rondalabel)}
```

A:

```html
${escapeHtml(p.copa?.nombre ? `${p.copa.nombre} — ${rondalabel}` : rondalabel)}
```

Resultado visible: **"Copa Oro — Semi"**, **"Copa Plata — Final"**, etc. (el icono 🏆 ya está en la clase CSS `badge-copa`).

**Paso 3 — Actualizar el badge en partidos confirmados (historial)**

En la función que renderiza partidos confirmados (~línea 1463-1469), hay un badge similar:

```javascript
const copaLabel = p.copa_id ? (labelRonda(p.ronda_copa, true) || 'Copa') : null;
// ...
<span class="badge-mini badge-copa">🏆 ${escapeHtml(copaLabel)}</span>
```

Cambiar a:

```javascript
const copaLabel = p.copa_id
  ? (p.copa?.nombre ? `${p.copa.nombre} — ${labelRonda(p.ronda_copa, true) || 'Copa'}` : labelRonda(p.ronda_copa, true) || 'Copa')
  : null;
```

### Archivos a modificar

- `src/viewer/vistaPersonal.js` — query SELECT (~168), template badge copa pendientes (~1426), template badge copa confirmados (~1463-1469)

---

## Ítem 2 — Colores victoria/derrota en el modal de consulta

### Pregunta de usuario que resuelve

> "¿Cómo me fue en el torneo?" — El jugador abre el modal y ve sus partidos pasados, pero no puede distinguir de un vistazo cuáles ganó y cuáles perdió: todo está en verde.

### Estado actual

En `src/viewer/modalConsulta.js`:

- **Función `renderPartidosGrupo`** (~línea 640): renderiza partidos en tabs "Mi grupo" / "Otros grupos". La fila del jugador se resalta con clase `es-mio` (verde neutro), sin distinguir victoria/derrota.
- **Tab Copas** (~línea 517): mismo problema, usa clase `es-mio` sin distinción.

CSS actual:
```css
.modal-partido.es-mio {
  background: var(--primary-soft);  /* Verde neutro siempre */
}
```

### Función existente — NO crear una nueva

Ya existe `determinarGanadorParaPareja(partido, parejaId)` en `src/utils/formatoResultado.js` (línea ~61-85):
- Retorna `'yo'` si la pareja ganó, `'rival'` si perdió, `null` si no hay resultado
- Ya usa los campos correctos `set1_a`, `set1_b`, `sets_a`, `sets_b`
- **Ya se usa en `vistaPersonal.js`** — importarla también en `modalConsulta.js`

### Fix

**En `renderPartidosGrupo` y en el tab Copas**, donde hoy se hace:

```javascript
const esMiPartido = identidad &&
  (p.pareja_a?.id === identidad.parejaId || p.pareja_b?.id === identidad.parejaId);

// template:
<div class="modal-partido ${jugado ? 'jugado' : 'pendiente'} ${esMiPartido ? 'es-mio' : ''}">
```

Cambiar a:

```javascript
const esMiPartido = identidad &&
  (p.pareja_a?.id === identidad.parejaId || p.pareja_b?.id === identidad.parejaId);

let claseResultado = '';
if (esMiPartido && jugado) {
  const resultado = determinarGanadorParaPareja(p, identidad.parejaId);
  claseResultado = resultado === 'yo' ? 'mi-victoria' : resultado === 'rival' ? 'mi-derrota' : '';
}

// template:
<div class="modal-partido ${jugado ? 'jugado' : 'pendiente'} ${esMiPartido ? 'es-mio' : ''} ${claseResultado}">
```

**CSS a agregar en `src/style.css`**:

```css
/* Victoria/derrota en modal de consulta */
.modal-partido.es-mio.mi-victoria {
  background: rgba(22, 163, 74, 0.12);  /* Verde suave */
  border-left: 3px solid #16A34A;
}

.modal-partido.es-mio.mi-derrota {
  background: rgba(239, 68, 68, 0.08);  /* Rojo muy suave */
  border-left: 3px solid #EF4444;
}
```

**Scope de la distinción**:
- ✅ Aplica a: partidos jugados en `renderPartidosGrupo` (tabs "Mi grupo" / "Otros grupos")
- ✅ Aplica a: partidos de copa en el tab "Copas"
- ❌ NO aplica a: la fila de posición en la tabla de posiciones (mantiene verde neutro de "mi pareja")
- ❌ NO aplica a: partidos pendientes (sin resultado → mantiene `es-mio` verde neutro)

### Archivos a modificar

- `src/viewer/modalConsulta.js` — importar `determinarGanadorParaPareja` de `src/utils/formatoResultado.js`, aplicar en `renderPartidosGrupo` y en el bloque del tab Copas
- `src/style.css` — agregar clases `.mi-victoria` y `.mi-derrota`

---

## Nomenclatura de campos (referencia rápida)

La BD y el código usan estos nombres. **No inventar otros**:

| Campo | Significado |
|-------|-------------|
| `pareja_a_id` / `pareja_b_id` | IDs de las parejas |
| `set1_a` / `set1_b` | Games del set 1 (pareja A / pareja B) |
| `set2_a` / `set2_b` | Games del set 2 |
| `sets_a` / `sets_b` | Sets ganados (calculados por trigger) |
| `copa_id` | FK a tabla `copas` (NULL = partido de grupo) |
| `ronda_copa` | `'SF'`, `'F'`, `'3P'`, `'direct'`, `'QF'` |

---

## Criterios de aceptación

**Ítem 1 — Nombre de copa en cards**:
- [ ] Cards de partidos de copa pendientes muestran "Copa Oro — Semi" (no solo "Semi")
- [ ] Cards de partidos de copa confirmados (historial) también muestran el nombre
- [ ] El nombre viene de `copas.nombre` en BD vía join, no hardcodeado
- [ ] Si `copa.nombre` es null por alguna razón, fallback a solo mostrar la ronda

**Ítem 2 — Colores victoria/derrota en modal**:
- [ ] En el modal, partidos ganados por mi pareja → fondo verde suave + borde verde
- [ ] Partidos perdidos por mi pareja → fondo rojo suave + borde rojo
- [ ] Partidos pendientes (sin resultado) → mantienen verde neutro (`es-mio`)
- [ ] La fila de posición en la tabla de posiciones NO cambia de color
- [ ] Funciona en tab "Mi grupo", "Otros grupos" Y tab "Copas"
- [ ] Usa la función existente `determinarGanadorParaPareja` de `src/utils/formatoResultado.js` (NO crear función nueva)

**General**:
- [ ] `npm run build` sin errores nuevos
- [ ] No duplicar código — reutilizar funciones y clases existentes
