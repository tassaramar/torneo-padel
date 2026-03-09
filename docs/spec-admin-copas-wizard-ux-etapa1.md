# Spec: Admin copas — UX wizard plantillas Etapa 1

**Estado**: 📋 PRIORIZADA
**Score owner**: 4/5
**Backlog**: "Admin copas — UX wizard plantillas (Etapa 1)"

---

## Contexto y decisiones de diseño

Esta spec reemplaza completamente la versión anterior. El diseño cambió en base a las siguientes decisiones del owner:

| Decisión | Antes | Ahora |
|----------|-------|-------|
| Plantillas | BD + fallback a `presets.js` estático | BD únicamente. Sin fallback. |
| Distinción default/custom | Dos secciones separadas | Lista unificada — todas iguales |
| Navegación en plantillas | Cards con botón "Aplicar" | Acordeón expandible con bracket diagram |
| Comparación | No posible | Múltiples acordeones abiertos simultáneamente |
| Filtrado | Defaults por formato, customs todos | Todas filtradas por formato del torneo actual |
| Terminología | "presets" | "plantillas" |

---

## Vista general de los 3 estados del módulo

```
Estado 1 — Sin plan:       [Panel 1: lista plantillas acordeón] + Crear nuevo
Estado 2 — Plan definido:  [Vista Plan Activo] con bracket + Reset
Estado 3 — Propuestas/en curso: statusView (sin cambios en esta spec)
```

---

## Estado 1: Panel 1 rediseñado — Lista de plantillas con acordeón

### Header del panel

Antes de la lista, una línea de contexto prominente:

```
Formato del torneo: 3 grupos × 4 equipos
```

Si `numGrupos === 0` (sin grupos configurados):
```
⚠️ Configurá los grupos primero (tab Grupos) antes de definir las copas.
```
En ese caso, no mostrar la lista de plantillas ni el botón "Crear nuevo".

### Lista de plantillas (acordeón)

Filtrado: solo plantillas compatibles con el formato actual (misma lógica de prefijo `clave` que existe hoy, aplicada a TODAS las plantillas por igual, sin distinción de ningún tipo).

Cada plantilla es una fila colapsada que se expande al tocar:

**Estado colapsado:**
```
┌─────────────────────────────────────────────┐
│  Los 4 primeros — Semi+Final        ›       │
└─────────────────────────────────────────────┘
```
- Nombre de la plantilla a la izquierda
- Ícono `›` / `∨` a la derecha que rota al expandir
- Touch target completo (toda la fila es tappable)

**Estado expandido** (tap de nuevo para colapsar):
```
┌─────────────────────────────────────────────┐
│  Los 4 primeros — Semi+Final        ∨       │
│ ─────────────────────────────────────────── │
│                                             │
│  Copa Oro  [Bracket 4]                      │
│                                             │
│  1°GrA ─┐                                  │
│           ├─ Semi 1 ─┐                     │
│  2°GrA ─┘            ├─→ Final → Campeón   │
│                       │                     │
│  1°GrB ─┐            │                     │
│           ├─ Semi 2 ─┘                     │
│  2°GrB ─┘                                  │
│                                             │
│  Copa Plata  [Cruce directo]                │
│                                             │
│  3°GrA ─┐                                  │
│           ├─→ Final → Campeón              │
│  3°GrB ─┘                                  │
│                                             │
│  [✓ Aplicar]              [🗑 Borrar]       │
└─────────────────────────────────────────────┘
```

**Comportamiento del acordeón:**
- Múltiples plantillas pueden estar abiertas simultáneamente (para comparar)
- Tap en el header de una plantilla abierta → la colapsa
- No hay límite de cuántas pueden estar abiertas a la vez

### Contenido de la plantilla expandida

Por cada copa en la plantilla:

1. **Encabezado de copa**: nombre + badge de formato (`Bracket 4`, `Bracket 8`, `Cruce directo`)

2. **Diagrama de bracket**: árbol visual mostrando los cruces esperados con labels de equipos derivados de las reglas de seeding. Ver sección "Diagrama de bracket" más abajo.

3. **Botón "Aplicar"**: aplica la plantilla al torneo. Comportamiento idéntico al actual `_applyEsquemas`. Después de aplicar, recarga → entra en Estado 2 (plan activo).

