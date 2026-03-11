# Prompt: Planificación de implementación — Copa Approval v2

> Copiar este contenido completo al inicio de un nuevo chat con Claude Code (Opus).

---

## Rol

Tomá el rol de **arquitecto técnico senior**. Tu objetivo es planificar la implementación por etapas del Copa Approval v2 y escribir documentos técnicos para que agentes Sonnet los implementen.

## Documentos clave (leer antes de hacer cualquier cosa)

1. **`CLAUDE.md`** — Arquitectura del proyecto, módulos, patrones, base de datos
2. **`docs/spec-copa-approval-v2.md`** — Spec funcional APROBADA. No la cuestiones ni modifiques. Es la fuente de verdad de QUÉ hay que hacer.
3. **`docs/Bugs-Mejoras-raw.md`** — Bugs de la v1 que motivaron la v2 (contexto de por qué se rediseñó)

## Decisiones de diseño ya tomadas (no re-discutir)

### 1. Single source of truth = standings
Los cruces se DERIVAN de la tabla de posiciones client-side. No se almacenan propuestas intermedias en BD. La tabla `propuestas_copa` se depreca (no se borra, se deja de usar). Las RPCs `verificar_y_proponer_copas` y `aprobar_propuestas_copa` se deprecan.

### 2. Tabla general ordena por posición interna primero
El ORDER BY de la tabla general es: `posicion_en_grupo ASC, puntos DESC, ds DESC, dg DESC, gf DESC, sorteo ASC, pareja_id`. Esto significa que un 1° de grupo con 4 puntos queda ARRIBA de un 2° con 6 puntos. La posición interna es el logro principal, los stats solo desempatan dentro del mismo tier.

### 3. Sorteo como criterio final de desempate
Reemplaza el mecanismo actual de `posiciones_manual` (drag-and-drop). Cuando hay empate (mismos P, DS, DG, GF, sin H2H), el admin hace un sorteo físico e ingresa el resultado (orden 1°, 2°, 3°...). Se almacena en BD como single source of truth. Hay dos tipos:
- **Intra-grupo**: se resuelve desde Tab Grupos
- **Inter-grupo** (mismo tier de posición, distintos grupos): se resuelve desde Tab Copas

### 4. Algoritmo Mejor-Peor + swap secuencial de endógenos
- Paso 1: Aplicar seeding Mejor-Peor (1v4, 2v3 para 4 equipos; 1v8, 2v7... para 8)
- Paso 2: Recorrer cruces secuencialmente. Si encuentra endógeno (mismo grupo), intercambiar al peor seeded con un equipo de otro grupo en otro cruce. Buscar de abajo hacia arriba. Marcar equipos swappeados como "optimizados" para no re-tocarlos.
- El swap es automático y silencioso — el admin ve el resultado ya optimizado
- Si un endógeno no se puede resolver (ej: 1 solo grupo), queda con warning

### 5. Aprobación parcial (caso 1.5)
Cuando algunos grupos terminaron pero no todos, el admin puede aprobar cruces completos entre equipos de distintos grupos. Los equipos aprobados quedan "utilizados" — el algoritmo los excluye al calcular cruces restantes. Flag natural: equipos que ya tienen partidos de copa creados en BD.

### 6. Editar cruces = admin todo poderoso, efímero
El admin puede elegir CUALQUIER equipo del torneo (no solo clasificados). Los selectores muestran clasificados primero, otros después. Auto-dedup: un equipo no puede estar en dos slots. Warnings no bloqueantes (equipo no clasificado, mismo grupo, ya asignado a otra copa). Los cruces editados NO se persisten — viven en pantalla hasta que el admin aprueba (crea partidos) o cierra (pierde cambios).

### 7. Nueva RPC `crear_partidos_copa`
Reemplaza a `aprobar_propuestas_copa`. Recibe los cruces (calculados o editados client-side) y crea copa + partidos directamente. No lee de `propuestas_copa`.

### 8. DG falta en el RPC actual
`obtener_standings_torneo` retorna `puntos, ds, gf` pero NO `dg` (diferencia de games). Hay que agregarlo al output y al ORDER BY del ROW_NUMBER. La tabla JS (`tablaPosiciones.js`) sí lo calcula — el RPC debe ser consistente.

