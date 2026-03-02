# Spec: Bugs en wizard de copas (admin)

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 1 — Bugs + clarificación
**Ítems del backlog**: "Wizard copas — esquema custom no persiste" + "Wizard copas — Editar no navega wizard" + "Botón Reset Resultados — posible duplicado"

---

## Contexto

El wizard de copas (`planEditor.js`) tiene dos bugs que rompen flujos del admin: uno impide guardar esquemas personalizados en BD y el otro hace que "Editar un plan existente" lleve directamente al resumen sin permitir modificar configuración. Además, hay dos botones de "reset" con nombres confusos que generan incertidumbre sobre cuál usar.

---

## Bug 1 — Esquema custom no persiste en BD

### Causa raíz

En `src/admin/copas/planEditor.js`, la función `_wizToEsquemas()` (línea ~699) construye el array de esquemas para insertar en la BD. Para el campo `reglas`, usa:

```javascript
reglas: copa.modo === 'global'
  ? [{ modo: 'global', desde: copa.desde, hasta: copa.hasta }]
  : copa.posiciones.map(p => ({ posicion: p }))
```

`copa.posiciones` se inicializa como `[]` (array vacío). Si el admin llega al Panel 4 (preview) sin seleccionar posiciones en el Panel 3, `reglas` queda como `[]`.

La BD acepta la inserción con `reglas: []` sin error. Pero el RPC `verificar_y_proponer_copas` ignora los esquemas con `reglas` vacías → no genera propuestas → el admin no ve que falló nada.

En `_applyEsquemas()` (línea ~682), el resultado de `guardarEsquemas()` no se propaga visualmente si hay un error silencioso.

### Fix

**Validación en `_showPreview()`** antes de habilitar el botón "Aplicar":

En la función `_showPreview()`, al construir el HTML del preview, revisar si alguna copa tiene `posiciones.length === 0` (modo grupo) o campos de rango inválidos (modo global). Si hay problemas:
- Mostrar un aviso inline en el preview ("⚠️ Copa Oro: sin posiciones seleccionadas")
- Deshabilitar el botón "✓ Aplicar este plan"

**Validación defensiva en `guardarEsquemas()`** (`src/admin/copas/planService.js`, línea ~36):

```javascript
// Antes de insertar, verificar que todos los esquemas tienen reglas
const esquemasInvalidos = esquemas.filter(e => !e.reglas || e.reglas.length === 0);
if (esquemasInvalidos.length > 0) {
  return { ok: false, error: `Copa(s) sin reglas: ${esquemasInvalidos.map(e => e.nombre).join(', ')}` };
}
```

**Feedback de error en `_applyEsquemas()`** (`planEditor.js`, línea ~682):

```javascript
const result = await guardarEsquemas(supabase, TORNEO_ID, esquemas);
if (!result.ok) {
  logMsg(`❌ Error al guardar plan: ${result.error}`);
  btn.disabled = false;
  btn.textContent = '✓ Aplicar este plan';
  return;   // ← no continuar si falló
}
```

### Archivos a modificar

- `src/admin/copas/planEditor.js` → `_showPreview()` (validación) y `_applyEsquemas()` (propagación de error)
- `src/admin/copas/planService.js` → `guardarEsquemas()` (validación defensiva + retorno de error)

---

## Bug 2 — "Editar" en statusView no permite navegar el wizard

### Causa raíz

En `src/admin/copas/statusView.js` (línea ~292-297), el botón `#btn-editar-plan` hace:

```javascript
container.querySelector('#btn-editar-plan')?.addEventListener('click', async () => {
  const { renderPlanEditor } = await import('./planEditor.js');
  const co = document.getElementById('copas-admin');
  if (co) renderPlanEditor(co, onRefresh);   // ← no pasa esquemas existentes
});
```

`renderPlanEditor()` no recibe el esquema actual → inicia en `_showPresets()` (Panel 1). No hay forma de llegar directamente a editar el plan.

Adicionalmente, en `_showPresets()`, el handler de `.wiz-btn-edit` (editar un preset) llama:

```javascript
_fromEsquemasToWiz(preset.esquemas);
_showPreview(() => _showPresets());   // ← backFn vuelve a Presets, no al wizard
```

El admin llega al Preview pero el botón "‹" vuelve a la lista de presets en lugar de al Panel 2 (cuántas copas) donde podría hacer cambios.

### Fix

**Paso 1 — `renderPlanEditor()` acepta esquema existente**

Modificar la firma:

```javascript
// Antes:
export async function renderPlanEditor(container, onSaved)

// Después:
export async function renderPlanEditor(container, onSaved, esquemaExistente = null)
```

Al inicio de `renderPlanEditor()`, después de inicializar:

```javascript
if (esquemaExistente && esquemaExistente.length > 0) {
  _fromEsquemasToWiz(esquemaExistente);
  _showWizNum();   // ir al Panel 2 directamente
  return;
}
_showPresets();    // comportamiento por defecto
```

**Paso 2 — `statusView.js` pasa los esquemas**

El parámetro `esquemas` ya llega a `renderStatusView(container, esquemas, propuestas, copas, onRefresh)`. Usarlo al llamar a `renderPlanEditor`:

```javascript
if (co) renderPlanEditor(co, onRefresh, esquemas);
```

**Paso 3 — backFn correcto al editar preset**

En `_showPresets()`, handler de `.wiz-btn-edit`:

```javascript
// Antes:
_showPreview(() => _showPresets());

// Después:
_showPreview(() => _showWizNum());   // volver al Panel 2, no a Presets
```

### Criterio de comportamiento esperado

