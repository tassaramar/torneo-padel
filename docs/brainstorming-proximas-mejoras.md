# 🧩 Roadmap Próximas Mejoras – Torneo Pádel

**Fecha de notas**: 2026-02-12

Este documento captura ideas y preguntas abiertas para futuras mejoras del sistema. No son tareas definidas, sino inputs para brainstorming y diseño.

---

## 1️⃣ Presentismo

### Problema
Hoy el fixture asume que todos están. En la realidad, no.

### Objetivo
Que la asistencia impacte en la lógica de asignación de partidos.

### Preguntas clave

**¿Entidad principal: jugador o pareja?**
- ¿Se gestiona a nivel individual o como unidad?
- ¿Un jugador ausente invalida toda la pareja?

**¿Se puede modificar en vivo?**
- ¿El organizador actualiza durante el torneo?
- ¿Los jugadores auto-reportan llegada?

**¿Qué hace el sistema si alguien falta?**
- Elimina partidos
- Reprograma
- Marca como WO (walk-over)
- Deja decisión manual

### Output esperado
Modelo claro + impacto en generación de partidos.

---

## 2️⃣ Orden Global del Fixture

### Problema estructural
Los partidos están ordenados por grupo, pero el organizador piensa en canchas y tiempos.

### Necesitamos
Un orden absoluto independiente del grupo.

### El sistema debe responder

- Tengo 4 partidos y 3 canchas → **¿quién espera?**
- Se libera una cancha → **¿quién entra?**
- **¿Hay prioridad por ronda?**

**Esto ya no es UI.**
**Es un problema de asignación de recursos.**

### Output esperado
Modelo conceptual de asignación cancha–partido–tiempo.

---

## 3️⃣ Búsqueda

### Dolor real
Encontrar partidos en vivo fue complicado.

### Necesitamos

**Búsqueda global** con:

- **Filtros rápidos**:
  - Jugando ahora
  - Pendientes
  - Por jugador

- **Resolver homónimos**
  - ¿Cómo distinguir jugadores con mismo nombre?

- **Mostrar estado real del partido**
  - No solo "pendiente" genérico
  - Diferenciar: esperando / en juego / cargando resultado / etc.

### Output esperado
Definición clara de qué es "buscar" dentro del sistema.

---

## 4️⃣ Admin / Seguridad – Etapa 0

### Realidad incómoda
La BD hoy está abierta. Funciona porque nadie la está atacando.

### Objetivo
Primer paso hacia usuarios reales.

### Etapa 0 (mínimo viable)

- **Identificación mínima de admin**
  - No necesariamente auth complejo
  - Podría ser token, contraseña simple, magic link

- **Modo admin visible**
  - Interfaz clara de quién está en modo admin

- **Rutas protegidas**
  - `/admin`, `/presente.html`, `/carga.html` requieren auth

- **Empezar a cerrar escrituras públicas en BD**
  - RLS (Row Level Security) en Supabase
  - Políticas básicas: solo admin escribe, todos leen

**Esto es clave antes de que el sistema crezca.**

---

## Notas de Contexto

