# Plan de Testing E2E Completo - Torneo Padel

## 📋 Resumen Ejecutivo

Este plan define **14 tests E2E** organizados en **5 suites** que cubren todo el flujo del torneo desde 2 perspectivas:
- **Admin del sistema**: Configuración, gestión, resolución de disputas
- **Usuario Final (Jugador)**: Identificación, carga de resultados, consultas

## 🎯 Objetivos

1. ✅ Validar flujo completo del torneo end-to-end
2. ✅ Verificar cálculo correcto de tabla de posiciones con empates
3. ✅ Probar todos los escenarios de confirmación de resultados
4. ✅ Validar sistema de presentismo
5. ✅ Garantizar funcionalidad mobile-first en 4 browsers

## 📊 Dataset de Prueba

### Configuración
- **8 parejas** en **2 grupos** (A y B)
- **12 partidos** (6 por grupo)
- **Solo fase de grupos** (sin copas)
- **Resultados pre-calculados** para validar tabla

### Parejas

**Grupo A:**
1. **A1**: Tincho - Max
2. **A2**: Ari - Lean
3. **A3**: Fede - Santi
4. **A4**: Nico - Pablo ⚠️ *Pablo ausente (test presentismo)*

**Grupo B:**
1. **B1**: Lucas - Martín
2. **B2**: Diego - Javi
3. **B3**: Ale - Gonza
4. **B4**: Mateo - Bruno

### Escenarios de Estado de Partidos

| Partido | Estado | Propósito |
|---------|--------|-----------|
| #1 A1 vs A2 | `confirmado` | Confirmación automática (ambos cargan igual) |
| #3 A1 vs A4 | `a_confirmar` | Pendiente → Admin da por bueno |
| #5 A2 vs A4 | `en_revision` | **Disputa** - orden de sets diferente |
| #6 A3 vs A4 | `confirmado` | Disputa resuelta por jugadores |
| #12 B3 vs B4 | `en_revision` | **Disputa** - Admin resuelve |

### Tabla de Posiciones Esperada

**Grupo A** (triple empate en puntos y DS):
1. **Tincho-Max (A1)**: 5 pts, DS +2, DG +6, GF 45
2. **Ari-Lean (A2)**: 5 pts, DS +2, DG +6, GF 42
3. **Nico-Pablo (A4)**: 5 pts, DS +2, DG +1, GF 41
4. **Fede-Santi (A3)**: 3 pts, DS -3, DG -7, GF 37

**Criterio de desempate:** P → DS → DG → GF

**Grupo B** (triple empate en puntos y DS):
1. **Lucas-Martín (B1)**: 5 pts, DS 0, DG +2, GF 40
2. **Diego-Javi (B2)**: 5 pts, DS 0, DG +1, GF 39
3. **Mateo-Bruno (B4)**: 5 pts, DS 0, DG +1, GF 38
4. **Ale-Gonza (B3)**: 3 pts, DS -3, DG -4, GF 35

## 🧪 Suites de Tests

### TC-100: Setup Completo del Torneo (2 tests)

**Objetivo**: Validar que Admin puede configurar el torneo completo

- **TC-101**: Admin importa 8 parejas → genera 12 partidos automáticamente
- **TC-102**: Admin marca presentismo (Pablo ausente)

**Cobertura**:
- ✅ Importación masiva de parejas desde TSV
- ✅ Generación automática de partidos (Circle Method)
- ✅ Sistema de presentismo individual

---

### TC-200: Flujo del Jugador (4 tests)

**Objetivo**: Validar experiencia completa del jugador

- **TC-201**: Jugador se identifica y ve sus 3 partidos
- **TC-202**: Carga resultado que se confirma automáticamente
- **TC-203**: Genera disputa al cargar resultado diferente
- **TC-204**: Resuelve disputa aceptando resultado del rival

