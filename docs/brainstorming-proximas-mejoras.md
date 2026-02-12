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
