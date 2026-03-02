# Spec: Bug — Estado inconsistente al importar parejas con copas aprobadas

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 1 (bug bloqueante)
**Ítem del backlog**: "[BUG] Tab Copas — estado inconsistente al importar nuevas parejas con copas ya aprobadas"

---

## Contexto

Cuando el admin importa parejas nuevas (Setup → Importar) con copas ya aprobadas del ciclo anterior, el tab Copas queda en un estado inconsistente e irrecuperable:
- Breadcrumb dice "2. Esperar grupos"
- Body dice "🔒 Plan bloqueado — hay copas aprobadas. Usá Reset para empezar de nuevo."
- El botón Reset **no aparece** en pantalla

El usuario queda sin salida visible. El workaround es ir a Setup → "Regenerar torneo".

---

## Causa raíz (dos problemas)

### Problema A — `borrarTodoTorneo()` no limpia datos de copa completos

**Archivo**: `src/admin/parejas/parejasImport.js`, función `borrarTodoTorneo()` (línea 218)

El flujo de importar parejas llama `borrarTodoTorneo()` que borra estas tablas en orden:
1. `partidos` ✅
2. `copas` ✅
3. `posiciones_manual` ✅
4. `parejas` ✅
5. `grupos` ✅

**Faltantes**: No borra `esquemas_copa` ni `propuestas_copa`. Quedan huérfanas.

### Problema B — `planEditor.js` no tiene salida cuando detecta plan bloqueado

**Archivo**: `src/admin/copas/planEditor.js`, líneas 54-60

Cuando `esPlanBloqueado()` es true, muestra un mensaje que dice "Usá Reset para empezar de nuevo" pero **no incluye el botón Reset**. El botón solo existe en `statusView.js`, que no se renderiza en este caso.

### Flujo del bug paso a paso

```
1. Estado previo: esquemas ✅, propuestas aprobadas ✅, copas ✅
2. Admin importa parejas nuevas → borrarTodoTorneo()
   → copas borradas ✅
   → esquemas_copa NO borradas ❌
   → propuestas_copa NO borradas ❌
3. Tab Copas carga:
   - esquemas: existen (del ciclo anterior)
   - propuestas: existen con estado 'aprobado' (huérfanas)
   - copas: [] (vacías, fueron borradas)
4. determinarPaso(): hayEsquemas=true, propuestasPendientes=[], hasCopas=false → paso 2
5. index.js línea 94: !hasPropuestas(pendientes) && !hasCopas → renderPlanEditor()
6. planEditor.js: esPlanBloqueado() encuentra propuestas aprobadas → "🔒 Plan bloqueado"
7. planEditor NO tiene botón Reset → usuario atrapado
```

---

## Fix

### Cambio 1 — `parejasImport.js`: agregar limpieza de esquemas y propuestas de copa

**Archivo**: `src/admin/parejas/parejasImport.js`, función `borrarTodoTorneo()` (línea 218)

Agregar `propuestas_copa` y `esquemas_copa` a la lista de tablas a borrar, **antes** de `copas` (por FKs):

```javascript
async function borrarTodoTorneo() {
  // orden importante por FKs
  const steps = [
    { table: 'partidos', msg: '🧹 Eliminando partidos…' },
    { table: 'propuestas_copa', msg: '🧹 Eliminando propuestas de copa…' },
    { table: 'copas', msg: '🧹 Eliminando copas…' },
    { table: 'esquemas_copa', msg: '🧹 Eliminando esquemas de copa…' },
    { table: 'posiciones_manual', msg: '🧹 Eliminando overrides…' },
    { table: 'parejas', msg: '🧹 Eliminando parejas…' },
    { table: 'grupos', msg: '🧹 Eliminando grupos…' }
  ];

  // ... resto sin cambios
}
```

**Orden de borrado por FKs**:
- `propuestas_copa` tiene FK a `esquemas_copa` → borrar primero
- `copas` tiene FK a `esquemas_copa` → borrar antes de esquemas
- `esquemas_copa` se borra después de sus dependientes

### Cambio 2 — `planEditor.js`: agregar botón Reset cuando está bloqueado

**Archivo**: `src/admin/copas/planEditor.js`, líneas 54-60

Cuando `bloqueado = true`, mostrar el mensaje **con un botón Reset** en lugar de un dead-end. Reutilizar la misma lógica de reset que tiene `statusView.js`.

