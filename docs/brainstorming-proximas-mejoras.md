# Product Backlog — Torneo de Pádel

> **Fuente única de verdad** para ideas, requerimientos y evolución del producto.
> Detalles técnicos de arquitectura → ver `CLAUDE.md`

**Última actualización**: 2026-03-25 (4 bugfixes en general.html: icono subrayado, empate PJ=0, color header tabla, parpadeo polling)

---

## Cómo usar este documento

- **Toda idea nueva** entra primero en `## Ideas Crudas` con estado `💡 CRUDA`
- **Al iniciar chat con IA**: copiar el bloque al final de este archivo (`## Bloque para IA`)
- **Al completar trabajo**: mover el ítem a `## Historial` con fecha y breve nota
- **Regla anti-cementerio**: si un ítem lleva +60 días sin avanzar, agregar nota de bloqueo o moverlo a Descartado
- **No duplicar con CLAUDE.md**: decisiones técnicas de implementación van en CLAUDE.md; acá van ideas y su estado

---

## Estados

| Emoji | Estado | Significado |
|-------|--------|-------------|
| 💡 | CRUDA | Idea registrada, sin análisis |
| 🔍 | EN ANÁLISIS | Siendo evaluada, preguntas abiertas |
| 📋 | PRIORIZADA | Analizada y lista para desarrollar |
| 🚧 | EN DESARROLLO | Sprint activo ahora mismo |
| ✅ | IMPLEMENTADA | Funcionando en producción |
| 🏆 | VALIDADA | Probada en torneo real |
| 🚫 | DESCARTADA | No se desarrollará (motivo registrado) |

---

## Próximas 3 — Roadmap activo

> Máximo 3 ítems a la vez. Para agregar uno, sacar uno primero. Obliga a priorizar.

1. _(libre)_
2. _(libre)_
3. _(libre)_

---

## Backlog

> Ordenado por prioridad (Bloques A → B → C → D). Repriorizado 2026-03-19 con foco en claridad y comunicación al jugador.

### Bloque A — Bugs que afectan UX del jugador

---

#### [BUG] index.html — scroll bump al tener partidos a confirmar `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

Si hay un partido a confirmar y el jugador hace scroll hacia abajo para ver los pendientes, al llegar al final de la página se produce un "bump" que lo devuelve automáticamente al partido a confirmar. Rompe la navegación del jugador.

**Archivos clave**: `src/viewer/vistaPersonal.js`, `src/personal.js`

---

---

### Bloque B — Claridad y comunicación al jugador

---

#### [MEJORA] Modal grupos — separar partidos jugados de pendientes `📋 PRIORIZADA`

**Score owner**: pendiente · **Spec**: ❌ falta

En el detalle de un grupo dentro del modal, los partidos jugados y pendientes aparecen mezclados. Agruparlos en dos secciones claras: primero los pendientes (con número de partido), luego los jugados. Mejora la lectura y permite al jugador encontrar rápidamente lo que busca.

**Archivos clave**: `src/viewer/renderConsulta.js`

---

#### [MEJORA] Feedback explícito al confirmar resultado rival `📋 PRIORIZADA`

**Score owner**: pendiente · **Spec**: ❌ falta

Cuando un jugador confirma el resultado cargado por la pareja rival (desde index.html), no hay feedback visual claro de que se confirmó. Agregar toast o mensaje visible "Resultado confirmado".

**Archivo clave**: `src/viewer/cargarResultado.js`

---

---

#### [MEJORA] Bracket copas — propagar ganadores a la ronda siguiente `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ✅ [spec-bracket-propagacion-ganadores.md](spec-bracket-propagacion-ganadores.md)

Cuando un partido de QF/SF tiene ganador confirmado, mostrar el nombre del equipo en el slot correspondiente de la ronda siguiente (hoy dice "pendiente" hasta que toda la ronda termina). Cambio puramente visual/client-side, ~30-40 líneas. Prerequisito cumplido: bracket renderer unificado en `src/utils/bracketRenderer.js`.

**Archivos clave**: `src/utils/bracketRenderer.js`

---

#### [MEJORA] Modal Tablas/Grupos — renombrar título "Consultar" `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

El título del modal muestra "Consultar", que no describe bien su contenido (tablas, copas y fixture). Cambiar por un título más descriptivo.

**Archivos clave**: `src/viewer/renderConsulta.js`, `general.html`

---

#### [MEJORA] Partidos jugados (index.html) — card con colores ganado/perdido `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

La lista "Ver partidos jugados" solo tiene color en el score (verde/rojo en el número). Aplicar estilo de card con fondo verde suave (ganado) o rojo suave (perdido), consistente con el patrón visual del modal.

**Archivos clave**: `src/viewer/vistaPersonal.js`, `style.css`

---

#### [MEJORA] Mensaje de cierre cuando el jugador terminó todos sus partidos `📋 PRIORIZADA`

**Score owner**: 2/5 · **Spec**: ✅ [spec-vista-jugador-mensaje-final.md](spec-vista-jugador-mensaje-final.md)

Hoy dice "No tenés partidos pendientes". Reemplazar por mensaje contextual: si ganó copa → "Campeón"; si fue finalista → "Finalista"; si solo jugó grupos → posición final + mensaje con onda.

**Archivo clave**: `src/viewer/vistaPersonal.js`

---

### Bloque C — Admin / Operador + deuda técnica

---

#### [DEUDA TÉCNICA] Unificar rutinas de reset del torneo `📋 PRIORIZADA`

