# Spec Técnica: Aprobación de copas con visibilidad y control de cruces

**Spec funcional**: `docs/spec-copa-aprobacion-cruces.md` — leerla completa antes de cualquier cambio.
**Fecha**: 2026-03-09

---

## Resumen para el developer

Rediseñar el flujo de aprobación de copas en el tab Copas de admin.html. Hoy el admin ve propuestas y las aprueba en bloque sin contexto. El nuevo flujo tiene dos decisiones explícitas:

1. **¿Quiénes entran?** — mostrar clasificados con standings, empates y zona gris
2. **¿Contra quién juegan?** — mostrar cruces con warnings, permitir editar libremente

Además, el sistema genera propuestas **progresivamente**: cada vez que un grupo termina, recalcula con lo que tiene. Solo los partidos ya aprobados son firmes.

---

## Principio de arquitectura

**Una sola función de cálculo.** No debe haber código separado para "propuesta parcial" vs "propuesta completa". La diferencia es solo la cantidad de equipos en el input. Lo mismo para warnings: se calculan siempre, en el mismo lugar, sin importar si la propuesta es progresiva o final.

Un único punto de entrada para generar propuestas. Un único punto de salida con clasificados, cruces y warnings. Si hay triggers, se disparan desde ese único lugar.

---

## Cambios por capa

### 1. RPC `verificar_y_proponer_copas` — Migración nueva

**Archivo**: nueva migración `supabase/migrations/YYYYMMDDHHMMSS_propuestas_progresivas.sql`

**Cambios al RPC existente** (definido en `20260303000000_fix_copa_avanzar_ronda.sql`):

#### 1a. Permitir recálculo de propuestas pendientes

Hoy el RPC tiene un guard de idempotencia (línea ~82):
```sql
IF EXISTS (
  SELECT 1 FROM propuestas_copa
  WHERE esquema_copa_id = v_esquema.id
    AND estado IN ('pendiente', 'aprobado')
) THEN CONTINUE;
```

Cambiar a: solo saltar si hay propuestas **aprobadas**. Si hay pendientes, **borrarlas y recalcular**:
```sql
-- Si ya hay propuestas aprobadas para este esquema, no tocar
IF EXISTS (
  SELECT 1 FROM propuestas_copa
  WHERE esquema_copa_id = v_esquema.id AND estado = 'aprobado'
) THEN
  -- Borrar solo las pendientes para recalcular cruces no aprobados
  DELETE FROM propuestas_copa
  WHERE esquema_copa_id = v_esquema.id AND estado = 'pendiente';
  -- Continuar con la generación (los equipos de propuestas aprobadas se excluyen)
END IF;

-- Si NO hay nada (ni aprobadas ni pendientes), generar de cero
-- (el resto del código existente se ejecuta)
```

#### 1b. Permitir propuestas parciales (seeding por posición de grupo)

Hoy el RPC solo genera propuestas cuando puede crear TODAS las de un esquema. Cambiar para que genere propuestas **con los equipos disponibles**, permitiendo slots vacíos (`pareja_a_id = NULL` o `pareja_b_id = NULL`).

Para reglas con `posicion`, la query existente ya filtra `grupo_completo = TRUE` — esto está correcto. Lo que hay que cambiar es que si tiene 3 de 4 equipos, genere las propuestas con un slot NULL.

La lógica de seeding bombo (`1v4, 2v3`) debe funcionar con equipos NULL:
- Si hay 4 equipos → `[1v4, 2v3]` (completo)
- Si hay 3 equipos → `[1vNULL, 2v3]` (la semi con el seed más bajo puede ser incompleta)
- Si hay 2 equipos → `[1vNULL, 2vNULL]` o `[NULL, 2v1]` (según el bracket)

**IMPORTANTE**: para seeding `modo:'global'`, mantener el guard actual que requiere TODOS los grupos completos. Solo el seeding por posición de grupo soporta propuestas progresivas.

