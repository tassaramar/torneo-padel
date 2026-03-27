# Product Backlog — Torneo de Pádel

> **Fuente única de verdad** para ideas, requerimientos y evolución del producto.
> Detalles técnicos de arquitectura → ver `CLAUDE.md`

**Última actualización**: 2026-03-27 (MVP 1.0 multi-torneo)

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

---

---

### Bloque B — Claridad y comunicación al jugador

---

---

---

#### [MEJORA] Mensaje de cierre cuando el jugador terminó todos sus partidos `💡 CRUDA`

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

#### Múltiples torneos — MVP 2.0+ `🔍 EN ANÁLISIS`

**Score owner**: N/A · **Diseño**: [memoria: multi-torneo diseño](../../.claude/projects/c--torneo-padel/memory/project_multi_torneo_design.md)

MVP 1.0 implementado (2026-03-27): TORNEO_ID dinámico, estados borrador/activo/finalizado, página torneos.html para gestión de torneos. Solo 1 activo a la vez.

Próximos pasos:
- **MVP 2.0**: Acceso a datos de torneos previos (admin puede ver/gestionar torneos finalizados)
- **MVP 3.0+**: Múltiples torneos activos simultáneos, URLs con slug (`/t/verano26`), detección cross-torneo
- **Diseño UX** (ya decidido): link del organizador como primary, detección por nombre como fallback, NO selector/dropdown
- **Auth progresiva**: cuando el jugador tiene cuenta, la app ya sabe en qué torneos participás

---

#### Gestión de jugadores individuales `🔍 EN ANÁLISIS`

**Score owner**: N/A · **Estrategia**: [memoria: estrategia 2026](../../.claude/projects/c--torneo-padel/memory/project_strategy_2026.md)

Tabla `jugadores` global, independiente de torneos. Permite historial cross-torneo ("Tincho participó en 5 torneos, ganó 8 de 15 partidos") y soft onboarding progresivo (anónimo → identificado → autenticado).

**Modelo de datos discutido (2026-03-26)**:

- **`jugadores`**: `id`, `apodo` (unique, lo que se usa en la app — "Tincho"), `nombre_completo` (opcional), `google_email` (nullable, para vincular con auth), `telefono` (nullable), `created_at`
- **`inscripciones`**: `id`, `jugador_id`, `torneo_id`, `created_at` — vincula jugador con torneo (reemplaza la relación implícita actual vía parejas)

**Decisiones clave**:
- El jugador es la unidad, no la pareja. La pareja es una relación dentro de un torneo, compuesta por dos jugadores.
- `apodo` es el identificador visible (hoy es el nombre dentro de la pareja, ej: "Tincho" de "Tincho - Sebi"). Debe ser único en la plataforma.
- `google_email` nullable permite auth progresiva: el jugador existe desde que el organizador lo importa, y opcionalmente se vincula con Google después.
- `telefono` para contacto del organizador (no visible a otros jugadores).

**Impacto en el modelo actual**:
- `parejas.nombre` ("Tincho - Sebi") se descompone en dos `jugador_id` references
- `parejas.presentes[]` (array de strings) se reemplaza por relación con `jugadores`
- El flujo de identificación (`src/identificacion/`) pasa de buscar por nombre en parejas a buscar en `jugadores`
- La importación de parejas (`parejasImport.js`) debe crear/vincular jugadores automáticamente

**Flujo de soft onboarding progresivo (discutido 2026-03-26)**:

El objetivo es que el jugador empiece a usar la app sin fricción (como hoy) y vaya ganando capacidades a medida que se identifica más:

| Nivel | Cómo llega | Qué puede hacer | Datos que tenemos |
|-------|-----------|-----------------|-------------------|
| 0. Anónimo | Entra por link del torneo | Ver fixture, tablas, resultados públicos | Nada |
| 1. Identificado (hoy) | Escribe su nombre + valida compañero | Cargar resultados, ver sus partidos, presentismo | `apodo` en localStorage |
| 2. Registrado | Después de identificarse, la app sugiere "guardá tu perfil" | Todo lo anterior + historial cross-torneo, detección automática de torneo | `apodo`, `telefono`, fila en `jugadores` |
| 3. Autenticado | Vincula Google (opcional) | Todo lo anterior + rol de ayudante/organizador sin PIN, acceso a analytics propios | `google_email` en `jugadores` |

**Principios**:
- Cada nivel es **opt-in** y **no-bloqueante**: nunca se fuerza al jugador a registrarse para hacer algo que hoy puede hacer sin login
- La transición entre niveles es **suave**: la app ofrece el siguiente paso cuando tiene sentido (ej: "¿Querés que te reconozca automáticamente la próxima vez?"), no con un muro de registro
- El organizador puede pre-crear jugadores (nivel 2) desde la importación de parejas, sin que el jugador haga nada
- La vinculación con Google (nivel 3) es el puente hacia roles formales, reemplazando el PIN de ayudante por permisos reales

**Habilita**: histórico individual, sorteo de parejas, stats cross-torneo, detección automática de torneo, roles por jugador (ayudante sin PIN)

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

### [FEATURE] MVP 1.0 Multi-torneo `✅ IMPLEMENTADA`