**Score owner**: 4/5 · **Spec**: ✅ [spec-unificar-rutinas-reset.md](spec-unificar-rutinas-reset.md)

4 implementaciones separadas de limpieza que no comparten código. Ya causó bugs reales (datos huérfanos). Centralizar en RPCs de BD con modelo piramidal.

**Archivos clave**: `groups/index.js`, `statusView.js`, `groups/service.js`, `parejasImport.js`

---

#### [MEJORA] Autorefresh background — sin parpadeo al actualizar `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

El autorefresh (cada 30s) reconstruye el DOM completo, lo que genera un parpadeo visible y resetea el scroll. Propuesta: hacer el fetch en background, y solo aplicar los cambios al DOM cuando los datos nuevos ya están listos.

**Archivos clave**: `src/personal.js`, `src/fixture.js`

---

#### [MEJORA] fixture.html — ocultar secciones de grupos en fase de copas `📋 PRIORIZADA`

**Score owner**: 1/5 · **Spec**: ✅ [spec-fixture-ocultar-grupos-fase-copa.md](spec-fixture-ocultar-grupos-fase-copa.md)

Cuando no quedan partidos de grupo pendientes ni en juego, ocultar las secciones "Resumen por Grupo", "En Juego" y "Pendientes". Condición: `pendientes === 0 && en_juego === 0`.

**Archivo clave**: `src/fixture.js`

---

#### [MEJORA] Wizard copas — restringir a tabla general si cantidad de grupos es impar `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

Si el torneo tiene cantidad impar de grupos (1, 3, 5), el formato "por posición de grupo" genera cruces asimétricos. El wizard debería restringir la opción a solo "tabla general" cuando hay grupos impares.

**Archivo clave**: `src/admin/copas/planEditor.js`

---

#### [BUG] Wizard copas — método de clasificación debe ser consistente entre todas las copas `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

Hoy el admin puede configurar una copa con seeding "por posición de grupo" y otra con seeding "global" dentro del mismo torneo. Esto no tiene sentido — el ranking es uno solo. Todas las copas deben usar el mismo método.

**Archivo clave**: `src/admin/copas/planEditor.js`

---

#### [MEJORA] Wizard copas — último panel muestra diagrama gráfico de cruces `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

El paso 4 (preview) muestra un resumen textual. Sería más útil mostrar el cruce gráfico (bracket visual).

**Archivo clave**: `src/admin/copas/planEditor.js`

---

#### [BUG] fixture.html — badge presentismo no aparece en pareja nueva tras edición `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

Al cambiar una pareja (editar integrantes), la pareja original conserva el badge pero la nueva no lo muestra aunque sus jugadores estén presentes. Probable desfase entre nombre en `presentes[]` y nombre nuevo.

**Archivo clave**: `src/fixture.js` o `src/utils/colaFixture.js`

---

#### [BUG] fixture.html — partidos de copa no muestran estado "En curso" `💡 CRUDA — NO REPRODUCIBLE`

**Score owner**: pendiente · **Spec**: ❌ falta

Reportado: al marcar un partido de copa como en juego desde fixture, la sección "En curso" no refleja el cambio. Testeado 2026-03-19: no se pudo reproducir con el código actual.

**Archivo clave**: `src/fixture.js`

---

#### [MEJORA] Admin copas — resaltar al ganador en los partidos `💡 CRUDA`

**Score owner**: 3/5 · Quick win (~5 líneas)

Nombre de la pareja ganadora en **negrita** en la vista admin de copas.

**Archivo clave**: `src/admin/copas/statusView.js`

---

#### [BUG] Carga — mensaje STB sigue mostrando después de cargar el resultado `🔍 EN ANÁLISIS — DIFERIDO`

**Score owner**: 4/5 · **Spec**: ❌ falta · **Motivo diferimiento**: solo aplica a torneos a 3 sets.

Partido con super tiebreak: se carga el STB y el mismo mensaje ("contame qué pasó") sigue apareciendo en vez de feedback contextual.

**Archivo clave**: `src/viewer/cargarResultado.js`

---

### Bloque D — Diferir (diseño grande o bajo entusiasmo)

---

#### [MEJORA] Setup de torneo — panel de configuración centralizado `💡 CRUDA`

**Score owner**: 4/5 · Esfuerzo alto — requiere migración + cambios en muchos módulos

Varios parámetros hardcodeados (formato sets, puntos por partido, nombres grupos). Panel en admin.html para controlarlos.

---

#### [MEJORA] Admin copas — estado "Finalizado" con podio de campeones `🔍 EN ANÁLISIS`

**Score owner**: 3/5 · Requiere diseño de pantalla nueva

Paso 5 "Finalizado" en breadcrumb + podio por copa. Interacción con mensaje de cierre del jugador.

---

#### [MEJORA] Admin copas — UX wizard Etapas 2-4 `💡 CRUDA`

**Score owner**: 3/5 · Etapa 2: filtrado presets por compatibilidad. Etapa 3: descripción textual de presets + migrar hardcodeados a BD. Etapa 4: representación visual de brackets.

---

---

#### Análisis de tabla con IA `💡 CRUDA`

**Score owner**: 3/5 · Botón "¿Cómo estoy?" con llamada a Claude API.

---

#### [MEJORA] Admin copas — opción de 3er y 4to puesto en el wizard `💡 CRUDA`

**Score owner**: 2/5 · Requiere migración SQL.