### Estado actual del presentismo
- ✅ Ya implementado: campo `presentes TEXT[]` en tabla `parejas`
- ✅ Ya implementado: toggle `presentismo_activo` en tabla `torneos`
- ✅ Ya implementado: pantalla admin `presente.html` con gestión completa
- ✅ Ya implementado: integración visual en `fixture.html` (badges ✅/⚠️)
- ⚠️ **Pendiente**: Integración en `index.html` (vista del jugador)
- ⚠️ **No resuelto**: Lógica de qué hacer cuando alguien falta (ver Pregunta #1)

### Estado actual de orden global
- ✅ Ya implementado: numeración global de partidos (#1, #2, #3...)
- ✅ Ya implementado: `calcularColaSugerida()` en `utils/colaFixture.js`
- ⚠️ **No resuelto**: Asignación de canchas (el sistema NO asigna canchas hoy)
- ⚠️ **No resuelto**: Gestión de tiempos y esperas

### Estado actual de búsqueda
- ✅ Ya implementado: búsqueda en fixture (`src/carga/search.js`)
- ✅ Ya implementado: búsqueda por nombre, grupo, ronda
- ✅ Ya implementado: normalización de texto (acentos, mayúsculas)
- ⚠️ **Limitado**: Solo busca en cola de pendientes, no en histórico
- ⚠️ **No resuelto**: Búsqueda global cross-página
- ⚠️ **No resuelto**: Resolución de homónimos

### Estado actual de admin/seguridad
- ❌ **No implementado**: Sistema de autenticación
- ❌ **No implementado**: RLS en Supabase
- ⚠️ **Abierto**: Cualquiera con la URL puede acceder a `/admin`, `/presente.html`, etc.
- ⚠️ **Abierto**: La BD permite escrituras públicas vía anon key

---

## Preguntas Transversales

### Filosofía del Sistema
**"Guiar, No Bloquear"** aplica a todas estas features:
- ¿Presentismo bloquea o solo guía?
- ¿Asignación de canchas es sugerencia o restricción?
- ¿Admin tiene poder absoluto o el sistema tiene reglas estrictas?

### Escalabilidad
- ¿Cuántos jugadores/parejas soportamos?
- ¿Cuántas canchas simultáneas?
- ¿Torneos de múltiples días?

### UX Mobile-First
- Todas estas features deben funcionar 100% en mobile
- Búsqueda: autocomplete touch-friendly
- Admin: gestos para drag-drop de asignación
- Presentismo: toggle rápido sin navegación

---

## Referencias

- [docs/implementacion-presentismo-index-html.md](implementacion-presentismo-index-html.md) - Plan de integración de presentismo en vista jugador
- [docs/fixture-presentismo-visual.md](fixture-presentismo-visual.md) - Diseño visual de badges
- [docs/requerimientos-ux-torneo.md](requerimientos-ux-torneo.md) - Requerimientos funcionales generales
- [readme/roadmap.md](../readme/roadmap.md) - Roadmap principal del proyecto

## 5️⃣ Aplicar Política de Rollback System-Wide

### Contexto
**Fecha de política**: 2026-02-12
**Documento**: [docs/politica-optimistic-ui-rollback.md](politica-optimistic-ui-rollback.md)

Hemos definido una política estándar de Optimistic UI + Rollback que garantiza:
- ⚡ UX instantánea (actualización optimista)
- 🔒 Consistencia garantizada (refresh en error)
- 🛡️ Rollback confiable (revert + refresh)

### Problema
Actualmente solo está implementada en 1 lugar:
- ✅ `src/admin/presentismo/granular.js` - Toggle de jugadores

Hay múltiples lugares en la app donde hacemos mutaciones sin optimistic UI o sin rollback correcto.

### Objetivo
Aplicar la política de rollback de forma consistente en toda la app.

### Lugares identificados donde aplicar

#### 1️⃣ **Carga de resultados** 
**Archivo**: `src/viewer/cargarResultado.js`
- **Acción**: Usuario carga score de partido
- **Optimistic**: Mostrar resultado inmediatamente en vista personal
- **Rollback**: Revert + refresh si falla guardado
- **Prioridad**: Alta (acción crítica, frecuente en torneo)

#### 2️⃣ **Marcar partido "En juego"**
**Archivo**: `src/fixture.js` - función `marcarEnJuego()`
- **Acción**: Admin/organizador marca partido como "en juego"
- **Optimistic**: Mover partido de "Pendientes" a "En juego" visualmente
- **Rollback**: Revert + refresh si falla
- **Prioridad**: Media

#### 3️⃣ **Operaciones masivas de presentismo**
**Archivo**: `src/admin/presentismo/bulk.js`
- **Acción**: "Marcar todos presentes", "Limpiar grupo", etc.
- **Optimistic**: Actualizar contadores y vista progresivamente
- **Rollback**: Si alguna operación falla, refresh completo
- **Prioridad**: Media (operación admin, menos frecuente)

#### 4️⃣ **Edición inline de parejas**
**Archivo**: `src/admin/parejas/parejasEdit.js`
- **Acción**: Editar nombre de pareja inline
- **Optimistic**: Mostrar cambio en lista inmediatamente
- **Rollback**: Revert + refresh si falla guardado
- **Prioridad**: Baja (operación de setup, no durante torneo)

#### 5️⃣ **Confirmación de resultados**
**Archivo**: `src/viewer/cargarResultado.js`
- **Acción**: Jugador confirma resultado cargado por rival
- **Optimistic**: Marcar como confirmado visualmente
- **Rollback**: Revert + refresh si falla
- **Prioridad**: Alta (acción frecuente)

#### 6️⃣ **Resolución de disputas**
**Archivo**: `src/viewer/cargarResultado.js` - función `aceptarOtroResultado()`
- **Acción**: Admin o jugador resuelve disputa
- **Optimistic**: Cambiar estado a "confirmado" visualmente
- **Rollback**: Revert + refresh si falla
- **Prioridad**: Media

### Plan de Implementación

**Fase 1 - Críticas** (durante torneo):
1. Carga de resultados
2. Confirmación de resultados

**Fase 2 - Importantes** (operación del torneo):
3. Marcar partido en juego
4. Resolución de disputas

**Fase 3 - Secundarias** (operación admin):
5. Operaciones masivas presentismo
6. Edición de parejas

### Criterios de Aceptación

Para cada lugar:
- ✅ UI se actualiza inmediatamente (sin await antes del cambio visual)
- ✅ Backend se llama después de actualización optimista
- ✅ En éxito: `await refreshAffectedViews()`
- ✅ En error:
  - Revert del elemento inmediato
  - Log del error
  - `await refreshAffectedViews()` ← **CRÍTICO**

### Esfuerzo Estimado

| Lugar | Complejidad | Tiempo Estimado |
|-------|-------------|-----------------|
| Carga de resultados | Media | 1-2 horas |
| Confirmación | Baja | 30-45 min |
| Marcar en juego | Baja | 30-45 min |
| Resolución disputas | Media | 1 hora |
| Operaciones masivas | Alta | 2-3 horas |
| Edición parejas | Baja | 30-45 min |

**Total estimado**: 6-9 horas de trabajo

### Señales de Éxito

- ❌ **Antes**: Usuario hace click, espera 500ms-2s viendo spinner, luego ve cambio
- ✅ **Después**: Usuario hace click, ve cambio instantáneo, backend sincroniza en background
- 🔒 **Garantía**: Si falla backend, UI se corrige automáticamente (refresh)

---

