# Spec: Unificar general.html con el Modal de Consulta

## Objetivo

Reemplazar `general.html` (página standalone con tablas y copas) con el contenido del modal de consulta de `index.html` (`modalConsulta.js`). El modal desaparece de index.html y su contenido pasa a vivir en `general.html` como página propia.

**Motivación**: El modal ya es una versión superior de general.html (tiene tabla General, H2H, sorteo 🎲, brackets SVG, tab Fixture, highlighting del jugador). Unificarlos elimina código duplicado y resuelve el bug del botón Back del browser (el modal full-screen parecía una página nueva pero no lo era).

## Resultado esperado

- `general.html` renderiza el mismo contenido que hoy muestra el modal (tabs Grupos/Copas/Fixture)
- Si el usuario está identificado (localStorage): vista personalizada (mi grupo primero, mis partidos resaltados, scores orientados)
- Si NO está identificado: vista genérica (primer grupo, sin highlights, orden original)
- El modal desaparece de `index.html`
- El botón "Tablas / Grupos" en index.html navega a `general.html` en vez de abrir modal
- El botón Back del browser funciona nativamente (`general.html` → `index.html`)

## Arquitectura de cambios

### 1. Extraer funciones de render de `modalConsulta.js` → nuevo módulo compartido

Crear `src/viewer/renderConsulta.js` con las funciones de render puras (sin lógica de modal):

```
Extraer de modalConsulta.js:
├── renderGrupos(container, state)
├── renderSubTabGrupos(container, state)
├── renderGrupoDetalle(container, state, grupoId)
├── renderTablaGeneral(container, state)
├── renderCopas(container, state)
├── renderFixture(container, state)
├── renderPartidosGrupo(partidos, identidad, mapaPosiciones)
├── orientarPartido(partido, identidad)
├── escapeHtml(unsafe)
├── cargarDatosConsulta(supabase, torneoId) → retorna cache object
└── renderTabs(container, state, hayCopas)
```

**Patrón**: Todas las funciones reciben un objeto `state` en vez de leer de `modalState`. El state tiene:
```javascript
{
  activeTab: 'grupos',      // 'grupos' | 'copas' | 'fixture'
  activeSubTab: null,        // grupoId | 'general'
  cache: null,               // datos cargados
  identidad: null,           // de localStorage (puede ser null)
  supabase: ref,
  torneoId: string
}
```

### 2. Reescribir `src/general.js` (~80 líneas)

El nuevo `general.js` es un entry point delgado que:

1. Crea instancia de supabase
2. Lee identidad de localStorage (`torneo_identidad`). Si no hay → `identidad = null`
3. Crea el state object
4. Llama a `cargarDatosConsulta()` para el fetch inicial
5. Llama a las funciones de render para pintar la página
6. Inicia polling cada 30s (reutilizar el patrón de polling que ya tiene el general.js actual: pausar cuando tab no visible)
7. Si hay identidad → mostrar botón "Ver Mis Partidos" (navega a `index.html`)
8. Si no hay identidad → mostrar botón "Identificarme" (navega a `index.html`)

**Containers HTML**: Los render functions necesitan containers. Usar los IDs que ya tiene general.html:
- `#tabs-main` → tabs principales (Grupos/Copas/Fixture)
- `#viewer-content` → contenido del tab activo

**Nota sobre sub-tabs**: Las sub-tabs de grupos (Grupo A, Grupo B, ... General) se renderizan DENTRO de `#viewer-content` por la función `renderGrupos`, no necesitan container HTML propio.

### 3. Actualizar `general.html`

Cambios mínimos en el HTML:
- Actualizar título: "Torneo de Padel" (sin "Todos los Resultados")
- El `#viewer-nav-buttons` ya existe → usado para el botón de navegación
- El `#tabs-main` ya existe → usado para los tabs principales
- El `#viewer-content` ya existe → usado para el contenido
- Mantener el `#viewer-status` para estado de actualización

### 4. Simplificar `index.html`

Eliminar:
- Todo el bloque `<div id="modal-consulta" class="modal-fullscreen">...</div>` (líneas 25-39)

### 5. Simplificar `src/personal.js`

Cambios:
- **Eliminar** import de `initModal, abrirModal, cerrarModal, invalidarCache` de `modalConsulta.js`
- **Eliminar** el event listener `abrirModalConsulta` (línea 80-82)
- **Eliminar** las llamadas a `initModal()` (líneas 189, 203)
- **Eliminar** la llamada a `invalidarCache()` en el polling (línea 241)
- El polling de personal.js se simplifica: solo actualiza la vista personal, sin preocuparse por el modal

### 6. Actualizar `src/viewer/vistaPersonal.js`

Cambiar el botón de consulta (línea 674):
- **Antes**: `<button id="btn-abrir-modal">` que dispara evento `abrirModalConsulta`
- **Después**: `<a href="/general.html">` con el mismo estilo visual (clase `btn-consulta`)
- **Eliminar** el event listener del botón (línea 910-912) — ya no hace falta, es un link nativo