---

#### [BUG] Múltiples sets — carga.html no muestra ni preserva todos los sets `🔍 EN ANÁLISIS — DIFERIDO`

**Score owner**: N/A (no hay torneos a 3 sets planeados) · Cuando se implemente, será la solución completa (carga.html con soporte multi-set).

**Root cause documentado**: carga.html fuerza `num_sets: 1` y nullea sets 2/3 al guardar. RPCs de copa no setean `num_sets` al crear partidos.
**Spec técnica**: [spec-fix-copa-bugs-rpc-unificado.md](spec-fix-copa-bugs-rpc-unificado.md) (sección Bug 3)

---

#### Múltiples torneos `🔍 EN ANÁLISIS`

**Score owner**: N/A · Feature más grande del backlog. **Diseño**: [memoria: multi-torneo diseño](../../.claude/projects/c--torneo-padel/memory/project_multi_torneo_design.md)

Decisiones de diseño tomadas (2026-03-24):
- **Flujo principal**: link del organizador (ej: `torneo-padel.app/verano26`). El jugador nunca "elige" torneo — entra por el link que le pasaron.
- **Fallback**: detección por nombre cross-torneo. La validación de compañero (existente) sirve como disambiguación implícita sin revelar nombres de torneos.
- **Solución robusta**: con auth progresiva, "primero decime quién sos" → la app ya sabe en qué torneos participás.
- **NO hacer**: selector/dropdown de torneos (va contra la filosofía de la app, problemas de privacidad).
- Depende de: TORNEO_ID dinámico (eliminar hardcoded). No depende necesariamente de gestión de usuarios (el link resuelve la mayoría de casos).

---

#### Gestión de usuarios individuales `🔍 EN ANÁLISIS`

Registro progresivo de jugadores: el flujo actual (sin login) se mantiene, con opción de registrarse después de identificarse. Base para histórico, stats cross-torneo, y detección automática de torneo. Depende de RLS (ya implementado). **Estrategia**: [memoria: estrategia 2026](../../.claude/projects/c--torneo-padel/memory/project_strategy_2026.md)

---

#### Sorteo de parejas `💡 CRUDA`

Armador de parejas + reveal animado + ajuste manual. Depende de Gestión de usuarios individuales.

---

#### Histórico individual de partidos `💡 CRUDA`

Historial de partidos por jugador. Depende de Múltiples torneos + Gestión de usuarios.

---

#### Round Robin en copas `💡 CRUDA`

**Score owner**: 1/5 · Formato Round Robin en wizard de copas. Requiere extender motor RPC.

---

#### [MEJORA] Navegación para ayudante/organizador `📋 PRIORIZADA`

**Score owner**: 4/5 · **Spec**: ❌ falta · **Estrategia**: [memoria: navegación ayudante](../../.claude/projects/c--torneo-padel/memory/project_helper_nav.md)

El ayudante tiene que tipear URLs a mano para llegar a fixture/carga/presente. Solución v1: gesto secreto (tap múltiple en algún elemento) → pide PIN → habilita menú de navegación con links a fixture/carga/presente. Evolución futura: reemplazar PIN por Google OAuth cuando se implemente auth de roles.

**Archivos clave**: `index.html`, `src/personal.js`

---

#### Jerarquía de roles (diseño conceptual) `🔍 EN ANÁLISIS`

**Score owner**: N/A · **Estrategia**: [memoria: estrategia 2026](../../.claude/projects/c--torneo-padel/memory/project_strategy_2026.md)

El "Admin" actual son en realidad dos roles futuros: System Admin (gestiona la plataforma) y Organizador (gestiona UN torneo). Formalizar la jerarquía: System Admin → Organizador → Ayudante → Jugador. No renombrar en UI hasta implementar multi-organizador.

---

#### Monetización — freemium para organizadores `💡 CRUDA`

**Score owner**: N/A · **Estrategia**: [memoria: estrategia 2026](../../.claude/projects/c--torneo-padel/memory/project_strategy_2026.md)

Modelo freemium orientado al organizador (no al jugador). No monetizar hasta tener 2-3 organizadores activos. 3 clientes potenciales identificados (profe de pádel, secretario del club, amigo con viajes).

---

#### [MEJORA] Barra de navegación admin unificada `💡 CRUDA`

**Score owner**: 1/5 · Unificar barras admin en FAB o menú minimalista.

---

#### [MEJORA] Copas con cantidad de equipos no potencia de 2 (byes) `💡 CRUDA`

**Score owner**: pendiente · **Spec**: ❌ falta

Hoy las copas solo soportan 2, 4 u 8 equipos (potencia de 2). Para copas con 3, 5, 6, 7 equipos, los mejor clasificados podrían saltearse la primera ronda (bye). Formato nuevo de copa, junto con Round Robin.

---

#### [MEJORA] Admin Setup — UX del flujo de importación `💡 CRUDA`

**Score owner**: 1/5 · Botón Importar siempre habilitado, logs desaparecen al refresh.

---

## Historial — Implementado / Validado

### [BUG] general.html — 4 fixes post-unificación `✅ IMPLEMENTADA`

**Fecha**: 2026-03-25