#### 1c. Considerar partidos ya aprobados al recalcular

Al generar las propuestas, los equipos que ya están en propuestas `aprobado` deben excluirse del pool. La query `v_ya_asignados` existente (línea ~40) ya hace esto — verificar que incluya los equipos de propuestas aprobadas del MISMO esquema, no solo de otros esquemas.

### 2. RPC `aprobar_propuestas_copa` — Aprobación individual

**Archivo**: misma migración nueva

Modificar para aceptar aprobación de propuestas individuales:

```sql
CREATE OR REPLACE FUNCTION public.aprobar_propuestas_copa(
  p_esquema_copa_id UUID,
  p_propuesta_ids UUID[] DEFAULT NULL  -- NULL = aprobar todas (backwards compatible)
)
```

Si `p_propuesta_ids` es NULL, comportamiento actual (aprueba todas las pendientes).
Si se pasa un array, solo aprueba esas propuestas específicas.

La copa se crea en la primera aprobación y se reutiliza en las siguientes.

### 3. `src/admin/copas/planService.js` — Funciones nuevas

#### 3a. `calcularClasificadosConWarnings(standings, esquema, propuestasAprobadas)`

Función pura (sin IO) que recibe standings del RPC `obtener_standings_torneo` y las reglas del esquema, y retorna:

```javascript
{
  clasificados: [
    { parejaId, nombre, puntos, ds, gf, grupoId, grupoNombre, posicionEnGrupo, seed },
    ...
  ],
  zonaGris: [  // solo equipos empatados con el último clasificado
    { parejaId, nombre, puntos, ds, gf, grupoId, grupoNombre, posicionEnGrupo },
    ...
  ],
  pendientes: [  // grupos que faltan terminar
    { grupoId, grupoNombre, partidosFaltantes },
    ...
  ],
  warnings: [
    { tipo: 'empate_frontera', equipos: ['Sofi-Caro', 'Pedro-Juan'], detalle: '4 pts, DS +1' },
    { tipo: 'empate_grupo', grupoNombre: 'Grupo A', posiciones: '1°-3°' },
    ...
  ]
}
```

**Lógica de empates en frontera**: comparar `(puntos, ds, gf)` del último clasificado con el primer excluido. Si son iguales → hay empate → agregar a zona gris todos los que tengan los mismos stats.

**Lógica de empates en grupo**: para seeding por posición, detectar empates a 3+ dentro de un grupo donde las posiciones afectan la clasificación a diferentes copas.

#### 3b. `calcularCrucesConWarnings(clasificados, esquema, propuestasAprobadas, partidos)`

Función pura que recibe los clasificados confirmados y genera los cruces sugeridos:

```javascript
{
  cruces: [
    {
      ronda: 'SF', orden: 1,
      parejaA: { id, nombre, grupoId, grupoNombre },
      parejaB: { id, nombre, grupoId, grupoNombre },  // null si pendiente
      aprobado: false,
      propuestaId: UUID  // null si es cruce nuevo
    },
    ...
  ],
  warnings: [
    { tipo: 'mismo_grupo', cruce: 'Semi 2', equipos: ['Nico-Fede', 'Ana-Lu'], grupo: 'Grupo A' },
    ...
  ]
}
```

**Warning de mismo grupo**: comparar `grupoId` de pareja_a y pareja_b en cada cruce.

**Cruces aprobados**: incluirlos en la lista marcados con `aprobado: true`. No se pueden editar.

**Seeding**: reutilizar `seedingBombo` de `bracketLogic.js` para generar el orden. Excluir equipos ya en cruces aprobados.

#### 3c. `aprobarPropuestaIndividual(supabase, esquemaCopaid, propuestaId)`

Wrapper que llama al RPC modificado con `p_propuesta_ids: [propuestaId]`.

#### 3d. `cargarStandingsParaCopas(supabase, torneoId)`

Carga los standings + info de grupos para alimentar las funciones de cálculo:

```javascript
export async function cargarStandingsParaCopas(supabase, torneoId) {
  const [standingsRes, gruposRes] = await Promise.all([
    supabase.rpc('obtener_standings_torneo', { p_torneo_id: torneoId }),
    supabase.from('grupos').select('id, nombre').eq('torneo_id', torneoId)
  ]);
  // Combinar: enriquecer standings con nombre de grupo
  // Retornar: { standings: [...], grupos: [...], todosCompletos: boolean }
}
```

### 4. `src/admin/copas/statusView.js` — Reescritura de la vista de propuestas

#### 4a. Sub-estado "Propuestas pendientes" → reemplazar completamente

Hoy `_renderEsquemaPropuestas` muestra una lista plana con botón ⇄. Reemplazar por el flujo de dos decisiones:

**Decisión 1 — Clasificados:**
- Renderizar tabla de clasificados usando output de `calcularClasificadosConWarnings`
- Si hay `zonaGris`, mostrar separador visual y equipos en gris con ⚠️
- Botón "Intercambiar" en cada equipo de zona gris → al tocar, swap 1:1 con el último clasificado (o elegir cuál sacar)
- Si hay `pendientes` (grupos no terminados), mostrar con ⏳
- Si hay `warnings` de empate en grupo, mostrar aviso con link al tab Grupos
- Botón "Confirmar clasificados" para avanzar a Decisión 2

**Decisión 2 — Cruces:**
- Renderizar cruces usando output de `calcularCrucesConWarnings`
- Mostrar warnings de "ya jugaron en grupo" en cada cruce afectado
- Cada cruce con ambos equipos: botón `[Aprobar]` individual
- Cruces con slot NULL (pendiente): mostrar `⏳ pendiente`, sin botón
- Cruces ya aprobados: mostrar como firmes (sin botones de edición)
- Botón "Editar cruces" → convierte nombres en `<select>` con los clasificados disponibles
- En modo edición: al cambiar un select, auto-reasignar el equipo desplazado. Warnings se recalculan
- Botón "Volver a sugeridos" → descarta ediciones, restaura cruces del cálculo original
- Botón "Aprobar todos" → aprobar todas las propuestas pendientes de una vez (para el caso simple)

#### 4b. Estado de la UI

Manejar el estado de Decisión 1 vs Decisión 2 en memoria (no persistido). Variables:
- `clasificadosConfirmados`: boolean, empieza en false
- `modoEdicion`: boolean, para el modo editar cruces
- `crucesEditados`: array temporal con los cambios del admin (se descarta si no aprueba)

Si no hay zona gris ni warnings de empate → Decisión 1 se puede auto-confirmar (mostrar clasificados como info, saltar directo a Decisión 2). Definir esto en la implementación: si el caso simple no tiene empates, ¿mostrar Decisión 1 igual o saltarla? **Recomendación**: mostrarla siempre pero sin botón "Confirmar" explícito — los clasificados se muestran como contexto arriba de los cruces.

#### 4c. Sub-estado "Esperando grupos" → enriquecer

Hoy `_renderEsquemaEsperando` muestra un mensaje genérico. Cambiar para:
- Si es seeding por posición y hay equipos parciales → mostrar clasificados parciales + cruces parciales (Momentos 1 y 2 de la spec funcional)
- Si es modo global → mostrar progreso de grupos ("2 de 3 completos, falta Grupo C")

### 5. `src/admin/copas/index.js` — Ajustar determinación de estado

#### 5a. `determinarPaso` → considerar propuestas parciales

Hoy:
- `paso 2` = esquemas existen, sin propuestas pendientes, sin copas (esperando)
- `paso 3` = propuestas pendientes existen

Con propuestas progresivas, puede haber propuestas pendientes ANTES de que todos los grupos terminen. El `paso 3` (mostrar propuestas) debe activarse cuando hay propuestas, aunque sean parciales.

Verificar que `determinarPaso` ya maneja esto correctamente (parece que sí: `propuestasPendientes.length > 0 → paso 3`). Si no, ajustar.

