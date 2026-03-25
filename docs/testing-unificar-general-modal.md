# Testing: Unificar general.html con modal de consulta

**Versión**: 1.4.9
**Fecha**: 2026-03-25
**Spec**: [spec-unificar-general-modal.md](spec-unificar-general-modal.md)

---

## Escenario 1 — Usuario SIN identidad en localStorage

1. Abrí una ventana de incógnito (o limpiá `localStorage`)
2. Navegá a `/general.html` directamente
3. Verificar:
   - [x] Se ven los tabs: **Grupos** / _(Copas si hay)_ / **Fixture**
   - [x] Tab Grupos activo por defecto, muestra el primer grupo
   - [x] Sub-tabs por grupo + "General" funcionan
   - [x] Tabla General carga al hacer click en "General"
   - [x] Tab Copas muestra brackets (si hay copas activas)
   - [x] Tab Fixture muestra cola de partidos pendientes
   - [x] Botónmar de nav dice **"🎾 Identificarme"** → al clickear, va a `index.html`
   - [x] No hay highlights de "mi pareja" (ni bordes verdes/rojos)

---

## Escenario 2 — Usuario CON identidad (identificado en index.html)

1. Navegá a `index.html` e identificate con tu pareja
2. Clickeá el botón **"📊 Tablas / Grupos"**
3. Verificar:
   - [x] Navegás a `/general.html` (URL cambia en el browser)
   - [x] Tab Grupos activo, **tu grupo** seleccionado por defecto como sub-tab
   - [o] Tu pareja tiene el fondo azul claro (`.mi-pareja`) en la tabla de posiciones
   - [ ] Tus partidos tienen fondo amarillo/verde/rojo según resultado (`.es-mio`, `.mi-victoria`, `.mi-derrota`)
   - [x] Botón de nav dice **"👤 Ver Mis Partidos"** → al clickear, vuelve a `index.html`

---

## Escenario 3 — Botón Back del browser

1. Estando en `index.html` identificado, clickeá "Tablas / Grupos"
2. Navegás a `/general.html`
3. Presioná **Back** en el browser (o gesto de swipe en mobile)
4. Verificar:
   - [ ] Volvés a `index.html` — el Back funciona nativamente

---

## Escenario 4 — Polling (datos se actualizan sin perder navegación)

1. Navegá a `/general.html`
2. Esperá 30 segundos (o cargá un resultado desde otro tab)
3. Verificar:
   - [ ] El status ("Actualizado HH:MM:SS") se actualiza sin recargar la página
   - [ ] El tab activo y sub-tab activo se **preservan** (no resetea a Grupos)

---

## Escenario 5 — index.html simplificado

1. Navegá a `index.html`
2. Verificar:
   - [ ] No existe ningún modal (no hay `#modal-consulta` en el DOM — verificar con DevTools)
   - [ ] El botón "Tablas / Grupos" es un `<a>` (no un `<button>`) — click navega, no abre overlay