1. **Icono subrayado en botón nav**: `a.btn-action-primary` no tenía `text-decoration: none` — los íconos del botón "Ver Mis Partidos" aparecían subrayados
2. **Empate amarillo con PJ=0**: `detectarEmpatesReales` marcaba todos los equipos como empatados cuando nadie había jugado. Fix: skip si todos PJ=0
3. **Header tabla = color derrota**: `thead` de `.tabla-grupo` tenía background demasiado sutil (`0.04` opacity) similar al rosa de mi-derrota. Subido a `0.07` para diferenciar
4. **Parpadeo polling**: `renderGrupos` reconstruía el wrapper completo en cada refresh, causando flash. Fix: si `.modal-grupos-wrapper` ya existe, solo actualizar contenido interno

---

### [MEJORA] Unificar general.html con el modal de consulta `✅ IMPLEMENTADA`

**Fecha**: 2026-03-25 · **Spec**: [spec-unificar-general-modal.md](spec-unificar-general-modal.md)

Modal full-screen eliminado de index.html. `general.html` reemplaza al modal — ahora es la página de consulta con tabs Grupos/Copas/Fixture. El botón "Tablas / Grupos" en index.html navega a `/general.html` (link real, no evento). El botón Back del browser funciona nativamente. Se creó `src/viewer/renderConsulta.js` con las funciones de render puras (extraídas de `modalConsulta.js`). `src/general.js` reescrito en ~80 líneas. `modalConsulta.js` eliminado. Subsume el ítem "Modal index — interceptar botón Back".

---

### [BUG] index.html — tab General / modal muestra "Cargando" tras polling `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19 · `invalidarCache()` reseteaba `modalState.activeSubTab` y nukeaba `modalState.cache` durante el polling de 30s, causando que tabs del modal mostraran "Cargando..." al cambiar de grupo/pestaña. Fix: preservar `activeSubTab` (es UI state, no cache), y si modal está abierto, recargar datos + re-renderizar automáticamente sin perder el tab activo.

---

### [MEJORA] Admin copas — botón confirmar resultado en bracket `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19 (v1.3.5) · Cuando un jugador carga resultado de copa desde index.html (estado `a_confirmar`), el admin ahora puede confirmar directamente desde el bracket en admin → Copas, sin necesidad de ir a carga.html. Botón "Confirmar resultado" en `statusView.js` → `_renderBracketMatch` + handler en `_wireStatusEvents`.

---

### [MEJORA] Secciones disputas/confirmaciones inline en home jugador `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19 (v1.3.6 → v1.3.7) · Disputas y confirmaciones pendientes ahora aparecen inline arriba de los partidos pendientes, siempre visibles (sin toggle ni botón cerrar). Disputas primero, confirmaciones después. Eliminado patrón toggle/expand anterior.

---

### [MEJORA] Unificar visualización admin↔jugador (Epic completo A/B/C/D) `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19–2026-03-20 (v1.4.4–v1.4.8) · **Spec**: [spec-unificar-visualizacion-admin-jugador.md](spec-unificar-visualizacion-admin-jugador.md)

- **Sub-ítems A+B** (v1.4.4–v1.4.6): Tabla de posiciones del jugador unificada con la del admin: columnas PJ, GF, GC, DG, Pts (+ SF, SC, DS si formato>1). Badge 🎲 de sorteo con leyenda. Tabla General con mismas columnas + columna Gr.
- **Sub-ítem C** (v1.4.7): Bracket gráfico con llaves SVG en tab Copas del jugador (reemplaza lista plana). Renderer extraído a `src/utils/bracketRenderer.js` como módulo compartido. Admin pasa `showConfirmButton`, jugador pasa `highlightParejaId`.
- **Sub-ítem D** (v1.4.8): Badge H2H azul cuando exactamente 2 equipos empatan en todas las stats y H2H resuelve. `detectarH2H()` en `tablaPosiciones.js`. Aplica en admin + jugador con leyenda.

---

### [MEJORA] Configuración de formato de sets por torneo (1 set vs 3 sets) `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19 · Nuevo campo `formato_sets` en `torneos` (1 o 3). Selector en Admin → Setup. Player modal y carga.html adaptan inputs según formato. Eliminado modo indefinido (botón "Agregar Set 2"). · **Spec**: [spec-formato-sets-por-torneo.md](spec-formato-sets-por-torneo.md)

---

### [BUG] Sorteo — UI permite reubicar equipos que no estuvieron en empate `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19 · Resuelto en refactor sorteo completo (v1.3.0). Flechas ▲▼ solo aparecen para equipos del cluster de empate. Movimiento restringido al cluster via `isSameCluster()`.

---

### [MEJORA] Copas — warning de empate desaparece si el sorteo ya fue realizado `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19 · `detectarEmpates` sección B chequea `sorteo_inter` para empates inter-grupo; sección C chequea `sorteo_orden` para empates intra-grupo. Filtro de quiebre (`_posicionesQuiebre`) elimina warnings irrelevantes.

---

### [MEJORA] Grupos — superíndice de sorteo solo para equipos del grupo de empate `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19 · Sorteo solo graba equipos del cluster de empate. Superíndice 🎲 solo aparece en equipos con `orden_sorteo` + leyenda "🎲 = Posición definida por sorteo".

---

### [MEJORA] Admin copas — gestión sin esperar doble confirmación `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19 · Subsumida en Copa Approval v2 ([spec-copa-approval-v2.md](spec-copa-approval-v2.md)). Cubierta por el rediseño completo del flujo de aprobación.

---

### [MEJORA] Tabla de posiciones — empates y criterios de desempate `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19 · Subsumida en Copa Approval v2. Sorteo como mecanismo de desempate + DG en tabla + alertas de empates sin resolver.