**Fecha**: 2026-03-27 · TORNEO_ID dinámico (eliminado hardcoded de 8 archivos). Estados de torneo: borrador/activo/finalizado con transiciones libres. Constraint BD: max 1 activo. Nueva página `torneos.html` ("Administración del sistema") con CRUD de torneos, protegida por OAuth. Campos nuevos en `torneos`: estado, slug, fecha, duracion, ubicacion_nombre, ubicacion_coords. RPC `obtener_torneo_activo()`. Módulo centralizado `src/utils/torneoActivo.js` con cache en memoria. Pantalla "No hay torneo en curso" en todas las páginas del jugador. Plan: `.claude/plans/humble-foraging-peacock.md`.

---

### [MEJORA] Rediseño visual home jugador `✅ IMPLEMENTADA`

**Fecha**: 2026-03-27 · Fondos de color en secciones disputa (rojo suave) y confirmación (amarillo suave) con borde izquierdo. Primer partido pendiente destacado como card grande "Tu próximo partido" con borde verde; resto como filas compactas bajo "Los que vienen después". Botón de consulta renombrado a "Ver posiciones y cruces". Spec: `docs/spec-redesign-home-jugador.md`. Ajustes posteriores: cards con fondo `#F9FAFB` y borde en filas del resto; eliminado badge de posición redundante en la card principal (solo queda texto debajo del rival).

---

### [MEJORA] fixture.html — ocultar secciones de grupos en fase de copas `✅ IMPLEMENTADA`

**Fecha**: 2026-03-26 · Subsumida en la migración de general.html: el tab por defecto ahora se selecciona inteligentemente según el estado del torneo (si hay copas activas y el jugador terminó sus partidos de grupo → muestra tab Copas).

---

### [MEJORA] Admin copas — resaltar al ganador en los partidos `✅ IMPLEMENTADA`

**Fecha**: 2026-03-26 · Ya implementado en iteraciones anteriores.

---

### [MEJORA] Renombrar título "Consultar" en general.html `✅ IMPLEMENTADA`

**Fecha**: 2026-03-27 · Subsumida en la migración a general.html. El título pasó a ser descriptivo del contenido de la página.

---

### [BUG] Scroll bump al tener partidos a confirmar `✅ IMPLEMENTADA`

**Fecha**: 2026-03-26

Resuelto previamente. El scroll ya no salta al partido a confirmar al navegar hacia abajo.

---

### [MEJORA] Partidos jugados — cards con color ganado/perdido `✅ IMPLEMENTADA`

**Fecha**: 2026-03-26

Fondo verde suave + borde izquierdo verde para partidos ganados, rojo suave + borde rojo para perdidos. Usa las clases `ganador-yo` / `ganador-rival` que ya emitía el HTML.

---

### [FEATURE] Acceso ayudante con gesto secreto + PIN `✅ IMPLEMENTADA`

**Fecha**: 2026-03-26

Desde index.html, tocando 7 veces el número de versión se activa un prompt de PIN. Si el PIN coincide con el configurado por el admin en Setup, se muestra una barra flotante con links a Fixture, Cargar y Presentismo. El estado se persiste en localStorage. El admin configura el PIN desde admin.html > Setup > "PIN de ayudantes". Migración: `20260326000000_add_pin_ayudante.sql`.

---

### [MEJORA] Tab por defecto inteligente en general.html `✅ IMPLEMENTADA`

**Fecha**: 2026-03-26

Si el jugador identificado no tiene partidos de grupo pendientes, general.html abre en tab Copas (si hay) o Fixture en lugar de Grupos. Si no está identificado o tiene pendientes, mantiene Grupos con su grupo como sub-tab.

---

### [MEJORA] Modal grupos — separar partidos jugados de pendientes `✅ IMPLEMENTADA`

**Fecha**: 2026-03-26

En el detalle de grupo, los partidos se separan en dos secciones `<details>`: "Partidos pendientes (N)" (abierto, ordenados por posición global del fixture) y "Partidos jugados (N)" (cerrado, ordenados por ronda). Si una categoría está vacía, no se muestra.

---

### [MEJORA] Bracket copas — propagar ganadores a ronda siguiente `✅ IMPLEMENTADA`

**Fecha**: 2026-03-25 · **Spec**: [spec-bracket-propagacion-ganadores.md](spec-bracket-propagacion-ganadores.md)

Cuando un partido de QF/SF tiene ganador confirmado, el nombre del equipo aparece en el slot correspondiente de la ronda siguiente (en itálica gris, clase `.sb-propagated`). Cambio puramente visual en `bracketRenderer.js` — no modifica BD ni RPCs.

---

### [MEJORA] Feedback al confirmar resultado rival `✅ IMPLEMENTADA`

**Fecha**: 2026-03-25

Agregado `showToast('✅ Resultado confirmado', 'success')` en `confirmarResultado` y `confirmarResultadoConSets` de `personal.js`.

---

### [BUG] index.html — scroll salta arriba en polling refresh `✅ IMPLEMENTADA`

**Fecha**: 2026-03-25

El auto-refresh cada 30s en index.html hacía `innerHTML` completo, reseteando el scroll a 0. Fix: guardar/restaurar `scrollY` en `renderVistaPersonal` cuando el render viene del polling (`preserveScroll=true`).

---

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