1. Admin en statusView → clic "Editar plan" → wizard abre en **Panel 2** (cuántas copas + nombres), pre-cargado con el plan actual
2. Admin navega: Panel 2 → Panel 3 (config de cada copa) → Panel 4 (preview)
3. En Panel 4, botón "‹" vuelve al **Panel 2** (no a Presets)
4. "Aplicar" guarda los cambios y vuelve a statusView

### Archivos a modificar

- `src/admin/copas/planEditor.js` → firma de `renderPlanEditor()`, lógica de inicio, handler `.wiz-btn-edit`
- `src/admin/copas/statusView.js` → listener `#btn-editar-plan`

---

## Bug 3 — Botones de reset: redistribución por tab y renombramiento

### Diagnóstico

Investigación confirma que los botones actuales **NO son duplicados** — tienen efectos distintos. Pero están en el mismo panel con nombres confusos. La solución es redistribuirlos por tab, scopeando cada acción a su contexto.

### Decisión: Un botón destructivo por tab

| Tab | Botón | Qué hace | Qué mantiene |
|-----|-------|----------|--------------|
| **Grupos** | "🔄 Limpiar resultados de grupos" | Limpia scores (sets) de partidos de grupo. Los partidos siguen existiendo. | Parejas, grupos, partidos (sin resultado), copas |
| **Copas** | "🔄 Reset copas" | Pregunta alcance (ver abajo) | Depende de la opción elegida |
| **Setup** | "🔥 Regenerar torneo" | Nuclear: regenera partidos de grupos desde parejas **+ borra todo de copas** (partidos, copas, propuestas, esquemas) | Parejas, grupos |

**Botón "Reset copas" — dialog con opciones de alcance**:

```
🔄 RESET COPAS

¿Qué querés resetear?

[Solo resultados]        → Limpia scores de partidos de copa.
                           Mantiene partidos, cruces y plan.

[Todo (partidos + plan)] → Borra partidos de copa, copas,
                           propuestas y esquemas.
                           Vuelve al paso "Definir plan".
```

El organizador elige en el momento según lo que necesita:
- **Caso "se cargó mal un resultado"** → Solo resultados
- **Caso "quiero cambiar el esquema"** → Todo

### Implementación

**Tab Grupos** — Nuevo botón o renombrar `#reset-resultados`:

La función actual `resetearResultados()` limpia resultados de grupos Y borra copas. Hay que modificarla para que **solo limpie resultados de grupos** (sin tocar copas). Los partidos de copa se gestionan desde el tab Copas.

```javascript
// Nuevo confirm dialog
const ok = confirm(
  '🔄 LIMPIAR RESULTADOS DE GRUPOS\n\n' +
  'Pone en cero los resultados de todos los partidos de grupo.\n' +
  'Los partidos siguen existiendo, solo se borran los scores.\n\n' +
  '✅ Mantiene: parejas, grupos, partidos, copas\n' +
  '🗑️ Borra: resultados (sets) de partidos de grupo\n\n' +
  '¿Continuar?'
);
```

**Tab Copas** — Nuevo botón "Reset copas":

Implementar como dialog con dos opciones (no un `confirm()` simple — usar un mini-modal o dos botones inline):
- "Solo resultados": limpia sets de partidos de copa, mantiene estructura
- "Todo": llama a `reset_copas_torneo` RPC (ya existente, borra partidos + copas + propuestas + esquemas)

**Tab Setup** — Renombrar `#gen-grupos` y ampliar alcance:

```javascript
const ok = confirm(
  '🔥 REGENERAR TORNEO\n\n' +
  'Borra TODO y regenera desde cero:\n' +
  '🗑️ Partidos de grupos (y los regenera)\n' +
  '🗑️ Copas: partidos, copas, propuestas y plan\n\n' +
  '✅ Mantiene: parejas y grupos\n\n' +
  'Usá esto para empezar el torneo de cero. ¿Continuar?'
);
```

La función debe: 1) llamar `reset_copas_torneo` para limpiar copas, 2) llamar `generarPartidosGrupos` para regenerar grupos.

### Archivos a modificar

- `admin.html` — mover botones a sus tabs respectivos, actualizar labels
- `src/admin/groups/index.js` — modificar `resetearResultados()` para solo limpiar grupos (sin tocar copas)
- `src/admin/copas/statusView.js` — agregar botón "Reset copas" con dialog de alcance
- `src/admin.js` — actualizar `#gen-grupos` → "Regenerar torneo" con alcance ampliado (grupos + copas)

---

## Criterios de aceptación globales

- [ ] **Bug 1**: Al crear esquema custom, si alguna copa no tiene posiciones seleccionadas → el botón "Aplicar" está deshabilitado o muestra aviso. Si se seleccionan posiciones → el esquema persiste en `esquemas_copa` y `verificar_y_proponer_copas` genera propuestas correctamente.
- [ ] **Bug 2**: Botón "Editar plan" en statusView → wizard abre en Panel 2 pre-cargado. Se puede navegar hacia adelante y atrás. El "‹" en Panel 4 vuelve al Panel 2.
- [ ] **Bug 3**: Cada tab tiene su botón destructivo scopeado: "Limpiar resultados" en Grupos, "Reset copas" en Copas, "Regenerar torneo" en Setup.
- [ ] **Bug 3**: "Limpiar resultados de grupos" solo limpia scores de grupos, sin tocar copas.
- [ ] **Bug 3**: "Reset copas" ofrece dos opciones: solo resultados vs todo (partidos + plan).
- [ ] **Bug 3**: "Regenerar torneo" regenera partidos de grupos Y borra todo de copas.
- [ ] **Bug 3**: Cada confirm dialog explica claramente qué borra y qué mantiene.
- [ ] `npm run build` sin errores nuevos.