---

### Copa Approval v2 — E5 Cleanup + Refactor Sorteo + Mejoras UI `✅ IMPLEMENTADA`

**Fecha**: 2026-03-19

**Refactor Sorteo Completo** (v1.3.0):
- RPC `obtener_standings_torneo` simplificado: ya no calcula `posicion_en_grupo`, devuelve stats crudas
- `enriquecerConPosiciones`: calcula posiciones client-side con H2H + dominator chain (single source of truth)
- Sorteo por cluster: solo graba equipos empatados, no todo el grupo
- Nuevo sorteo inter-grupo en card "Tabla General" del Tab Grupos
- `cmpStandings` usa `posicion_en_grupo` como criterio principal (no como desempate)

**Mejoras UI** (v1.3.1–v1.3.3):
- Superíndices con 🎲 emoji + leyenda "Posición definida por sorteo"
- Tabla general: solo superíndice inter-grupo (eliminado intra-grupo redundante)
- Superíndices aparecen inmediatamente después de guardar (sin refresh manual)
- Columnas SF, SC, DS en tablas intra-grupo; GC, DG en tablas generales
- Flash azul al mover equipos con flechas ▲▼
- Reminder violeta en Tab Copas cuando hay sorteos guardados

**E5 Cleanup** (v1.3.4):
- Eliminado `bracketLogic.js` (4 funciones muertas, 0 imports)
- Eliminado `src/admin/utils.js` (sin imports)
- Eliminado `dispararMotorCopas` + 3 call sites (v1, escribía a `propuestas_copa` que v2 no lee)
- Eliminado fire-and-forget `verificar_y_proponer_copas` en `planEditor.js`

---

### Copa Approval v2 — Etapa 4a: StatusView nueva pipeline + Aprobar copa `✅ IMPLEMENTADA`

**Fecha**: 2026-03-11 · **Spec técnica**: [etapa4a-statusview-pipeline.md](etapa4a-statusview-pipeline.md)

Reemplaza la pipeline basada en `propuestas_copa` por una pipeline client-side donde los cruces se derivan de standings:
- **`src/viewer/cargarResultado.js`**: eliminados 2 bloques fire-and-forget `verificar_y_proponer_copas`
- **`src/admin/copas/planService.js`**: `esPlanBloqueado` ahora chequea partidos creados (no propuestas); eliminadas 7 funciones deprecadas (`cargarPropuestas`, `invocarMotorPropuestas`, `aprobarPropuestas`, `aprobarPropuestaIndividual`, `modificarPropuesta`, `calcularClasificadosConWarnings`, `calcularCrucesConWarnings`); agregada `crearPartidosCopa` (llama al RPC `crear_partidos_copa` de E1)
- **`src/admin/copas/index.js`**: orquestador v2 sin propuestas; `determinarPaso` recibe `(esquemas, copas, standingsData)`; si hay esquemas → siempre `renderStatusView`
- **`src/admin/copas/statusView.js`**: reescritura completa — pipeline standings→pool→matchups→render; 4 estados (en curso / esperando / por aprobar / warnings); botón "✅ Aprobar copa" crea partidos en un click; reset mejorado con 2 opciones (solo resultados / todo)

---

### Copa Approval v2 — Etapa 3: Sorteo Service + UI `✅ IMPLEMENTADA`

**Fecha**: 2026-03-11 · **Spec técnica**: [etapa3-sorteo-service-ui.md](etapa3-sorteo-service-ui.md)

**Bugfix post-implementación** (2026-03-11): `detectarEmpatesReales` y `ordenarConOverrides` no detectaban empates triples circulares (A>B, B>C, C>A). Fix: reemplazar chequeo "tiene H2H → no es empate" por algoritmo dominator chain ("gana a TODOS los no-rankeados → se puede rankear; el resto forma el empate circular").

7 archivos modificados/creados:
- **Nuevo `src/admin/copas/copaDecisionService.js`**: CRUD tabla `sorteos` (4 funciones: `cargarSorteos`, `guardarSorteoIntraGrupo`, `guardarSorteoInterGrupo`, `resetSorteo`)
- **`src/utils/tablaPosiciones.js`**: `cargarOverrides` lee de `sorteos` en vez de `posiciones_manual`
- **`src/admin/groups/service.js`**: 3 cambios — `cargarGrupoCierre`, `guardarOrdenGrupo` y `resetOrdenGrupo` usan tabla `sorteos`
- **`src/carga/posiciones.js`**: `cargarOverridesPosiciones` lee de `sorteos`
- **`src/admin.js`**: reset también limpia tabla `sorteos` (además de `posiciones_manual`)
- **`src/admin/parejas/parejasImport.js`**: import también borra tabla `sorteos`
- **`src/admin/groups/ui.js`**: badges y botones con terminología "sorteo"; mensaje guía al detectar empates

---

### Copa Approval v2 — Etapa 2: Motor matchups JS `✅ IMPLEMENTADA`

**Fecha**: 2026-03-10 · **Spec técnica**: [etapa2-motor-matchups.md](etapa2-motor-matchups.md)

Módulo puro `src/utils/copaMatchups.js` con 5 funciones exportadas:
- **`cmpStandings`**: comparador cross-grupo (puntos → ds → dg → gf → sorteo_orden → nombre)
- **`armarPoolParaCopa`**: construye pool de clasificados respetando reglas (global o por posición), excluye equipos ya usados
- **`seedingMejorPeor`**: seeding Mejor-Peor para 2/3/4/8 equipos con detección de endógenos
- **`optimizarEndogenos`**: swap secuencial para evitar cruces intra-grupo (con inmutabilidad y protección de equipos ya swappeados)
- **`detectarEmpates`**: detecta empates frontera, inter-grupo e intra-grupo como warnings informativos