```javascript
// Antes (línea 54-60):
if (bloqueado) {
  container.innerHTML = `
    <p class="helper" style="...">
      🔒 Plan bloqueado — hay copas aprobadas. Usá <strong>Reset</strong> para empezar de nuevo.
    </p>`;
  return;
}

// Después:
if (bloqueado) {
  container.innerHTML = `
    <div style="margin:12px 0; padding:14px; background:var(--bg);
         border-radius:8px; border:1px solid var(--border);">
      <p style="margin:0 0 12px 0;">
        🔒 El plan de copas es de un ciclo anterior. Hacé Reset para empezar de nuevo.
      </p>
      <button type="button" id="btn-reset-bloqueado" class="btn-sm btn-danger">
        🗑 Reset copas (borrar plan anterior)
      </button>
    </div>`;

  // Wire del botón reset — llama resetCopas y refresca
  container.querySelector('#btn-reset-bloqueado')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-reset-bloqueado');
    btn.disabled = true;
    btn.textContent = '⏳ Reseteando...';

    const { resetCopas } = await import('./planService.js');
    const result = await resetCopas(supabase, TORNEO_ID);
    if (result.ok) {
      logMsg('✅ Plan anterior borrado — podés definir un nuevo plan');
      _onRefresh?.();   // usa el callback guardado en el closure
    } else {
      logMsg(`❌ Error: ${result.msg}`);
      btn.disabled = false;
      btn.textContent = '🗑 Reset copas (borrar plan anterior)';
    }
  });
  return;
}
```

**Nota**: `_onRefresh` es el callback que se pasa a `renderPlanEditor(container, onRefresh, esquemaExistente)`. Verificar que esté accesible en el scope del bloque bloqueado (está en el closure de la función, línea ~30).

### Cambio 3 — Mensaje del breadcrumb para el estado inconsistente

**Archivo**: `src/admin/copas/index.js`

Mejorar el mensaje de `infoPaso2` para que el breadcrumb no diga "Esperando que finalicen los grupos" cuando el problema real es que hay un plan viejo.

```javascript
// En cargarCopasAdmin(), después de calcular el paso y antes del bloque if (paso === 2 && grupos...)
// Si paso es 2 pero hay propuestas aprobadas (estado inconsistente), ajustar mensaje
if (paso === 2) {
  const hayAprobadas = propuestas.some(p => p.estado === 'aprobado');
  if (hayAprobadas) {
    infoPaso2 = 'Plan anterior detectado — hacé Reset para empezar de nuevo';
  }
}
```

Este bloque va **antes** del bloque existente `if (paso === 2 && grupos && grupos.length > 0)` que calcula el progreso de grupos. Si hay propuestas aprobadas huérfanas, el mensaje del breadcrumb refleja el estado real.

### Cambio 4 — Verificar que `reset_copas_torneo` RPC borre esquemas

**Archivo**: `supabase/migrations/20260302000000_fix_reset_copas_esquemas.sql`

Esta migración ya existe y corrige el RPC `reset_copas_torneo` para que también borre `esquemas_copa`. **Verificar que esté aplicada en producción** (ejecutar `SELECT * FROM supabase_migrations.schema_migrations WHERE version = '20260302000000'` o revisar la lista de migraciones en el dashboard de Supabase).

Si no está aplicada, aplicarla. Esto asegura que el botón Reset (tanto el nuevo del Cambio 2 como el existente en `statusView.js`) efectivamente limpie todo.

---

## Criterios de aceptación

- [ ] Al importar parejas con copas previas → `borrarTodoTorneo()` limpia también `esquemas_copa` y `propuestas_copa`
- [ ] Después de importar, el tab Copas muestra paso 1 "Definir plan" (limpio, sin estado viejo)
- [ ] Cuando hay propuestas aprobadas huérfanas (sin copas) y se abre el tab Copas → se ve el botón Reset
- [ ] Al hacer click en Reset → se borran esquemas, propuestas y copas. Se refresca a paso 1 (Definir plan)
- [ ] El mensaje dice "Plan de un ciclo anterior" (no "Plan bloqueado" que suena a error)
- [ ] El breadcrumb no dice "Esperando que finalicen los grupos" en este estado inconsistente
- [ ] La migración `20260302000000` está aplicada en producción (RPC `reset_copas_torneo` borra esquemas)
- [ ] `npm run build` sin errores nuevos

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/admin/parejas/parejasImport.js` | `borrarTodoTorneo()`: agregar `propuestas_copa` y `esquemas_copa` a la lista de tablas a borrar |
| `src/admin/copas/planEditor.js` | Líneas 54-60: reemplazar dead-end por mensaje + botón Reset funcional |
| `src/admin/copas/index.js` | Ajustar mensaje de `infoPaso2` cuando hay propuestas aprobadas sin copas |
