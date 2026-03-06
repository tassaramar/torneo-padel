# Spec: Modal index.html — mi pareja siempre primero en los partidos

**Estado**: 📋 PRIORIZADA
**Score owner**: 4/5
**Backlog**: "Modal index.html — pareja del jugador siempre primero en listado"

---

## Contexto

### El problema del jugador

Cuando un jugador abre el modal de Tablas/Grupos/Fixture, ve los partidos en el orden de la base de datos. Si su pareja fue cargada como `pareja_b`, los partidos aparecen como "Rival vs Yo" en lugar de "Yo vs Rival".

El jugador tiene que buscar su nombre entre los dos para entender el resultado. No es bloqueante, pero es confuso — especialmente en la tabla de partidos del grupo donde hay varios partidos seguidos.

**Nota**: En la pantalla principal de index.html (fuera del modal), las cards ya muestran solo el rival. Este cambio aplica exclusivamente al modal.

---

## Alcance

El cambio aplica a **todos los tabs del modal** donde se muestran partidos con dos equipos:

| Sección | Función en código | ¿Tiene scores? |
|---------|-------------------|----------------|
| Tab Grupos → "Partidos del grupo" | `renderPartidosGrupo` | Sí (partidos jugados) |
| Tab Copas → llaves por copa | `renderCopas` | Sí (partidos jugados) |
| Tab Fixture → lista de pendientes | `renderFixture` | No (solo pendientes) |

**Tabla de posiciones** (tab Grupos): no aplica. Es una tabla por pareja, no por partido. Sin cambios.

---

## Lógica de orientación

### Regla principal

Para cada partido renderizado en el modal:

- Si `p.pareja_a.id === identidad.parejaId` → mostrar A primero (orden BD, sin cambios)
- Si `p.pareja_b.id === identidad.parejaId` → mostrar **B primero** (mi pareja arriba/izquierda, rival abajo/derecha)
- Si el jugador no participa en el partido (`esMiPartido === false`) → mantener orden BD

El swap es **visual únicamente** — nunca se modifica el objeto `partido` ni los datos.

### Inversión de score

Cuando se invierte el orden de las parejas en un partido **jugado**, el score también debe invertirse para que corresponda con los nombres mostrados.

Ejemplo:
- BD: `pareja_a = "Andy-Max"` con score `6-3` (A ganó)
- Jugador es `pareja_b = "Gaby-Uri"`
- Mostrar: **"Gaby-Uri 3-6 Andy-Max"** (Gaby primero, su score primero)

Sin esta inversión, el nombre y el número quedarían cruzados (Gaby aparece primero pero el `6` le correspondería a Andy).

En el tab **Fixture** (solo pendientes) no hay score → no aplica la inversión.

### Helper recomendado

Se sugiere crear un helper `orientarPartido(partido, identidad)` que centralice esta lógica y sea reutilizable en las tres secciones:

```
orientarPartido(partido, identidad) → {
  nombreLocal:    nombre de mi pareja (o pareja_a si no participo)
  nombreVisitante: nombre del rival (o pareja_b si no participo)
  invertido:      boolean — true si se swapeó A↔B
}
```

Cuando `invertido === true`, el renderizado de scores debe invertir el orden de games (mostrar scores de B antes que de A).

---

## Comportamiento por tab

### Tab Grupos — "Partidos del grupo"

Lista dentro del `<details>` "Partidos del grupo". Afecta función `renderPartidosGrupo`.

- Partidos **pendientes**: swap de nombres. No hay score.
- Partidos **jugados**: swap de nombres + inversión de score.
- El badge de resultado (`mi-victoria` / `mi-derrota`) no cambia — ya usa `identidad.parejaId` correctamente.

### Tab Copas

Lista de partidos por copa en `renderCopas`.

- Partidos **pendientes**: swap de nombres.
- Partidos **jugados**: swap de nombres + inversión de score inline (el score aparece entre los dos nombres: `A <score> B`).
- El badge `mi-victoria` / `mi-derrota` no cambia.
- Partidos con equipo aún no determinado (`⏳ Esperando resultado anterior`): sin cambios, no hay nombres que swapear.

### Tab Fixture

Lista de pendientes en `renderFixture`. Incluye partidos de grupo y de copa.

- Solo swap de nombres. Sin inversión de score (no hay scores en pending).
- Para partidos de copa: si el equipo aún no está determinado (`nombre === null`), sin cambios.

---

## Lo que NO cambia

- La identidad del jugador (`identidad.parejaId`) ya está disponible en `modalState.identidad`.
- Las clases CSS `es-mio`, `mi-victoria`, `mi-derrota` ya funcionan correctamente con `identidad.parejaId`. No tocarlas.
- La tabla de posiciones (standings) en tab Grupos y tab General. No hay partidos ahí.
- El orden de los partidos en la lista (ordenados por ronda, jugados al final). Solo cambia el orden visual de los nombres dentro de cada card.
- Nada en index.html fuera del modal.

---

## Archivo a modificar

**`src/viewer/modalConsulta.js`** — único archivo afectado.

Funciones a modificar:
- `renderPartidosGrupo` (línea ~646)
- `renderCopas` (línea ~485, sección de renderizado de cada partido)
- `renderFixture` (línea ~561, secciones de grupo y copa)

Se puede agregar el helper `orientarPartido` en el mismo archivo (función privada, no exportar).

---

## Criterios de aceptación

- [ ] En tab Grupos (partidos del grupo): mi pareja siempre aparece primero en el listado de partidos
- [ ] En tab Copas: mi pareja siempre aparece primero en cada partido donde participo
- [ ] En tab Fixture: mi pareja siempre aparece primero en los partidos pendientes donde participo
- [ ] Partidos donde el jugador no participa mantienen el orden BD
- [ ] En partidos jugados donde se invirtió el orden: el score se invierte también (nombres y scores son consistentes)
- [ ] Los colores `mi-victoria` / `mi-derrota` siguen siendo correctos
- [ ] No se modifica el objeto `partido` en memoria (solo renderizado visual)
- [ ] `npm run build` sin errores nuevos