### 9. Fire-and-forget se elimina
Las llamadas a `verificar_y_proponer_copas` desde `cargarResultado.js` (fire-and-forget al confirmar resultado) se eliminan. El Tab Copas re-deriva todo desde standings cada vez que se abre.

### 10. Bracket con nombres
El bracket gráfico muestra nombres de equipos + grupo (ej: "Andy - Max (A 1°)") en lugar de "Tabla 1°". Los clasificados van en acordeón desplegable debajo del bracket.

## Código existente relevante

### Módulos que se reutilizan (NO reescribir)
- `src/utils/tablaPosiciones.js` — Cálculo de standings intragrupo: `calcularTablaGrupo`, `ordenarTabla`, `detectarEmpatesReales`, `esEmpateReal`, `ordenarConOverrides`
- `src/admin/copas/bracketLogic.js` — `seedingBombo(equipos)` para seeding Mejor-Peor, `cmpStatsDesc`, `winnerLoserFromMatch`
- `src/admin/copas/planEditor.js` — Wizard de configuración (no cambia)
- `src/admin/copas/presets.js` — Presets (no cambia, ya fue eliminado/migrado a planService)

### Módulos que se modifican fuerte
- `src/admin/copas/statusView.js` — Reescritura: nueva pipeline de datos (standings → derived matchups)
- `src/admin/copas/planService.js` — Eliminar funciones deprecadas, mover lógica pura a nuevo módulo
- `src/admin/copas/index.js` — Actualizar `determinarPaso()`: ya no depende de propuestas sino de copas + standings

### Módulos que se crean
- `src/utils/copaMatchups.js` — Motor de matchups: `calcularPoolParaCopa`, `optimizarCruces`, `detectarEmpateFrontera`. Funciones puras, sin IO.
- `src/admin/copas/copaDecisionService.js` — CRUD para sorteos en BD

### Módulos con cambios menores
- `src/viewer/cargarResultado.js` — Eliminar fire-and-forget calls (~línea 129)
- `src/admin/groups/` — Agregar UI de sorteo intra-grupo

### Migraciones SQL
- Fix `obtener_standings_torneo`: agregar `dg`, `gc`, cambiar ORDER BY
- Nueva tabla `sorteos` (reemplaza `posiciones_manual` conceptualmente)
- Nueva RPC `crear_partidos_copa`
- (NO borrar tablas/RPCs existentes — se deprecan silenciosamente)

### Tabla `posiciones_manual` existente
- Almacena overrides manuales de posición dentro de un grupo
- Se usa en `src/admin/groups/service.js`: `guardarOrdenGrupo`, `resetOrdenGrupo`
- Consumida por `ordenarConOverrides` en `tablaPosiciones.js`
- La nueva tabla de sorteos la reemplaza conceptualmente pero hay que definir la migración

## Tu tarea

1. **Planificar etapas incrementales y testeables**. Cada etapa debe poder testearse independientemente antes de avanzar a la siguiente. No construir sobre cosas no verificadas.

2. **Para cada etapa, escribir un documento técnico** en `docs/` que un agente Sonnet pueda implementar. Cada documento debe:
   - Listar archivos a crear/modificar con cambios específicos
   - Incluir los criterios de aceptación relevantes de la spec funcional
   - NO dejar decisiones funcionales al implementador
   - Referenciar código existente (funciones, tablas, RPCs) con paths exactos y números de línea
   - Incluir el SQL exacto de las migraciones
   - Especificar qué tests hacer (npm run build + pruebas manuales)

3. **Después de escribir cada documento**, compararlo contra `docs/spec-copa-approval-v2.md` y verificar que esté alineado, sea completo, y no haya zonas grises.

## Restricciones

- **NO implementes código**. Solo planificá y escribí los documentos técnicos.
- **Avisame antes de escribir cada documento** — tengo contexto adicional para darte sobre cada etapa.
- Las etapas deben ser testeables de forma independiente.
- El objetivo es que Sonnet no tenga que tomar decisiones funcionales y que solo tome mínimas decisiones de código.
