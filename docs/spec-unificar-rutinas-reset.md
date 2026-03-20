# Unificar Rutinas de Reset del Torneo — Spec Funcional

> **Estado**: Borrador — pendiente de priorización
> **Tipo**: Deuda técnica
> **Score owner**: 4/5
> **Riesgo**: Ya causó bugs reales (datos huérfanos al resetear copas)

---

## El problema hoy

Hay 4 implementaciones separadas de "limpiar datos del torneo" que no comparten código. Cada una sabe internamente qué tablas borrar, y cuando se agrega una tabla nueva hay que acordarse de actualizar todas.

### Las 4 rutinas actuales

| # | Ubicación | Qué limpia | Cuándo se usa |
|---|-----------|------------|---------------|
| 1 | `admin.js` → `resetearResultados()` | Scores de grupo + sorteos (todos) + posiciones_manual | Admin → Grupos → "Reset resultados" |
| 2 | `parejasImport.js` → `borrarTodoTorneo()` | TODO: partidos, copas, esquemas, sorteos, posiciones, parejas, grupos | Admin → Setup → "Importar parejas" |
| 3 | `planService.js` → `resetCopas()` (RPC) | Partidos de copa + copas + esquemas (CASCADE borra propuestas) | Admin → Copas → "Reset copas" / "Reset plan" |
| 4 | `copaDecisionService.js` → `resetSorteo()` | Sorteos (intra y/o inter grupo) | Admin → Grupos → botones de sorteo |

### Bugs que ya ocurrieron o pueden ocurrir

- **"Reset plan" en planEditor**: llama `resetCopas()` pero no limpia sorteos inter-grupo ni posiciones_manual → datos huérfanos en BD
- **"Reset copas" en statusView**: limpia sorteos inter-grupo pero no intra-grupo → sorteos intra-grupo inconsistentes con el nuevo estado
- **"Reset resultados" en admin**: limpia sorteos pero NO limpia partidos de copa → copa queda con cruces basados en standings que ya no existen

---

## Modelo mental: pirámide de dependencias

Los datos del torneo forman una pirámide donde cada nivel depende de los de abajo. Al cambiar un nivel, se invalida todo lo que está por encima.

```
         Copa partidos          ← tope: depende de standings
              ↑
     Sorteos (intra + inter)    ← dependen de resultados de grupo
              ↑
       Resultados de grupo      ← dependen de las parejas
              ↑
        Parejas + Grupos        ← base
```

Por fuera de la pirámide: **Esquema/plan de copa** → si se cambia, solo borra partidos de copa (no toca resultados de grupo ni sorteos).

### Regla: al cambiar un nivel, se borra todo lo de arriba

| Acción del admin | Qué se borra (cascada hacia arriba) |
|---|---|
| **Importar parejas nuevas** | Todo: parejas + grupos + resultados + sorteos + copa partidos + esquema |
| **Reset resultados de grupo** | Resultados de grupo + sorteos + copa partidos |
| **Reset copas** (cambiar esquema/plan) | Solo copa partidos (no toca resultados de grupo ni sorteos) |

---

## Solución propuesta

Centralizar en 3 RPCs de base de datos (transaccionales, atómicas) que respetan la pirámide:

### RPC 1: `reset_copas(p_torneo_id)`

Borra solo el tope de la pirámide: partidos de copa + copas + esquemas.

Incluye:
- Partidos donde `copa_id IS NOT NULL`
- Tabla copas
- Tabla esquemas_copa (CASCADE borra propuestas_copa)

NO toca: resultados de grupo, sorteos, parejas, grupos.

**Uso**: Admin → Copas → "Reset copas" / "Reset plan"

### RPC 2: `reset_resultados(p_torneo_id)`

Borra resultados de grupo y todo lo que depende de ellos (cascada hacia arriba).

Incluye:
- Llamar a RPC 1 (borrar copa partidos) — porque los standings cambiaron
- Borrar sorteos (intra + inter)
- Resetear campos de resultado en partidos de grupo (no borrar los partidos)
- Borrar posiciones_manual

NO toca: parejas, grupos, estructura de partidos de grupo.

**Uso**: Admin → Grupos → "Reset resultados"

### RPC 3: `borrar_todo_torneo(p_torneo_id)`

Borra absolutamente todo. Cascada completa.

Incluye:
- Llamar a RPC 2 (que a su vez llama a RPC 1)
- Borrar parejas
- Borrar grupos

**Uso**: Admin → Setup → "Importar parejas"

### Cambio en el código JS

Cada call site se reduce a una línea:
- `resetearResultados()` → llama RPC 2
- `resetCopas()` → llama RPC 1
- `borrarTodoTorneo()` → llama RPC 3
- `resetSorteo()` → se mantiene para reseteo individual de un sorteo específico (no es un "reset de nivel", es una operación atómica puntual)

---

## Impacto

- **Usuario**: Comportamiento más coherente — resetear resultados de grupo ahora también limpia copas (antes no lo hacía, dejando copas inconsistentes)
- **Desarrollador**: Una sola fuente de verdad. Las RPCs se llaman entre sí, así que la lógica de cascada vive en un solo lugar
- **Riesgo futuro**: Si se agrega una tabla nueva, solo hay que decidir en qué nivel de la pirámide vive y actualizar la RPC correspondiente

---

## Archivos involucrados

**JS (simplificar)**:
- `src/admin.js` — `resetearResultados()`
- `src/admin/parejas/parejasImport.js` — `borrarTodoTorneo()`
- `src/admin/copas/planService.js` — `resetCopas()`
- `src/admin/copas/statusView.js` — llamada a `resetCopas()` + cleanup manual de sorteos
- `src/admin/copas/planEditor.js` — llamada a `resetCopas()` (sin cleanup de sorteos)

**SQL (crear RPCs)**:
- Nueva migración con las 3 RPCs
- Reemplaza la RPC existente `reset_copas_torneo`