4. **Botón "Borrar"**: elimina la plantilla de la BD. Confirmar con `confirm()` antes. Todas las plantillas son borrables por igual.

### Empty state

Si no hay plantillas compatibles con el formato actual:

```
No hay plantillas guardadas para este formato (3 grupos × 4 equipos).
Creá una desde cero con el asistente.
```

### Botón "Crear nuevo"

Siempre visible al fondo de la lista (con o sin plantillas). Inicia el wizard de 4 paneles (sin cambios al wizard en esta spec).

### Cancelar en Paneles 2 y 3 del wizard

Al entrar al wizard, los paneles intermedios no tienen salida directa. Agregar botón **"Cancelar"** al fondo de los Paneles 2 y 3:

```
[Siguiente →]
[Cancelar]
```

- Vuelve directamente al Panel 1 (lista de plantillas) sin guardar nada
- Panel 4 (Preview) ya tiene "Cancelar" — no tocar

---

## Estado 2: Vista "Plan activo" (paso 2)

### Problema actual

Cuando `hayEsquemas && !hasPropuestas && !hayCopas` (paso 2), hoy se muestra el Panel 1 como si no hubiera plan. El admin no sabe qué configuró y el botón Reset no aparece.

### Estructura de la vista

```
[Breadcrumb: ✓Definir plan → [Esperar grupos] → Aprobar → En curso]
Esperando que finalicen los grupos (1 de 3 completados)

Plan de copas vigente
─────────────────────────────────────────────

Copa Oro  [Bracket 4]

1°GrA ─┐
        ├─ Semi 1 ─┐
2°GrA ─┘           ├─→ Final → Campeón
                    │
1°GrB ─┐           │
        ├─ Semi 2 ─┘
2°GrB ─┘

─────────────────────────────────────────────

Copa Plata  [Cruce directo]

3°GrA ─┐
        ├─→ Final → Campeón
3°GrB ─┘

─────────────────────────────────────────────

[🗑 Reset — borrar plan y empezar de nuevo]
```

**Detalles:**
- El diagrama de bracket usa la **misma función** `renderBracketDiagram` del Panel 1 — componente compartido, sin duplicación
- Reset usa `resetCopas(supabase, TORNEO_ID)` de `planService.js` — ya existe
- Confirmar con `confirm()` antes de ejecutar
- Después del reset: recarga → vuelve a Estado 1

### Cambio en `index.js`

```javascript
// Separar paso 1 vs paso 2:
if (!hayEsquemas) {
  renderPlanEditor(subContainer, () => cargarCopasAdmin());      // Estado 1
} else {
  renderPlanActivo(subContainer, esquemas, () => cargarCopasAdmin()); // Estado 2
}
```

`renderPlanActivo` puede vivir en `planEditor.js` (exportada) o en archivo nuevo.

---

## Diagrama de bracket — especificación del render

**Componente compartido — instancia única.** Usada tanto en Panel 1 (lista de plantillas) como en Vista Plan Activo. No duplicar bajo ningún concepto — ambos lugares importan/llaman la misma función.

```javascript
function renderBracketDiagram(copa, numGrupos)
// copa = { nombre, formato, reglas, equipos }
// numGrupos = número de grupos del torneo actual
// Returns: HTML string con el diagrama
```

### Labels de equipos

**Modo grupo** (`reglas = [{ posicion: 1 }, { posicion: 2 }]` con `numGrupos = 2`):
- Teams: `1°GrA`, `1°GrB`, `2°GrA`, `2°GrB`
- Grupos nombrados A, B, C... en orden

**Modo global** (`reglas = [{ modo: 'global', desde: 1, hasta: 4 }]`):
- Teams: `Tabla 1°`, `Tabla 2°`, `Tabla 3°`, `Tabla 4°`

### Asignación a slots del bracket

Seguir la lógica de seeding de `bracketLogic.js`. Para bracket de 4 (seeding estándar: 1 vs 4, 2 vs 3):
- Semi 1: seed 1 vs seed 4
- Semi 2: seed 2 vs seed 3

Si replicar la lógica de seeding resulta complejo, es aceptable mostrar los teams en orden y dejar que el admin infiera los cruces. Lo imprescindible: que el admin vea **quiénes clasifican a esta copa** y cuántas rondas hay.

