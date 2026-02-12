# Política de Optimistic UI y Rollback

**Fecha de creación**: 2026-02-12
**Estado**: Aprobado
**Aplica a**: Toda acción del usuario que modifica datos en BD

---

## Principio Core

**"Actualizar optimistamente, garantizar consistencia siempre"**

La experiencia del usuario es prioritaria (respuesta instantánea), pero la consistencia de datos es crítica (refresh en caso de error).

---

## Reglas de Implementación

### 1. SIEMPRE actualizar UI inmediatamente (Optimistic)

```javascript
// Cambio visual instantáneo ANTES de llamar al backend
element.classList.toggle('active');
button.textContent = 'Guardando...';
```

**Razón**: Eliminar latencia percibida, UX responsive.

---

### 2. SIEMPRE llamar al backend en background

```javascript
const success = await backendCall();
```

**Razón**: Sincronizar estado con BD, fuente de verdad.

---

### 3. En caso de ÉXITO: Refresh para garantizar consistencia

```javascript
if (success) {
  logMsg(`✅ Acción exitosa`);
  await refreshAffectedViews(); // Garantizar que UI refleja BD
}
```

**Razón**: Aunque la acción fue exitosa, el backend puede haber modificado otros datos relacionados (triggers, validaciones, cálculos). El refresh garantiza que la UI refleja el estado real de la BD.

---

### 4. En caso de ERROR: Revert + Refresh (CRÍTICO)

```javascript
else {
  // Paso 1: Revert immediate UI (feedback visual rápido)
  element.classList.remove('active');
  button.textContent = 'Guardar';

  // Paso 2: Log error
  logMsg(`❌ Error en acción`);

  // Paso 3: CRÍTICO - Refresh all affected views
  await refreshAffectedViews(); // ← Garantizar consistencia
}
```

**Razón**:
- **Revert immediate UI**: Da feedback visual inmediato al usuario de que algo falló
- **Refresh affected views**: Garantiza que TODA la UI (no solo el elemento clickeado) refleje el estado correcto de la BD

**Sin el refresh en error**, la UI puede quedar en estado inconsistente:
- El botón se revierte ✅
- Pero otros elementos (contadores, listas, backgrounds) pueden quedar desactualizados ❌

---

## Patrón Template

```javascript
async function optimisticAction(params) {
  // 1. CAPTURAR ESTADO PREVIO (si es necesario para revert)
  const previousState = {
    classes: element.className,
    text: element.textContent
  };

  // 2. OPTIMISTIC UI UPDATE
  updateUIOptimistically(element);

  // 3. BACKEND CALL
  const success = await backendCall(params);

  // 4. HANDLE RESULT
  if (success) {
    logMsg(`✅ Acción exitosa`);
    await refreshAffectedViews();
  } else {
    // ROLLBACK = Revert + Refresh
    revertImmediateUI(element, previousState);
    logMsg(`❌ Error en acción`);
    await refreshAffectedViews(); // ← CRÍTICO
  }
}
```

---

## Ejemplos de Aplicación

### ✅ Ejemplo 1: Toggle de Presentismo (Implementado)

**Archivo**: `src/admin/presentismo/granular.js`

```javascript
window.toggleJugadorPresentismo = async function(event, parejaId, nombre) {
  event.preventDefault();
  const btn = event.target;
  const estaPresente = btn.classList.contains('presente');

  // 1. OPTIMISTIC UI
  if (estaPresente) {
    btn.classList.remove('presente');
    btn.classList.add('ausente');
    btn.textContent = `❌ ${nombre}`;
  } else {
    btn.classList.remove('ausente');
    btn.classList.add('presente');
    btn.textContent = `✅ ${nombre}`;
  }

  // 2. BACKEND CALL
  let success;
  if (estaPresente) {
    success = await desmarcarPresente(parejaId, nombre);
  } else {
    success = await marcarPresente(parejaId, nombre);
  }

  // 3. HANDLE RESULT
  if (success) {
    logMsg(`✅ ${nombre} actualizado`);
    await refreshTodasLasVistas();
  } else {
    // ROLLBACK: Revert + Refresh
    if (estaPresente) {
      btn.classList.remove('ausente');
      btn.classList.add('presente');
      btn.textContent = `✅ ${nombre}`;
    } else {
      btn.classList.remove('presente');
      btn.classList.add('ausente');
      btn.textContent = `❌ ${nombre}`;
    }
    logMsg(`❌ Error al cambiar estado de ${nombre}`);
    await refreshTodasLasVistas(); // ← Guarantee consistency
  }
};
```

### ⚠️ Ejemplo 2: Lugares donde aplicar (Pendiente)

1. **Carga de resultados** (`src/viewer/cargarResultado.js`)
   - Optimistic: Mostrar resultado inmediatamente
   - Rollback: Revert + refresh si falla guardado

2. **Marcar partido en juego** (`src/fixture.js`)
   - Optimistic: Cambiar estado visual a "En juego"
   - Rollback: Revert + refresh si falla

3. **Operaciones masivas de presentismo** (`src/admin/presentismo/bulk.js`)
   - Optimistic: Actualizar contadores progresivamente
   - Rollback: Refresh completo si alguna operación falla

4. **Edición de parejas** (`src/admin/parejas/parejasEdit.js`)
   - Optimistic: Mostrar cambio en lista
   - Rollback: Revert + refresh si falla guardado

---

## Trade-offs

### ✅ Ventajas
- **Simple**: No requiere state management complejo (Redux, MobX, etc.)
- **Confiable**: Refresh garantiza consistencia al 100%
- **Rápido**: Errores son raros en práctica, costo de refresh es aceptable
- **Mantenible**: Patrón claro, repetible, fácil de revisar en code review

### ⚠️ Desventajas
- **Re-render en error**: Causa un re-render completo cuando falla una operación
  - **Mitigación**: Errores de backend son raros si la BD está funcionando
- **Tráfico de red adicional**: Refresh hace queries adicionales
  - **Mitigación**: Solo ocurre en caso de error (raro)

### 🔮 Alternativas consideradas (NO elegidas)

#### Opción descartada: State management con cache local
```javascript
// Rechazada por complejidad
updateLocalCache(data);
renderFromCache();
if (!success) {
  invalidateCache();
  await refreshFromBackend();
}
```
**Razón de descarte**: Requiere refactor grande, introduce complejidad (bugs potenciales), overhead de mantenimiento.

---

## Implementación en el Proyecto

### Estado Actual (2026-02-12)

✅ **Implementado**:
- `src/admin/presentismo/granular.js` - Toggle individual de jugadores

⚠️ **Pendiente de aplicar**:
- Ver [docs/brainstorming-proximas-mejoras.md](brainstorming-proximas-mejoras.md) sección "Aplicar Política de Rollback System-Wide"

### Criterios de Aceptación

Para considerar que una función cumple con la política:

1. ✅ UI se actualiza inmediatamente (sin await)
2. ✅ Backend se llama después de la actualización optimista
3. ✅ En caso de éxito: se llama a refresh
4. ✅ En caso de error:
   - Se revierte el elemento inmediato (feedback visual)
   - Se loguea el error
   - **Se llama a refresh** (garantía de consistencia)

---

## Referencias

- Implementación de referencia: [src/admin/presentismo/granular.js](../src/admin/presentismo/granular.js) líneas 173-213
- Lista de pendientes: [docs/brainstorming-proximas-mejoras.md](brainstorming-proximas-mejoras.md)

---

## Revisiones

- **2026-02-12**: Creación inicial, aprobada por usuario
