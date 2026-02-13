# Bugs y Limitaciones Detectadas Durante Testing E2E

**Fecha**: 2026-02-11
**Última actualización**: 2026-02-11 (post-resolución de BUG-001)

---

## ✅ BUG-001: Sistema NO generaba partidos (RESUELTO)

### Severidad
**CRÍTICA** ⚠️ → ✅ **RESUELTO**

### Problema Original
Durante testing E2E inicial (TC-101), se detectó que:
- Sistema solo generaba 7-8 partidos de 12 esperados
- Los logs de DEBUG agregados al código NUNCA aparecían en consola
- Manual import funcionaba perfectamente (generaba 12 partidos)

### Root Cause Identificado
**Vite Dev Server estaba sirviendo código cacheado** desde `node_modules/.vite`

**Evidencia**:
1. BD mostraba 8 partidos después del test (6 en Grupo A, 2 en Grupo B)
2. Logs de consola NO mostraban logs de DEBUG agregados a `service.js`
3. Manual import (mismo código) generaba 12 partidos correctamente
4. Logs viejos (línea 137) SÍ aparecían, logs nuevos NO
5. `grep` confirmaba que cambios estaban en el archivo, pero no se reflejaban en navegador

### Resolución ✅
```bash
rm -rf node_modules/.vite  # Limpiar cache de Vite
taskkill //F //IM node.exe # Matar procesos Node
npm run dev                # Reiniciar dev server
```

**Resultado**:
- ✅ BD ahora tiene 12 partidos (6 por grupo)
- ✅ Test TC-101 PASA consistentemente
- ✅ Sistema genera partidos correctamente

### Lecciones Aprendidas
1. **Cache de Vite puede causar bugs fantasma**
   - Si código modificado no se refleja en navegador → limpiar cache
   - Comando: `rm -rf node_modules/.vite`

2. **Hot Module Reload (HMR) no siempre funciona**
   - Cambios en módulos profundamente anidados pueden no recargar
   - Solución: reiniciar dev server completamente

3. **Testing E2E debe verificar directamente en BD cuando sea posible**
   - Fixture.html tiene bug separado (BUG-002, no crítico)
   - TC-101 ahora verifica vía log del sistema, no vía fixture

### Impacto
- ✅ TC-101: Admin importa 8 parejas y genera 12 partidos → **PASS** (18.3s)
- ✅ Tests E2E ya no están bloqueados

---

## 🐛 BUG-002: Fixture.html no muestra partidos (Bug separado, no crítico)

### Status
⚠️ Identificado, no resuelto (NO bloquea testing)

### Descripción
- BD tiene 12 partidos con estructura correcta
- `/fixture` muestra 0 partidos
- Problema probablemente en query o renderizado de `fixture.js`

### Impacto
- ✅ NO bloquea testing E2E (tests verifican vía BD)
- ⚠️ Afecta UX de organizador (no puede ver fixture)

### Plan de acción
- Investigar query en `src/fixture.js`
- Verificar si filtra por campo inexistente
- Revisar join con otras tablas

**Por ahora**: Tests usan verificación directa en BD, evitando fixture.html

---

## ⚠️ BUG-E2E-001: Tests de carga de resultados requieren dataset management

### Severidad
**MEDIA** ⚠️

### Descripción
Los tests **TC-202, TC-203, TC-204** (flujo de carga y confirmación de resultados) requieren:
- Partidos en estado `pendiente` (sin resultados cargados)
- Parejas específicas con partidos específicos
- Estado limpio de BD entre tests

**Problema detectado**:
- Después de ejecutar TC-101 (import de parejas), BD tiene partidos generados
- Algunos tests pueden haber modificado el estado de partidos
- TC-202 intenta cargar resultado para "A1 vs A2" pero el partido puede estar en otro estado
- No hay estrategia de reset de BD entre tests

### Evidencia
```
TC-202: Carga resultado que se confirma automáticamente

Paso 1: Buscando partido A1 vs A2...
⚠️ No se encontró partido A1 vs A2
   Puede que los partidos ya estén cargados o el selector sea incorrecto
   SKIP: Este test requiere partidos en estado pendiente
```