### Estilos

- `font-family: monospace` para el árbol ASCII
- Mobile-first, legible en 320px
- No requiere CSS complejo

---

## Migración de BD requerida

La columna `es_default` en `presets_copa` debe eliminarse. La distinción default/custom ya no existe — todas las plantillas son iguales y se filtran por formato.

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_drop_es_default_presets_copa.sql
ALTER TABLE presets_copa DROP COLUMN es_default;
```

**Criterio de error**: hard fail. Si algún código referencia `es_default` después de la migración, que rompa en tiempo de build o en runtime. No agregar backwards-compatibility, no ignorar silenciosamente. La migración debe aplicarse **antes** de deployar el código de esta spec.

---

## Eliminación de `presets.js`

El archivo `src/admin/copas/presets.js` debe eliminarse. Contiene:
- `PRESETS_META`, `obtenerPresetsCompatibles` — eliminar
- `detectarYSugerirPreset` — **mover a `planService.js`** antes de eliminar el archivo

Actualizar el import en `planEditor.js`:
```javascript
// Eliminar:
import { detectarYSugerirPreset, obtenerPresetsCompatibles } from './presets.js';
// Reemplazar por:
import { detectarYSugerirPreset } from './planService.js';
```

La función `_filterDbCompatible` en `planEditor.js` se simplifica: misma lógica de prefijo `clave`, aplicada a todas las plantillas por igual, sin distinción de ningún tipo.

---

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/admin/copas/planEditor.js` | Rediseñar `_showPresets()` como acordeón de plantillas. Agregar `renderBracketDiagram()` (componente compartido). Agregar y exportar `renderPlanActivo()`. Cancelar en `_showWizNum()` y `_showWizCopa()`. Eliminar imports de `presets.js`. Simplificar `_filterDbCompatible` (sin distinción de tipo). |
| `src/admin/copas/index.js` | Separar paso 1 vs paso 2 → llamar `renderPlanActivo` cuando `hayEsquemas && !hasPropuestas && !hasCopas`. |
| `src/admin/copas/planService.js` | Recibir `detectarYSugerirPreset` movida desde `presets.js`. |
| `src/admin/copas/presets.js` | **Eliminar** (después de migrar `detectarYSugerirPreset`). |
| `supabase/migrations/` | Nueva migración: `ALTER TABLE presets_copa DROP COLUMN es_default`. |

---

## Criterios de aceptación

**Panel 1 — Lista acordeón:**
- [ ] Header: "Formato del torneo: N grupos × M equipos"
- [ ] Sin grupos: aviso, sin lista
- [ ] Plantillas: lista unificada, solo compatibles con formato actual
- [ ] Tap colapsado → expande; tap expandido → colapsa
- [ ] Múltiples plantillas pueden estar expandidas simultáneamente
- [ ] Expandido muestra bracket diagram por copa + botones Aplicar y Borrar
- [ ] Labels correctos: `1°GrA` (modo grupo) o `Tabla 1°` (modo global)
- [ ] "Aplicar" funciona
- [ ] "Borrar" funciona con `confirm()` previo
- [ ] Empty state si no hay plantillas compatibles
- [ ] "Crear nuevo" siempre visible al fondo

**Cancelar en wizard:**
- [ ] Panel 2: botón "Cancelar" al fondo → vuelve a Panel 1
- [ ] Panel 3: botón "Cancelar" al fondo → vuelve a Panel 1

**Vista Plan Activo (paso 2):**
- [ ] Con plan definido + sin propuestas + sin copas → muestra Vista Plan Activo, no Panel 1
- [ ] Muestra bracket por copa usando `renderBracketDiagram` (misma función que Panel 1)
- [ ] Reset visible, funciona, confirma antes, vuelve a Panel 1

**Migración BD:**
- [ ] Columna `es_default` eliminada de `presets_copa`
- [ ] Sin referencias a `es_default` en el código

**Eliminación `presets.js`:**
- [ ] Archivo eliminado
- [ ] `detectarYSugerirPreset` en `planService.js`
- [ ] Sin imports rotos

**General:**
- [ ] `npm run build` sin errores nuevos
- [ ] Legible en mobile 320px+