3 cambios en `planService.js`: `_cmpDesc` y `_empate` incluyen `dg`; key de empates 3+ incluye `dg`.

---

### Copa Approval v2 — Etapa 1: SQL Foundation `✅ IMPLEMENTADA`

**Fecha**: 2026-03-10 · **Spec técnica**: [etapa1-sql-foundation.md](etapa1-sql-foundation.md)

3 cambios SQL aplicados en Supabase:
- **Tabla `sorteos`**: almacena resultados de sorteos para desempate (intra_grupo e inter_grupo) con RLS policies completo
- **Fix `obtener_standings_torneo`**: retorna `gc` (games contra), `dg` (diferencia de games) y `sorteo_orden`; ORDER BY del ranking incluye DG y sorteo
- **Nueva RPC `crear_partidos_copa`**: crea copa + partidos desde JSONB de cruces (reemplazará `aprobar_propuestas_copa` en v2)

Migración: `supabase/migrations/20260310000000_copa_approval_v2_foundation.sql`

---

### Admin copas — Aprobación con visibilidad y control de cruces `✅ IMPLEMENTADA`

**Fecha**: 2026-03-09 · **Spec funcional**: [spec-copa-aprobacion-cruces.md](spec-copa-aprobacion-cruces.md) · **Spec técnica**: [spec-copa-aprobacion-cruces-tecnico.md](spec-copa-aprobacion-cruces-tecnico.md)

Rediseño completo del flujo de aprobación de copas en admin.html tab Copas:
- **Visibilidad (D1)**: tabla de clasificados con puntos, DS, grupo; zona gris (empate en frontera); warnings de empates a 3 dentro de un grupo; equipos pendientes con null slots.
- **Control (D2)**: edición libre de cruces con selects; swap de equipos entre matches; warnings de mismo grupo en primera ronda; aprobación individual o masiva.
- **Propuestas progresivas**: `verificar_y_proponer_copas` genera propuestas con NULL slots cuando grupos terminan parcialmente (position-based seeding); sólo global espera todos los grupos.
- **Una sola función de cálculo**: `calcularClasificadosConWarnings` y `calcularCrucesConWarnings` en `planService.js` — sin código duplicado para partial vs complete.
- Resuelve: tabla general visible antes de aprobar (modo global), seeding anti-mismo-grupo (warnings), swap ⇄ entre matches distintos.

---

### [BUG] Tab Copas — estado inconsistente al importar nuevas parejas `✅ IMPLEMENTADA`

**Fecha**: 2026-03-09 · **Spec**: [spec-bugs-copa-estado-inconsistente.md](spec-bugs-copa-estado-inconsistente.md)

Los tres cambios de código ya estaban implementados en iteraciones anteriores; verificación confirmó que la migración `20260302000000_fix_reset_copas_esquemas` también está aplicada en producción.
- `parejasImport.js` `borrarTodoTorneo()`: borra `esquemas_copa` (CASCADE elimina `propuestas_copa`)
- `planEditor.js`: bloque `bloqueado` incluye botón Reset funcional que llama `resetCopas`
- `index.js`: detecta propuestas aprobadas huérfanas y ajusta `infoPaso2` con mensaje claro

---

### BUG score invertido — sistema-wide (Por confirmar + En revisión + Partidos jugados) `✅ IMPLEMENTADA`

**Fecha**: 2026-03-09 · **Spec**: [spec-bug-score-por-confirmar-invertido.md](spec-bug-score-por-confirmar-invertido.md)

- `invertirScoresPartido(partido)` agregada a `src/utils/formatoResultado.js` — swapea `set1..3_a↔b`, `sets_a↔b`, `games_totales_a↔b` retornando copia sin mutar el original.
- `renderPartidosConfirmar`: score orientado al jugador (soyA ? p : invertirScoresPartido(p)).
- `renderPartidosRevision`: ambos scores (original y temporal) orientados al jugador.
- `renderPartidosConfirmados` ("Partidos jugados"): score orientado; clases CSS `ganador`/`perdedor` con colores `#16A34A`/`#DC2626` alineados con tabla de posiciones.
- `orientarPartido` en `modalConsulta.js` simplificado para importar `invertirScoresPartido` como fuente única.

---

### Admin copas — UX wizard plantillas Etapa 1 `✅ IMPLEMENTADA`

**Fecha**: 2026-03-09 · **Spec**: [spec-admin-copas-wizard-ux-etapa1.md](spec-admin-copas-wizard-ux-etapa1.md) · **Versión**: v1.1.0 → v1.1.3

- Panel 1 reescrito como acordeón: cada plantilla se expande inline con diagrama de bracket + botones Aplicar/Borrar. Múltiples ítems abiertos simultáneamente.
- `renderBracketDiagram(copa, numGrupos)` — componente compartido (sin duplicación) en Panel 1 y `renderPlanActivo`.
- `renderPlanActivo` — Estado 2 prominente: plan vigente con diagramas completos + botón Reset visible.
- Botón Cancelar en paneles 2 y 3 del wizard.
- Formato del torneo visible: "N grupos × M equipos" (con rango "min-max" si grupos desiguales).
- Migración `20260309000000_drop_es_default_presets_copa.sql`: columna `es_default` eliminada de `presets_copa`.
- `presets.js` estático eliminado; `detectarYSugerirPreset` migrada a `planService.js` con soporte `minParejasPorGrupo`.
- Post-deploy fixes: toast al borrar plantilla, filtrado correcto con grupos desiguales, posiciones usadas deshabilitadas en dropdown global con "(usado)", validación de overlap al avanzar, info box "Posiciones ocupadas" eliminada, propagación de `modo` y rango automático a la siguiente copa.