### 7. Eliminar `src/viewer/modalConsulta.js`

Una vez que `renderConsulta.js` tiene las funciones extraídas, `modalConsulta.js` se borra completamente. No queda ningún import a este archivo.

## CSS

### Mantener (en style.css)
- Todas las clases `.modal-section`, `.modal-meta`, `.modal-empty`, `.modal-details`, `.modal-partido`, `.modal-fixture-*`, `.modal-copa-*`, `.modal-sub-tab`, `.modal-tab` → siguen usándose en los renders
- `.tabla-grupo`, `.mi-pareja`, `.es-mio`, `.mi-victoria`, `.mi-derrota` → siguen usándose
- `.tabla-general-scroll` → sigue usándose

### Eliminar (de style.css)
- `.modal-fullscreen` (overlay container)
- `.modal-fullscreen-content` (content wrapper)
- `.modal-fullscreen-header` (header con título + botón cerrar)
- `.modal-fullscreen-title`
- `.modal-fullscreen-close`
- `.modal-fullscreen-body`

### Considerar renombrar (opcional, NO obligatorio)
Las clases `modal-*` ya no son de un "modal" sino de una página. Si se quiere, se pueden renombrar a `consulta-*`, pero NO es necesario para esta migración. Dejarlo como deuda cosmética.

## Manejo de identidad en general.html

```javascript
// En el nuevo general.js
function leerIdentidad() {
  try {
    const raw = localStorage.getItem('torneo_identidad');
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Validar que tenga los campos mínimos
    if (!data.parejaId) return null;
    return data;
  } catch {
    return null;
  }
}
```

La identidad tiene esta forma (ya definida en `src/identificacion/identidad.js`):
```javascript
{
  parejaId: 'uuid',
  parejaNombre: 'Tincho-Max',
  miNombre: 'Tincho',
  companero: 'Max',
  grupo: 'A',
  orden: 1
}
```

## Polling

Reutilizar el patrón exacto del `general.js` actual (líneas 29-57):
- `setInterval` cada 30s
- Pausar con `visibilitychange` cuando tab no visible
- Al hacer refresh: llamar a `cargarDatosConsulta()` y re-renderizar

**Importante**: El re-render debe preservar el tab y sub-tab activo (no resetear a "grupos" cada vez). El state object persiste entre refreshes — solo se actualiza `state.cache`.

## Orden de implementación

1. Crear `src/viewer/renderConsulta.js` extrayendo funciones de `modalConsulta.js`
2. Reescribir `src/general.js` como entry point delgado
3. Actualizar `general.html` (cambios mínimos)
4. Actualizar `src/viewer/vistaPersonal.js` (botón → link)
5. Simplificar `src/personal.js` (eliminar imports y lógica del modal)
6. Eliminar HTML del modal de `index.html`
7. Eliminar `src/viewer/modalConsulta.js`
8. Limpiar CSS del modal overlay
9. `npm run build` → verificar 0 errores
10. Verificar en browser: general.html con y sin identidad en localStorage

## Edge cases

- **Usuario llega a general.html directo (sin pasar por index.html)**: Funciona — la página carga sin identidad y muestra vista genérica. El botón "Identificarme" lo lleva a index.html.
- **Identidad en localStorage pero torneo cambiado**: La identidad tiene `parejaId` — si no coincide con ninguna pareja del torneo actual, los highlights simplemente no aplican (nada se rompe).
- **Copas sin partidos**: Tab "Copas" no se muestra (mismo comportamiento que el modal actual).
- **Polling actualiza datos**: El tab/sub-tab activo se preserva. Solo se refrescan los datos.

## Archivos afectados (resumen)

| Archivo | Acción |
|---------|--------|
| `src/viewer/renderConsulta.js` | **CREAR** — funciones de render extraídas |
| `src/general.js` | **REESCRIBIR** — entry point delgado (~80 líneas, hoy tiene 658) |
| `general.html` | **EDITAR** — título, subtítulo |
| `src/viewer/vistaPersonal.js` | **EDITAR** — botón modal → link a general.html |
| `src/personal.js` | **EDITAR** — eliminar imports y lógica del modal |
| `index.html` | **EDITAR** — eliminar HTML del modal |
| `src/viewer/modalConsulta.js` | **ELIMINAR** |
| `style.css` | **EDITAR** — eliminar estilos del overlay modal |

## Validación

- [ ] `npm run build` sin errores
- [ ] general.html SIN identidad: muestra tabs, primer grupo, sin highlights
- [ ] general.html CON identidad: mi grupo por defecto, mis partidos resaltados, scores orientados
- [ ] index.html: botón "Tablas / Grupos" navega a general.html
- [ ] Back button desde general.html → vuelve a index.html
- [ ] Polling funciona (datos se actualizan cada 30s sin perder tab activo)
- [ ] Tab Copas aparece solo si hay copas con partidos
- [ ] Tabla General carga correctamente (lazy load de standings)
- [ ] No quedan imports muertos a modalConsulta.js