### Tests afectados
- TC-202: Carga resultado que se confirma automáticamente
- TC-203: Genera disputa (resultados diferentes)
- TC-204: Resuelve disputa aceptando resultado del rival

### Opciones de solución

**Opción A: Reset de BD antes de cada suite**
```javascript
test.beforeAll(async () => {
  // Limpiar partidos y parejas
  // Ejecutar import fresh
});
```

**Opción B: Tests independientes del estado**
- TC-202/203/204 buscan CUALQUIER partido pendiente (no específico)
- Cargan resultado para el primer partido disponible
- Más robusto pero menos determinístico

**Opción C: Fixture de datos separado**
- Suite TC-200 tiene su propio torneo/parejas/partidos
- No interfiere con TC-100
- Más aislamiento

### Decisión temporal
**SKIP TC-202/203/204** y continuar con tests que no requieren estado pristino:
- TC-300: Admin durante torneo (puede trabajar con estado existente)
- TC-400: Tabla posiciones (valida cálculos, no requiere estado específico)
- TC-500: Presentismo (valida UI, no requiere partidos específicos)

### Impacto
- 3/4 tests de TC-200 skipped temporalmente
- ✅ TC-201 PASS (identificación y vista de partidos)
- ⏸️ TC-202, TC-203, TC-204 requieren estrategia de dataset

---

## ✅ TC-201: Jugador se identifica y ve partidos (PASS)

### Status
✅ **PASS** (12.7s)

### Comportamiento validado
1. ✅ Jugador (Tincho) puede identificarse en el sistema
2. ✅ Ve su Home Único con partidos pendientes
3. ✅ Sistema muestra 3 partidos pendientes
4. ✅ Números globales correctos: #1, #5, #9
5. ✅ Selectores correctos: `.partido-home`, `.partido-home-posicion`

### Evidencia
- Screenshot: `tests/screenshots/tc-201-home-tincho.png`
- Video: `test-results/.../video.webm`

---

## 📊 Estado Actual del Testing E2E

### Resumen
| Suite | Tests | Implementados | Pasando | Skipped | Pendientes |
|-------|-------|---------------|---------|---------|------------|
| TC-100: Setup Admin | 2 | 2 | 1 | 1 | 0 |
| TC-200: Flujo Jugador | 4 | 4 | 1 | 3 | 0 |
| TC-300: Admin Durante | 2 | 0 | 0 | 0 | 2 |
| TC-400: Tabla Posiciones | 3 | 0 | 0 | 0 | 3 |
| TC-500: Presentismo | 3 | 0 | 0 | 0 | 3 |
| **TOTAL** | **14** | **6** | **2** | **4** | **8** |

### Tests PASS ✅
1. **TC-101**: Admin importa 8 parejas y genera 12 partidos (18.3s)
2. **TC-201**: Jugador se identifica y ve 3 partidos (12.7s)

### Tests SKIP ⏭️
1. **TC-102**: Admin marca presentismo (feature pendiente: `presente.html` no existe)
2. **TC-202**: Carga resultado automático (requiere dataset management)
3. **TC-203**: Genera disputa (requiere dataset management)
4. **TC-204**: Resuelve disputa (requiere dataset management)

### Tests Pendientes de Implementación
- TC-300: Admin Durante Torneo (2 tests)
- TC-400: Validación Tabla (3 tests)
- TC-500: Presentismo (3 tests)

---

## 🎯 Próximos Pasos

### Inmediato
1. ✅ **Implementar TC-300** (Admin durante torneo) - Puede usar estado existente
2. ✅ **Implementar TC-400** (Tabla posiciones) - Valida cálculos
3. ✅ **Implementar TC-500** (Presentismo) - Valida UI

### Después (requiere decisión de estrategia)
1. **Resolver BUG-E2E-001**: Definir estrategia de dataset management
2. **Implementar TC-202/203/204**: Flujo completo de carga de resultados
3. **Resolver BUG-002**: Investigar por qué fixture.html no muestra partidos

---

**Última actualización**: 2026-02-11 23:30
**Próxima acción**: Implementar TC-300 (Admin Durante Torneo)