---

### Bugs copa (final + modo global) + RPC unificado `✅ IMPLEMENTADA`

**Fecha**: 2026-03-03
**Spec**: [spec-fix-copa-bugs-rpc-unificado.md](spec-fix-copa-bugs-rpc-unificado.md)

- **Bug 1 — Final no se genera**: `cargarResultado.js` nunca llamaba al RPC de generación de finales. Resuelto con nuevo RPC genérico `avanzar_ronda_copa` que reemplaza a `generar_finales_copa`. Fire-and-forget agregado en `cargarResultado.js` (2 lugares) y `carga/copas.js`. Fix adicional: `guardarResultadoComoSet` en `carga/copas.js` no seteaba `estado='confirmado'` — `avanzar_ronda_copa` requiere ese estado para procesar el partido.
- **Bug 2 — Modo global genera 1 cruce**: `verificar_y_proponer_copas` no tenía rama para `{modo:'global'}`. Agregada rama que consulta `obtener_standings_torneo` con LIMIT/OFFSET. Además, fix de **race condition**: carga.html dispara el RPC partido por partido — cuando un grupo terminaba antes que otro, generaba bracket parcial. Fix: esquemas con `modo:'global'` ahora requieren que TODOS los grupos estén completos.
- **Mejora incluida**: Soporte para brackets de 8 equipos (QF) gratis en el RPC.
- **Migraciones**: `20260303000000_fix_copa_avanzar_ronda.sql` (consolidada con fix race condition)

---

### Admin copas — scores en games + labels ronda `✅ IMPLEMENTADA`

**Fecha**: 2026-03-02

Fix de scores en statusView (mostraba sets ganados "1-0" en vez de games "6-4, 3-6"). Centralización de labels de ronda en `src/utils/copaRondas.js`.

---

### Bugs wizard copas (admin) — 3 bugs resueltos `✅ IMPLEMENTADA`

**Fecha**: 2026-03-01
**Spec**: [docs/spec-bugs-wizard-copas-admin.md](spec-bugs-wizard-copas-admin.md)

- Bug 1 — Esquema custom no persiste: validación de reglas vacías antes de insertar.
- Bug 2 — "Editar" no navega el wizard: tercer parámetro `esquemaExistente` en `renderPlanEditor()`.
- Bug 3 — Botones de reset redistribuidos por tab (Grupos/Copas/Setup).

---

### Admin copas — indicador de progreso del flujo `✅ IMPLEMENTADA`

**Fecha**: 2026-03-01
**Spec**: [docs/spec-admin-copas-indicador-flujo.md](spec-admin-copas-indicador-flujo.md)

Breadcrumb de 4 pasos (Definir plan → Esperar grupos → Aprobar → En curso).

---

### Copa en vistas públicas — integración completa `✅ IMPLEMENTADA`

**Fecha**: 2026-03-01
**Spec**: [docs/spec-bugs-copa-vistas-publicas.md](spec-bugs-copa-vistas-publicas.md)

fixture.html cola unificada + index.html modal con tabs Grupos/Copas/Fixture + sub-tab General.

---

### Wizard de Copas + Presets en BD `✅ IMPLEMENTADA`

**Implementado**: 2026-02-28

Wizard de 4 paneles + presets en tabla `presets_copa` + motor `modo:'global'`.
**Migración**: `20260227000000_add_presets_copa.sql`

---

### Re-ingeniería sistema de copas `✅ IMPLEMENTADA`

**Implementado**: 2026-02-25

Modelo plan→propuesta→aprobación. Módulos: presets.js, planService.js, planEditor.js, statusView.js, bracketLogic.js.
**Migración**: `20260225000000_add_esquemas_copa.sql`
**Plan**: [docs/plan-reingenieria-copas.md](plan-reingenieria-copas.md)

---

### Seguridad — BD (Row Level Security) `✅ IMPLEMENTADA`

**Implementado**: 2026-02-24

RLS policies + función `is_admin()`. Páginas públicas: fixture, carga, presente.
**Migración**: `20260224000000_fix_rls_policies.sql`

---

### Versionado semántico `✅ IMPLEMENTADA`

**Fecha**: 2026-03-06

`v1.0.0` arranca. Versión en `package.json` (única fuente de verdad), expuesta en build via `__APP_VERSION__` (Vite `define`). Visible en topnav (derecha) en carga/fixture/admin, y como badge fijo bottom-right en index.html. Nuevo archivo: `src/utils/version.js` con `injectVersion()`.

---

### Carga.html — modo "A confirmar" `✅ IMPLEMENTADA`

**Fecha**: 2026-03-06 · **Spec**: [spec-carga-partidos-a-confirmar.md](spec-carga-partidos-a-confirmar.md)