**Cobertura**:
- ✅ Sistema de identificación
- ✅ Home Único con partidos pendientes
- ✅ Numeración global de partidos (#1, #2, #3)
- ✅ Doble confirmación de resultados
- ✅ Sistema de disputas (generación y resolución por jugadores)

---

### TC-300: Admin Durante el Torneo (2 tests)

**Objetivo**: Validar herramientas del Admin durante el torneo

- **TC-301**: Admin confirma resultado pendiente
- **TC-302**: Admin resuelve disputa a favor de B4

**Cobertura**:
- ✅ Vista de partidos pendientes de confirmación
- ✅ Poder dar por bueno un resultado
- ✅ Sistema de resolución de disputas por admin
- ✅ Actualización de tabla tras resolución

---

### TC-400: Validación de Tabla de Posiciones (3 tests)

**Objetivo**: Verificar cálculo correcto con casos complejos

- **TC-401**: Tabla Grupo A ordenada correctamente (triple empate P y DS)
- **TC-402**: Tabla Grupo B ordenada correctamente (triple empate P y DS)
- **TC-403**: Sistema muestra indicador de empate

**Cobertura**:
- ✅ Criterios de desempate: P → DS → DG → GF
- ✅ Triple empate en puntos
- ✅ Triple empate en puntos Y diferencia de sets
- ✅ Empate con mismo DG (resolver por GF)
- ✅ Indicadores visuales de empate

---

### TC-500: Presentismo (3 tests)

**Objetivo**: Validar sistema de presentismo individual

- **TC-501**: Jugador con pareja incompleta ve warning
- **TC-502**: Fixture muestra badges de presentismo (✅/⚠️)
- **TC-503**: Filtro "Solo parejas completas" funciona

**Cobertura**:
- ✅ Badges visuales de presentismo
- ✅ Warning cuando falta compañero
- ✅ Colores en nombres (verde/gris)
- ✅ Filtro funcional en fixture
- ✅ Filosofía "guiar, no bloquear"

---

## 📁 Estructura de Archivos

```
tests/
├── README.md                          # Documentación general de tests
├── README-E2E-PLAN.md                 # Este archivo (plan completo)
├── tc-020-modal-numeros-globales.spec.js  # Test existente (números en modal)
├── tc-100-setup-admin.spec.js         # ⬅️ NUEVO: Setup admin
├── tc-200-flujo-jugador.spec.js       # ⬅️ NUEVO: Flujo jugador
├── tc-300-admin-durante.spec.js       # ⬅️ NUEVO: Admin durante torneo
├── tc-400-tabla-posiciones.spec.js    # ⬅️ NUEVO: Validación tabla
├── tc-500-presentismo.spec.js         # ⬅️ NUEVO: Presentismo
└── fixtures/
    ├── datos-torneo.json              # Dataset completo (parejas, partidos, tabla esperada)
    └── test-helpers.js                # Funciones helper reutilizables
```

## 🛠️ Helpers Disponibles

El archivo `fixtures/test-helpers.js` provee:

### Configuración
- `generarTextoImportParejas()` - Genera TSV para importar

### Identificación
- `identificarseComoJugador(page, nombre, pareja)` - Flujo completo de login

### Navegación
- `abrirModalTablas(page)` - Abre modal "Tablas/Grupos"
- `navegarATab(page, tabName)` - Cambia de tab en modal

### Acciones
- `cargarResultado(page, sets)` - Llena formulario de sets

### Validación
- `validarTablaPosiciones(page, grupo)` - Verifica tabla contra esperada
- `esperarEstadoPartido(page, num, estado)` - Espera cambio de estado
- `leerTablaPosiciones(page)` - Lee tabla completa

### Datos
- `getParejaData(id)` - Obtiene datos de pareja por ID
- `getPartidoData(num)` - Obtiene datos de partido por número
- `getTablaEsperada(grupo)` - Obtiene tabla esperada

## ▶️ Ejecución de Tests

### Comandos Disponibles

```bash
# Ejecutar todos los tests E2E (14 tests × 4 browsers = 56 runs)
npm test

# Ejecutar solo tests nuevos
npm test tc-100
npm test tc-200
npm test tc-300
npm test tc-400
npm test tc-500

# Ejecutar con UI interactiva (recomendado para desarrollo)
npm run test:ui

# Ejecutar con browser visible (debugging)
npm run test:headed

# Solo mobile
npm run test:mobile

# Ver reporte HTML
npm run test:report
```

### Proyectos (Browsers)

Los tests se ejecutan automáticamente en **4 configuraciones**:

1. **mobile-chrome** - Pixel 5 (393×851)
2. **mobile-safari** - iPhone 12 (390×844)
3. **desktop-chrome** - Desktop (1280×720)
4. **desktop-firefox** - Desktop (1280×720)

## ✅ Criterios de Éxito

Para considerar el plan exitoso:

- [ ] **100% tests pasan** en los 4 proyectos (14 tests × 4 = 56 runs)
- [ ] **Tabla de posiciones correcta**:
  - Grupo A: A1 → A2 → A4 → A3
  - Grupo B: B1 → B2 → B4 → B3
- [ ] **Todos los escenarios de confirmación probados**:
  - ✅ Confirmación automática
  - ✅ Pendiente → Admin confirma
  - ✅ Disputa → Jugadores resuelven
  - ✅ Disputa → Admin resuelve
- [ ] **Presentismo funcional**:
  - ✅ Warnings visibles
  - ✅ Filtro funciona
  - ✅ No bloquea acciones (solo guía)

## 📝 Orden de Implementación

### Fase 1: Setup y Fundamentos
1. ✅ Crear estructura de directorios
2. ✅ Crear `datos-torneo.json` con dataset completo
3. ✅ Crear `test-helpers.js` con funciones reutilizables
4. ✅ Documentar plan en `README-E2E-PLAN.md`

### Fase 2: Implementar Tests (siguiente)
5. ⏳ **TC-100**: Setup Admin (2 tests)
6. ⏳ **TC-200**: Flujo Jugador (4 tests)
7. ⏳ **TC-300**: Admin Durante Torneo (2 tests)
8. ⏳ **TC-400**: Validación Tabla (3 tests)
9. ⏳ **TC-500**: Presentismo (3 tests)

### Fase 3: Validación
10. ⏳ Ejecutar todos los tests
11. ⏳ Verificar criterios de éxito
12. ⏳ Documentar resultados

## 🔗 Referencias

- **Plan Maestro**: `C:\Users\Martin\.claude\plans\purrfect-herding-aurora.md`
- **Datos de Prueba**: `tests/fixtures/datos-torneo.json`
- **Helpers**: `tests/fixtures/test-helpers.js`
- **Tests Existentes**: `tests/tc-020-modal-numeros-globales.spec.js`
- **Playwright Config**: `playwright.config.js`

## 📊 Estadísticas

- **Total tests**: 14 (+ 2 existentes = 16 total)
- **Total runs**: 14 tests × 4 browsers = **56 test runs**
- **Parejas de prueba**: 8
- **Partidos de prueba**: 12
- **Escenarios de estado**: 5 diferentes
- **Casos de empate**: 2 (triple empate en ambos grupos)

---

**Estado**: ✅ Plan completo - Listo para implementación
**Última actualización**: 2026-02-11
