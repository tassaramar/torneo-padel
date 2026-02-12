# Verificación: Numeración Dinámica de Partidos

**Fecha**: 2026-02-12
**Status**: ✅ **VERIFICADO - Funcionando correctamente**

---

## Objetivo

Confirmar que la numeración de partidos en el sistema excluye correctamente partidos finalizados y en juego, mostrando solo pendientes reales con números dinámicos (#1, #2, #3...).

---

## Verificación

### 1. Función `esPartidoPendiente()` ✅

**Ubicación**: `src/utils/colaFixture.js` (línea 18-20)

**Código**:
```javascript
export function esPartidoPendiente(partido) {
  return !esPartidoFinalizado(partido)
      && partido.estado !== 'en_juego'
      && partido.estado !== 'terminado';
}
```

**Verificación**:
- ✅ Excluye partidos finalizados (`tieneResultado(partido)`)
- ✅ Excluye partidos `en_juego`
- ✅ Excluye partidos `terminado` (sin resultado pero ya jugados)

---

### 2. Función `calcularColaSugerida()` ✅

**Ubicación**: `src/utils/colaFixture.js` (línea 36-74)

**Código clave**:
```javascript
export function calcularColaSugerida(partidos, grupos) {
  // Filtrar solo partidos pendientes
  const pendientes = partidos.filter(p => esPartidoPendiente(p));  // Línea 38
  // ...ordena por ronda y grupo
  return cola;
}
```

**Verificación**:
- ✅ Filtra partidos usando `esPartidoPendiente()` antes de calcular cola
- ✅ Solo incluye partidos realmente pendientes
- ✅ Ordena por ronda ascendente + intercala grupos

---

### 3. Uso en `vistaPersonal.js` (Home del jugador) ✅

**Ubicación**: `src/viewer/vistaPersonal.js`

**Imports** (líneas 31-32):
```javascript
calcularColaSugerida,
crearMapaPosiciones
```

**Uso** (líneas 209-210):
```javascript
const colaGlobal = calcularColaSugerida(todosPartidosTorneo || [], grupos || []);
const mapaPosiciones = crearMapaPosiciones(colaGlobal);
```

**Verificación**:
- ✅ Calcula cola global de todos los partidos del torneo
- ✅ Filtra automáticamente solo pendientes
- ✅ Crea mapa de posiciones (partidoId → #)
- ✅ Jugador ve números dinámicos correctos

---

### 4. Uso en `fixture.js` (Vista organizador) ✅

**Ubicación**: `src/fixture.js` (línea 676)

**Código**:
```javascript
const cola = calcularColaSugerida(partidos, grupos);
```

**Verificación**:
- ✅ Usa la misma función centralizada
- ✅ Organizador ve cola filtrada consistente con vista del jugador

---

## Comportamiento Esperado

### Escenario: Torneo con 12 partidos

**Inicio del torneo** (todos pendientes):
- Numeración: #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12

**Después de jugar 5 partidos** (5 finalizados):
- Numeración: #1, #2, #3, #4, #5, #6, #7 (solo los 7 pendientes)
- Los 5 finalizados **NO aparecen** en la cola numerada

**Durante el juego** (2 partidos "en_juego"):
- Numeración: #1, #2, #3, #4, #5 (solo los 5 realmente pendientes)
- Los 2 "en_juego" **NO aparecen** en la cola numerada
- Los 5 finalizados **NO aparecen** en la cola numerada

### Beneficio para el Jugador

**Antes** (numeración fija):
- Jugador ve "#6" cuando es su próximo partido
- Confusión: "¿Faltan 5 partidos antes del mío?"
- **Realidad**: Es el próximo, pero los 5 anteriores ya terminaron

**Ahora** (numeración dinámica):
- Jugador ve "#1" cuando es su próximo partido
- **Claridad inmediata**: "Soy el próximo partido"
- Números siempre reflejan prioridad real

---

## Criterios de Aceptación ✅

- ✅ `esPartidoPendiente()` excluye: finalizados, en_juego, terminado
- ✅ `calcularColaSugerida()` filtra usando `esPartidoPendiente()`
- ✅ `vistaPersonal.js` usa la función centralizada correctamente
- ✅ `fixture.js` usa la función centralizada correctamente
- ✅ No hay duplicación de lógica (todo centralizado en `utils/colaFixture.js`)
- ✅ Numeración es dinámica y se ajusta cuando partidos terminan

---

## Conclusión

✅ **La numeración dinámica está correctamente implementada y funcionando**

- Lógica centralizada en `utils/colaFixture.js`
- Usado consistentemente en ambas vistas (jugador y organizador)
- Filtra correctamente partidos no-pendientes
- Beneficia UX del jugador con claridad inmediata de prioridad

**No requiere cambios ni correcciones.**

---

**Verificado por**: Claude Sonnet 4.5
**Fecha**: 2026-02-12
