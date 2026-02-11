# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

App web para gestión de torneos de pádel con sistema de autogestión para jugadores. Arquitectura multi-HTML SPA usando Vite, Supabase (PostgreSQL) como backend, y JavaScript vanilla modular.

**Deployment**: https://torneo-padel-teal.vercel.app/

**Design Philosophy**: Mobile-first. Todas las features deben diseñarse primero para mobile y luego escalar a desktop.

## Commands

```bash
# Development
npm run dev          # Servidor de desarrollo en http://localhost:5173

# Build
npm run build        # Build para producción en ./dist/

# Preview
npm run preview      # Preview del build de producción
```

## Architecture

### User Roles

El sistema contempla **3 niveles de usuarios**:

1. **Admin**: Acceso completo a gestión del torneo (admin.html)
2. **Ayudante de Admin**: Acceso a funciones de organización (fixture.html, carga.html)
3. **Usuario Final (Jugador)**: Vista personal autogestiva (index.html)

### Multi-HTML Structure

La app tiene **múltiples puntos de entrada HTML** (no un SPA clásico con routing):

- **`index.html`** → Vista principal del jugador ("Home Único")
  - Entry point: `src/personal.js`
  - Muestra: partidos pendientes, presentismo, dashboard, modal de consultas

- **`fixture.html`** → Vista de organizador (cola de partidos)
  - Entry point: `src/fixture.js`
  - Gestiona: partidos en juego, pendientes, ya jugados

- **`admin.html`** → Gestión del torneo
  - Entry point: `src/admin.js`
  - Crea/edita: grupos, parejas, copas

- **`carga.html`** → Carga rápida de resultados
  - Entry point: `src/carga.js`

- **`analytics.html`** → Estadísticas del torneo
  - Entry point: `src/analytics.js`

### Module Organization

```
src/
├── admin/          # Gestión de torneo (grupos, parejas, copas)
├── carga/          # Módulos de carga de resultados
├── viewer/         # Vista del jugador (home único)
│   ├── vistaPersonal.js      # Renderiza home del jugador
│   ├── modalConsulta.js      # Modal full-screen (tablas/grupos/fixture)
│   ├── cargarResultado.js    # Flujo de carga de resultado
│   └── presentismo.js        # Gestión de presentismo individual
├── analytics/      # Estadísticas y rankings
├── identificacion/ # Sistema de identificación de jugadores
├── utils/          # Utilidades compartidas
│   ├── colaFixture.js        # Lógica compartida de fixture (SINGLE SOURCE OF TRUTH)
│   ├── formatoResultado.js   # Formateo y validación de resultados
│   └── tablaPosiciones.js    # Cálculo de tabla de posiciones
└── [otros .js]     # Entry points de cada HTML
```

### Database (Supabase)

PostgreSQL con migraciones en `supabase/migrations/`. Tablas principales:

- **`torneos`**: Configuración del torneo (formato, presentismo activo)
- **`grupos`**: Grupos del torneo (A, B, C...)
- **`parejas`**: Parejas de jugadores con campo `presentes TEXT[]` (presentismo individual)
- **`partidos`**: Partidos con estados: `pendiente` | `en_juego` | `terminado` + resultado

### Key Patterns

#### 1. "Guiar, No Bloquear" (Filosofía fundamental para Usuario Final)

**NUNCA bloquear acciones del usuario final (jugadores)**. Asumir que la app puede tener información incompleta o errónea.

- ✅ **Guiar**: Mostrar badges visuales (⚠️) cuando hay info incompleta
- ✅ **Confirmar**: Usar diálogos de confirmación preguntando "¿Estás seguro?"
- ✅ **Auto-corregir**: Si el usuario confirma, actualizar DB automáticamente
- ❌ **NO bloquear**: Nunca deshabilitar botones ni prevenir acciones del usuario final

Ejemplo: Si un jugador quiere cargar el resultado de un partido donde faltan jugadores marcados como presentes, mostrar diálogo de confirmación y auto-marcar como presentes si confirma.

**Nota**: Esta filosofía aplica específicamente al **Usuario Final**. Admin y Ayudante de Admin pueden tener validaciones más estrictas cuando sea necesario.

#### 2. Fixture y Numeración Dinámica

**Funciones compartidas en `src/utils/colaFixture.js`** (usar siempre estas, no duplicar):

```javascript
esPartidoFinalizado(partido)   // Tiene resultado cargado
esPartidoPendiente(partido)    // No finalizado, no en_juego, no terminado
esPartidoYaJugado(partido)     // Finalizado O terminado
calcularColaSugerida(partidos, grupos)  // Cola ordenada de pendientes
crearMapaPosiciones(cola)      // Map de partidoId -> posición global (#1, #2, #3...)
```

