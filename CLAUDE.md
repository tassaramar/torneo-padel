# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

App web para gestión de torneos de pádel con sistema de autogestión para jugadores. Arquitectura multi-HTML SPA usando Vite, Supabase (PostgreSQL) como backend, y JavaScript vanilla modular.

**Deployment**: https://torneo-padel-teal.vercel.app/

**Design Philosophy**: Mobile-first. Todas las features deben diseñarse primero para mobile y luego escalar a desktop.

**Product Philosophy**: Pensar siempre desde el usuario, no desde el código. Antes de diseñar una solución, preguntarse: "¿Qué pregunta tiene el usuario cuando llega a esta pantalla? ¿Qué información le falta?" Las decisiones de UX son decisiones de producto — no tomarlas sin validar con el owner. Presentar alternativas funcionales (no código) y pedir feedback antes de implementar.

## Commands

```bash
# Development
npm run dev          # Servidor de desarrollo en http://localhost:5173

# Build
npm run build        # Build para producción en ./dist/

# Preview
npm run preview      # Preview del build de producción
```

## Versioning

La versión de la app está centralizada en `package.json` y se muestra en la UI en cada página.

Para actualizar la versión antes de un deploy:

```bash
npm version patch   # bug fix / ajuste visual      → 1.0.0 → 1.0.1
npm version minor   # feature nueva                → 1.0.0 → 1.1.0
npm version major   # cambio grande o breaking     → 1.0.0 → 2.0.0
```

Cada comando actualiza `package.json`, crea un commit y un git tag automáticamente.

## Architecture

### User Roles

El sistema contempla los siguientes niveles de acceso:

1. **Admin** (requiere login Google): Acceso completo a gestión del torneo (admin.html) y analytics (analytics.html)
2. **Organizador / Ayudante** (sin login): Acceso a fixture.html, carga.html, presente.html — páginas públicas
3. **Usuario Final (Jugador)** (sin login): Vista personal autogestiva (index.html)

> La autenticación se implementa con Google OAuth + tabla `admin_users` en Supabase.
> Ver `src/auth/adminGuard.js`.

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
  - Tabs superiores: **Grupos** | **Copas** | **Setup**
  - Log de acciones como `<details open>` siempre visible (logMsg con timestamp, toast ✅/❌/⚠️)

- **`carga.html`** → Carga rápida de resultados
  - Entry point: `src/carga.js`

- **`analytics.html`** → Estadísticas del torneo
  - Entry point: `src/analytics.js`

### Module Organization

```
src/
├── admin/          # Gestión de torneo (grupos, parejas, copas)
│   ├── copas/
│   │   ├── index.js          # Orquestador — determina estado y delega a planEditor o statusView
│   │   ├── planEditor.js     # Wizard de 4 paneles (presets → num copas → config → preview)
│   │   ├── statusView.js     # Vista de propuestas pendientes y copas en curso
│   │   ├── planService.js    # CRUD esquemas_copa, presets_copa + llamadas a RPCs
│   │   ├── bracketLogic.js   # Seeding, winner/loser para brackets
│   │   └── presets.js        # Presets estáticos (fallback si BD vacía)
│   ├── groups/               # Gestión de grupos y parejas
│   └── context.js            # supabase, TORNEO_ID, logMsg (compartidos admin)
├── carga/          # Módulos de carga de resultados
├── viewer/         # Vista del jugador (home único)
│   ├── vistaPersonal.js      # Renderiza home del jugador
│   ├── modalConsulta.js      # Modal full-screen (tablas/grupos/fixture)
│   ├── cargarResultado.js    # Flujo de carga de resultado
│   └── presentismo.js        # Gestión de presentismo individual
├── analytics/      # Estadísticas y rankings
├── auth/           # Autenticación
│   └── adminGuard.js         # requireAdmin() con Google OAuth, bypass DEV
├── identificacion/ # Sistema de identificación de jugadores
├── utils/          # Utilidades compartidas
│   ├── colaFixture.js        # Lógica compartida de fixture (SINGLE SOURCE OF TRUTH)
│   ├── formatoResultado.js   # Formateo y validación de resultados
│   ├── tablaPosiciones.js    # Cálculo de tabla de posiciones por grupo
│   └── tablaGrupoDB.js       # calcularTablaGrupoDB — cálculo desde BD (reutilizable)
└── [otros .js]     # Entry points de cada HTML
```

### Database (Supabase)

PostgreSQL con migraciones en `supabase/migrations/`. Tablas principales:

- **`torneos`**: Configuración del torneo (formato, presentismo activo)
- **`grupos`**: Grupos del torneo (A, B, C...)
- **`parejas`**: Parejas de jugadores con campo `presentes TEXT[]` (presentismo individual)
- **`partidos`**: Partidos con estados de resultado (ver Key Pattern #7) + campos de sets + campos temporales para disputa
  - `copa_id` (UUID, nullable): NULL = partido de grupo, NOT NULL = partido de copa
  - `ronda_copa` (TEXT): `'SF'`, `'F'`, `'3P'`, `'direct'` — solo para partidos de copa
- **`copas`**: Copas del torneo (nombre, esquema_copa_id, torneo_id)
- **`esquemas_copa`**: Plan de copas definido por el admin (nombre, formato, reglas JSON de seeding)
- **`propuestas_copa`**: Propuestas generadas automáticamente por el motor (estado: pendiente/aprobada)
- **`presets_copa`**: Presets de configuración de copas (9 por defecto + custom del admin)

**RPCs de copa** (funciones PostgreSQL):
- `verificar_y_proponer_copas(p_torneo_id)`: Genera propuestas cuando grupos terminan. Soporta `modo:'global'` (seeding por ranking) y por posición de grupo.
- `aprobar_propuestas_copa(p_torneo_id)`: Aprueba propuestas pendientes y genera partidos de copa.
- `generar_finales_copa(p_torneo_id)`: Genera finales automáticamente cuando semis están confirmadas.
- `reset_copas_torneo(p_torneo_id)`: Borra partidos y copas del torneo.
- `obtener_standings_torneo(p_torneo_id)`: Retorna tabla de posiciones cross-grupos (grupo_id, pareja_id, puntos, ds, gf, posicion_en_grupo, grupo_completo).

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

En `index.html`, botón "Tablas/Grupos/Fixture" abre modal full-screen con tabs principales:

```
[Grupos]         [Copas]         [Fixture]
```

- **Grupos**: Sub-tabs por grupo (Grupo A, B, C...) + "General" (tabla cross-grupos). Mi grupo seleccionado por defecto.
- **Copas**: Solo visible si hay copas con partidos creados. Muestra estructura de llaves por copa.
- **Fixture**: Todos los partidos (grupos + copas) en orden cronológico/operacional.

Implementación: `src/viewer/modalConsulta.js`

#### 6. Identificación del Jugador (index.html)

El jugador no tiene cuenta ni login. Se identifica por nombre al entrar a `index.html`:

1. **Buscar nombre**: Escribe su nombre, la app busca en las parejas del torneo
2. **Validar identidad**: Se le muestran 3 opciones de compañero (1 correcta + 2 random). Debe elegir la correcta.
3. **Identidad guardada**: Se persiste en `localStorage` (key: `torneo_identidad`) con: `parejaId`, `parejaNombre`, `miNombre`, `companero`, `grupo`, `orden`
4. **Sesiones futuras**: Si ya tiene identidad en localStorage, se salta el flujo y va directo a la vista personal

**Archivos**: `src/identificacion/identidad.js` (lógica, localStorage), `src/identificacion/ui.js` (pantallas del flujo)

**Importante**: La identidad es por pareja, no por jugador individual. El `parejaId` se usa para determinar qué partidos son "míos" y para validar quién puede cargar resultados.

#### 7. Carga y Confirmación de Resultados

Flujo de autogestión donde **ambas parejas** deben coincidir en el resultado para que sea oficial.

**Estados del resultado** (campo `partidos.estado`):
```
pendiente → a_confirmar → confirmado
      ↗         ↘
en_juego    en_revision → confirmado
```

| Estado | Significado | Quién transiciona |
|--------|-------------|-------------------|
| `pendiente` | Nadie cargó resultado | (estado inicial) |
| `en_juego` | Marcado como en cancha (optativo, best-effort) | Organizador desde fixture.html |
| `a_confirmar` | Una pareja cargó el resultado, falta la otra | Primera pareja que carga |
| `confirmado` | Ambas parejas coinciden — resultado firme | Segunda pareja al confirmar |
| `en_revision` | Las parejas cargaron resultados distintos (disputa) | Segunda pareja al disputar |

**Flujo detallado**:
1. **Primera pareja carga**: Estado pasa a `a_confirmar`. Se guarda `cargado_por_pareja_id` para saber quién cargó primero.
2. **Segunda pareja entra**: Ve el resultado cargado y puede:
   - **Confirmar** (coincide) → estado pasa a `confirmado`
   - **Disputar** (no coincide) → carga su versión en campos `set*_temp_*`, estado pasa a `en_revision`
3. **En revisión**: Cualquiera de las dos puede:
   - **Aceptar el resultado del otro** → se adopta ese resultado, estado pasa a `confirmado`
   - **Re-cargar** → actualiza su versión y sigue en `en_revision`
4. **Confirmado**: Resultado firme. No se puede modificar.

**Nota**: `en_juego` y `terminado` son estados operacionales del organizador (fixture), no del flujo de carga. Un partido `en_juego` permite primera carga igual que `pendiente`.

**Archivo**: `src/viewer/cargarResultado.js` — Toda la lógica de transiciones de estado.

**Validaciones**:
- Solo las parejas participantes pueden cargar resultado de un partido
- La pareja que cargó primero puede editar su carga mientras está `a_confirmar`
- Una vez `confirmado`, el resultado es inmutable desde la vista del jugador

#### 8. Sistema de Copas (plan → propuesta → aprobación)

Flujo automatizado donde el admin define un plan y el motor genera copas cuando los grupos terminan.

**Flujo completo**:
1. **Admin define plan**: Wizard en `planEditor.js` → elige preset o crea esquema custom → se guarda en `esquemas_copa`
2. **Motor genera propuestas**: Cuando grupos terminan, `verificar_y_proponer_copas` crea propuestas automáticamente en `propuestas_copa`
3. **Admin aprueba**: Revisa propuestas en `statusView.js` → `aprobar_propuestas_copa` genera las copas y sus partidos
4. **Partidos se juegan**: Igual que partidos de grupos (misma tabla `partidos`, con `copa_id` no nulo)
5. **Finales automáticas**: `generar_finales_copa` genera finales cuando semis están confirmadas

**Trigger automático**: `cargarResultado.js` llama `verificar_y_proponer_copas` (fire-and-forget) al confirmar resultado — si los grupos ya terminaron, las propuestas aparecen automáticamente.

**Seeding**: Dos modos en `reglas` de `esquemas_copa`:
- Por posición de grupo: `[{ posicion: 1 }, { posicion: 2 }]` — toma N-ésimo de cada grupo
- Global: `{ modo: 'global', desde: 1, hasta: 4 }` — toma del ranking general del torneo

**Formatos de copa**: `direct` (2 equipos, cruce directo) o `bracket` (4/8 equipos, eliminación)

**Módulos**: `src/admin/copas/` — ver Module Organization para detalle de cada archivo.

**Documentación detallada**: `docs/plan-reingenieria-copas.md`

---

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
- **`docs/plan-reingenieria-copas.md`**: Plan canónico del sistema de copas
- **`docs/spec-*.md`**: Especificaciones funcionales para implementar (bugs, mejoras, features)
- **`docs/brainstorming-proximas-mejoras.md`**: Backlog completo del producto (fuente única de verdad para ideas)

## Development Workflow

1. **Refactoring**: Siempre eliminar duplicación de código, centralizar en `utils/`
2. **Testing**: Hacer `npm run build` para verificar que no hay errores de compilación
3. **Mobile-first**: Todas las features deben funcionar 100% en mobile (sin hover, todo tap/click)
4. **Philosophy**: Cuando un usuario quiere hacer algo, SIEMPRE dejarlo (con confirmación si hay riesgos), nunca bloquear
5. **Backlog**: Al completar cualquier feature o mejora significativa, actualizar `docs/brainstorming-proximas-mejoras.md`:
   - Mover el ítem completado al historial (`## Historial`) con fecha y descripción breve
   - Actualizar "Última actualización" al tope del archivo
   - Sacar el ítem del roadmap activo si estaba ahí
6. **Especificación Técnica**: Si se crea un documento de planificación previo al desarrollo, incluir el link en la entrada del historial

## Database Migrations

Migraciones en `supabase/migrations/`. Para aplicar:

```bash
# Las migraciones se aplican automáticamente via Supabase CLI o dashboard
# Archivos nombrados con timestamp: YYYYMMDDHHMMSS_descripcion.sql
```

Migraciones recientes importantes:
- `20260130000000_refactor_games_to_sets_model.sql`: Modelo de sets
- `20260130010000_add_presentes_to_parejas.sql`: Campo de presentismo individual
- `20260130020000_add_presentismo_activo_to_torneos.sql`: Toggle de presentismo por torneo
- `20260224000000_fix_rls_policies.sql`: RLS policies alineadas con modelo de auth (función `is_admin()`, restricciones por rol)
- `20260225000000_add_esquemas_copa.sql`: Tablas `esquemas_copa`, `propuestas_copa`, RPCs de copa
- `20260227000000_add_presets_copa.sql`: Tabla `presets_copa` con 9 presets por defecto

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