- **4to botón "Confirmar"** en la barra de modos (entre Pendientes y Jugados). Badges con counter `(N)` en "Confirmar" y "Disputas" vía `actualizarCounters()` con Promise.all.
- **Query unificada**: todos los modos (incluido confirmar) traen grupos y copas juntos — sin filtro por `copa_id`. `cargarCopas` es no-op; `carga.html` eliminó el `<h2>Copas</h2>` huérfano.
- **Card de solo lectura**: ganador siempre arriba con `is-winner`, "Cargado por: [pareja]", botones Confirmar y Editar.
- **Confirmar**: optimistic UI (card desaparece al instante, rollback si falla).
- **Editar**: reutiliza `crearCardEditable` con mensaje en vivo "🏆 Ganó [pareja]" que se actualiza al cambiar los inputs.
- **Fire-and-forget** `avanzar_ronda_copa` para partidos de copa al confirmar.

---

### Modal — mi pareja siempre primero en partidos `✅ IMPLEMENTADA`

**Fecha**: 2026-03-06 · **Spec**: [spec-modal-jugador-primero.md](spec-modal-jugador-primero.md)

En los 3 tabs del modal (Grupos, Copas, Fixture), los partidos donde el jugador participa ahora muestran siempre "Yo vs Rival". Helper `orientarPartido()` centraliza la lógica — cuando se invierte el orden, el score también se invierte para mantener coherencia. Modificado únicamente `src/viewer/modalConsulta.js`.

---

### Polish copa — badge nombre + colores victoria/derrota en vista jugador `✅ IMPLEMENTADA`

**Fecha**: 2026-03-06 · **Spec**: [spec-polish-copa-vista-jugador.md](spec-polish-copa-vista-jugador.md)

- **Ítem 1 — Badge copa en cards**: join `copa:copas(id,nombre)` en la query de partidos. Cards pendientes y historial ahora muestran "🏆 Copa Oro — Semi" en vez de solo "Semi". Afecta `renderPartidosPendientesHome` (cards pendientes) y `renderPartidosConfirmados` (historial).
- **Ítem 2 — Colores victoria/derrota en modal**: partidos jugados por mi pareja en el modal de consulta ahora muestran fondo verde suave + borde verde (victoria) o rojo suave + borde rojo (derrota). Usa `determinarGanadorParaPareja` existente. Aplica en tabs Grupos y Copas del modal.

---

### Presentismo — mejoras UX `✅ IMPLEMENTADA`

**Implementado**: 2026-03-06 · **Spec**: [spec-presentismo-mejoras-ux.md](spec-presentismo-mejoras-ux.md)

6 mejoras en `presente.html` (3 de la spec + 3 adicionales del owner):
1. **Semántica del toggle**: OFF = "Todos presentes ✅" (antes decía "Desactivado ❌"). El comportamiento ya estaba correcto en el código — solo se actualizó el texto.
2. **Acciones masivas al final**: botones "Marcar TODOS" / "Limpiar TODOS" movidos debajo de la lista de parejas.
3. **Drill-down en resumen**: los cards "Completas / Incompletas / Ausentes" son ahora botones que expanden una lista inline con las parejas en ese estado y toggles individuales funcionales.
4. **Sincronización filtros**: al tocar un card del resumen, se activa automáticamente el filtro correspondiente en "Control por Pareja" con scroll suave.
5. **Layout compacto en Jugadores Ausentes**: pareja + grupo en una sola línea, botón ✅ (44×44px) anclado a la derecha. Optimistic UI: la card desaparece al instante con rollback si falla.
6. **Reordenamiento de secciones**: "Control por Pareja" sube antes de "Operaciones por Grupo".

---

### Autenticación Admin — Google OAuth `✅ IMPLEMENTADA`

**Implementado**: 2026-02-19

Login con Google OAuth para admin.html.

---

### Presentismo individual `✅ IMPLEMENTADA`

**Implementado**: 2026-01-30

Campo `presentes TEXT[]` + toggle `presentismo_activo`.
**Migración**: `20260130010000_add_presentes_to_parejas.sql`

---

### Modelo de sets `✅ IMPLEMENTADA`

**Implementado**: 2026-01-30

Refactor del modelo de juego a sets.
**Migración**: `20260130000000_refactor_games_to_sets_model.sql`

---

## Descartado

*(Vacío por ahora — cuando se descarte algo, registrar motivo para no volver a discutirlo)*

---

## Bloque para IA

> Copiar esto al inicio de cada nuevo chat con Claude Code, Cursor u otra IA.

```
### Contexto del proyecto

- **App**: Gestión de torneos de pádel (Vite + Supabase + JS vanilla)
- **Deploy**: https://torneo-padel-teal.vercel.app/
- **Arquitectura técnica**: leer `CLAUDE.md` antes de cualquier decisión técnica
- **Fuente única de ideas y evolución**: `docs/brainstorming-proximas-mejoras.md`

### Estados del backlog

💡 CRUDA → 🔍 EN ANÁLISIS → 📋 PRIORIZADA → 🚧 EN DESARROLLO → ✅ IMPLEMENTADA → 🏆 VALIDADA
(o 🚫 DESCARTADA con motivo registrado)

### Reglas para este chat

1. Si surge una idea nueva → agregarla al backlog en estado 💡 CRUDA
2. Si completamos algo → actualizar estado en el documento y mover a Historial
3. No reimplementar lo que ya está en "Historial — Implementado"
4. No tomar decisiones de arquitectura sin leer CLAUDE.md primero
5. Datos personales sensibles (DNI, etc.) → no implementar sin RLS activo primero
```