#### 5b. Pasar standings al render

`cargarCopasAdmin()` debe cargar standings (vía `cargarStandingsParaCopas`) y pasarlos a `renderStatusView` como parámetro adicional.

### 6. `src/viewer/cargarResultado.js` — Sin cambios en el trigger

El fire-and-forget en línea ~129 ya llama `verificar_y_proponer_copas` cada vez que un resultado se confirma. Con el RPC modificado, esto automáticamente recalculará las propuestas progresivamente.

El trigger existente ya es el "único punto de entrada" para la generación — no agregar otro.

### 7. `src/admin/copas/bracketLogic.js` — Extender seeding

#### 7a. `seedingBombo` → soportar equipos NULL

Modificar para que acepte arrays con nulls (equipos pendientes):
```javascript
// Input: [team1, team2, team3, null]  (3 de 4 definidos)
// Output: [[team1, null], [team2, team3]]  (null va con el mejor seed)
```

#### 7b. Agregar función `excluirAprobados(equipos, propuestasAprobadas)`

Filtra del pool los equipos que ya están en propuestas aprobadas.

---

## Verificación de concordancia funcional ↔ técnica

| Requisito funcional | Implementación técnica |
|---------------------|----------------------|
| Clasificados con puntos, DS, grupo de origen | `cargarStandingsParaCopas` + `calcularClasificadosConWarnings` |
| Zona gris (empate en frontera) | Comparación de `(puntos, ds, gf)` en `calcularClasificadosConWarnings` |
| ⚠️ empate en grupo | Detección de 3+ equipos con mismos stats en mismo grupo |
| Warning "ya jugaron en grupo" | Comparación de `grupoId` en `calcularCrucesConWarnings` |
| Editar cruces libremente | `<select>` en `statusView.js` con auto-reasignación |
| Aprobar partido individual | RPC modificado + `aprobarPropuestaIndividual` |
| Propuestas progresivas | RPC permite recálculo de pendientes + parciales con NULL |
| Recálculo al terminar grupo | Fire-and-forget existente en `cargarResultado.js` ya lo hace |
| Partidos aprobados son firmes | RPC excluye aprobados del recálculo; UI los marca como firmes |
| Warnings en propuestas parciales y completas | Misma función de cálculo, mismos warnings |
| Un solo código para parcial y completo | `calcularClasificadosConWarnings` + `calcularCrucesConWarnings` agnósticas |
| Modo global espera todos los grupos | Guard existente en RPC se mantiene |

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/migrations/new.sql` | Migración: modificar `verificar_y_proponer_copas` (recálculo + parciales) y `aprobar_propuestas_copa` (individual) |
| `src/admin/copas/planService.js` | Nuevas funciones: `calcularClasificadosConWarnings`, `calcularCrucesConWarnings`, `aprobarPropuestaIndividual`, `cargarStandingsParaCopas` |
| `src/admin/copas/statusView.js` | Reescribir `_renderEsquemaPropuestas` y `_renderEsquemaEsperando` con flujo de 2 decisiones |
| `src/admin/copas/index.js` | Cargar standings y pasarlos a statusView |
| `src/admin/copas/bracketLogic.js` | Extender `seedingBombo` para soportar NULLs |

**NO modificar**: `cargarResultado.js` (el trigger existente ya funciona), `planEditor.js`, `style.css` (usar clases `.wiz-*` existentes).

---

## Al terminar

1. `npm run build` sin errores nuevos
2. Verificar la migración SQL aplicando en Supabase (dashboard o CLI)
3. Actualizar `docs/brainstorming-proximas-mejoras.md`:
   - Mover los ítems resueltos del roadmap y del backlog al `## Historial` con fecha
   - Los ítems que se resuelven: Swap ⇄, Seeding global evitar mismo grupo, Tabla general visible antes de aprobar
4. `npm version minor` (es feature nueva, no patch)
5. `git push && git push --tags`