**Numeración de partidos**: SIEMPRE numerar TODOS los partidos pendientes (no filtrar por presentismo). La numeración debe ser estable y no cambiar cuando los jugadores marcan presencia/ausencia.

#### 3. Presentismo Individual

- Campo `presentes TEXT[]` en tabla `parejas`: array de nombres de jugadores presentes
- Ejemplo: `["Tincho", "Max"]` para pareja "Tincho-Max"
- Toggle global: campo `presentismo_activo BOOLEAN` en tabla `torneos`
- UI: Badges visuales (✅ todos presentes / ⚠️ info incompleta)
- Colores: Verde (#16A34A) = presente, Gris (#9CA3AF) = ausente, Amarillo (#F59E0B) = warning

#### 4. Auto-Refresh (Polling)

Las vistas usan polling cada 30 segundos:
- `index.html`: 30s (pausa cuando tab no visible)
- `fixture.html`: 30s
- Se pausa automáticamente cuando tab está oculto (ahorro recursos)

#### 5. Modal Full-Screen (Vista Jugador)

En `index.html`, botón "Tablas/Grupos/Fixture" abre modal full-screen con tabs:
- Mi grupo
- Otros grupos
- Fixture completo

Implementación: `src/viewer/modalConsulta.js`

## Code Quality Principles

### Avoid Code Duplication

**Siempre priorizar la unificación de funciones y evitar la duplicación de código**, especialmente:

- **Lógica de cálculo**: Funciones que procesan datos, calculan estadísticas, ordenan elementos
- **Validaciones**: Reglas de negocio que se repiten en múltiples lugares
- **Formateo**: Transformaciones de datos (fechas, resultados, nombres)

**Estrategia**:
1. Centralizar funciones compartidas en `src/utils/`
2. Usar imports en lugar de copiar código
3. Si encuentras código duplicado, refactorizar para consolidar en una única fuente de verdad

**Ejemplo**: `src/utils/colaFixture.js` centraliza TODA la lógica de fixture:
- `esPartidoFinalizado()`, `esPartidoPendiente()`, `esPartidoYaJugado()`
- `calcularColaSugerida()`, `crearMapaPosiciones()`

Si estas funciones aparecen duplicadas en otro archivo, eliminar la duplicación e importar de `colaFixture.js`.

### Key Documentation

- **`docs/home-unico-especificacion.md`**: Especificación completa del Home Único
- **`docs/fixture-presentismo-visual.md`**: Diseño de badges de presentismo
- **`docs/implementacion-presentismo-index-html.md`**: Plan de integración de presentismo
- **`C:\Users\Martin\.claude\plans\purrfect-herding-aurora.md`**: Plan maestro del proyecto con todas las decisiones

## Development Workflow

1. **Refactoring**: Siempre eliminar duplicación de código, centralizar en `utils/`
2. **Testing**: Hacer `npm run build` para verificar que no hay errores de compilación
3. **Mobile-first**: Todas las features deben funcionar 100% en mobile (sin hover, todo tap/click)
4. **Philosophy**: Cuando un usuario quiere hacer algo, SIEMPRE dejarlo (con confirmación si hay riesgos), nunca bloquear

## Database Migrations

Migraciones en `supabase/migrations/`. Para aplicar:

```bash
# Las migraciones se aplican automáticamente via Supabase CLI o dashboard
# Archivos nombrados con timestamp: YYYYMMDDHHMMSS_descripcion.sql
```

Migraciones recientes importantes:
- `20260130010000_add_presentes_to_parejas.sql`: Campo de presentismo individual
- `20260130020000_add_presentismo_activo_to_torneos.sql`: Toggle de presentismo por torneo
- `20260130000000_refactor_games_to_sets_model.sql`: Modelo de sets

## Environment Variables

Crear `.env` con:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Common Pitfalls

1. **NO duplicar código de lógica de cálculo** - Centralizar en `utils/` y usar imports
2. **NO bloquear acciones del usuario final** (jugadores) - Siempre guiar con warnings/confirmaciones
3. **NO usar hover interactions** - Todo debe funcionar con tap/click (mobile-first)
4. **NO filtrar numeración de partidos por presentismo** - Numeración debe ser estable
5. **NO diseñar desktop-first** - Siempre empezar por mobile y escalar a desktop
6. **NO reimplementar funciones compartidas** - Usar las de `utils/` en lugar de copiar código
