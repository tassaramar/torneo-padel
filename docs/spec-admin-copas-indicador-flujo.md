# Spec: Admin copas — indicador de progreso del torneo

**Estado**: 📋 PRIORIZADA
**Prioridad**: Tier 2
**Ítem del backlog**: "Admin copas — indicador claro del paso del flujo"

---

## Contexto

### Pregunta del admin que resuelve

> "¿En qué momento del torneo estoy? ¿Qué tengo que hacer ahora?" — El admin abre el panel de copas y tiene que inferir el estado leyendo el contenido. No hay orientación rápida.

El flujo de copas tiene estados bien definidos internamente (`planEditor` vs. `statusView`) pero el admin no tiene un indicador visual de en qué momento del torneo está parado.

### Formato elegido: Breadcrumb + mensaje contextual

El admin tiene dos necesidades distintas:
1. **Orientación** ("¿en qué paso estoy?") → resuelto por el breadcrumb
2. **Acción** ("¿qué hago ahora?") → resuelto por el mensaje contextual

**Breadcrumb**: Muestra los 4 pasos con el actual resaltado. Da orientación visual inmediata.

**Mensaje contextual**: Debajo del breadcrumb, un texto que guía la próxima acción:
- Paso 1: "Definí el plan de copas para arrancar"
- Paso 2: "Plan listo — esperando que terminen los grupos (3 de 4 completados)"
- Paso 3: "Hay propuestas de copa para aprobar"
- Paso 4: "Copas en curso — 2 de 4 partidos jugados"

---

## Los 4 pasos del flujo

| Paso | Nombre | Cuándo está activo |
|------|--------|--------------------|
| 1 | **Definir plan** | No hay esquemas de copa en BD |
| 2 | **Esperar grupos** | Hay esquemas en BD, pero no hay propuestas aún (grupos en curso) |
| 3 | **Aprobar copas** | Hay propuestas con `estado: 'pendiente'` |
| 4 | **Copas en curso** | Propuestas aprobadas / copas activas con partidos |

**Nota**: El paso 2 puede durar minutos o días. El motor genera propuestas automáticamente cuando los grupos terminan, así que el paso 2 → 3 ocurre solo.

---

## Diseño del indicador

Breadcrumb horizontal, siempre visible en la parte superior del panel de copas (`#copas-admin`), por encima del contenido del planEditor o statusView.

```
[1. Definir plan] → [2. Esperar grupos] → [3. Aprobar] → [4. En curso]
                                              ↑ paso actual (resaltado)
```

**Visual**:
- Paso activo: fondo de color de acento (el azul/verde del proyecto), texto blanco, bold
- Pasos anteriores (completados): texto verde con check ✓, sin fondo
- Pasos siguientes (futuros): texto gris, sin fondo

**Mensaje contextual** (debajo del breadcrumb):
Cada paso tiene un mensaje de acción que guía al admin. Ver mensajes en la sección "Formato elegido" arriba.

**Información adicional en Paso 2**:
El mensaje incluye: `"3 de 4 grupos completados"` (usando los datos de standings o de partidos).

---

## Lógica de determinación del paso

En `src/admin/copas/index.js`, la función de carga ya tiene acceso a: `esquemas`, `propuestas`, `copas`. Extender para calcular el paso:

```javascript
function determinarPaso(esquemas, propuestas, copas) {
  const hayEsquemas = esquemas && esquemas.length > 0;
  const propuestasPendientes = (propuestas || []).filter(p => p.estado === 'pendiente');
  const hayCopas = (copas || []).length > 0;

  if (!hayEsquemas) return 1;
  if (propuestasPendientes.length > 0) return 3;
  if (hayCopas) return 4;
  return 2;  // Hay esquemas pero no propuestas ni copas → esperando grupos
}
```

**Info adicional para Paso 2** (grupos completados):

Para mostrar "X de Y grupos completados", usar los datos del RPC `obtener_standings_torneo` (que ya se llama en otros contextos) o simplemente consultar cuántos grupos tienen todos sus partidos finalizados. Alternativa más simple: cargar los grupos del torneo y contar cuántos tienen `grupo_completo: true` según los standings.

Si cargar esta info agrega complejidad, simplificar: mostrar solo "Esperando que finalicen los grupos" sin el contador. El contador es un nice-to-have.

---

## Cambios técnicos

### 1. `src/admin/copas/index.js`

Agregar función `determinarPaso()` y llamarla al cargar:

```javascript
const paso = determinarPaso(esquemas, propuestas, copas);
```

Pasar `paso` como parámetro a ambas vistas.

Antes de renderizar planEditor o statusView, insertar el indicador:

```javascript
// Insertar breadcrumb en el container antes del contenido principal
container.innerHTML = renderIndicadorPaso(paso, infoAdicional);
const subContainer = document.createElement('div');
container.appendChild(subContainer);

// Renderizar la vista correspondiente en subContainer
if (paso === 1 || paso === 2) {
  renderPlanEditor(subContainer, onRefresh);
} else {
  renderStatusView(subContainer, esquemas, propuestas, copas, onRefresh);
}
```

**Alternativa más simple**: usar `container.insertAdjacentHTML('afterbegin', renderIndicadorPaso(paso))` antes de las llamadas existentes a planEditor/statusView, siempre que el container no se re-renderice completo.

### 2. Función `renderIndicadorPaso(paso, info)`

Puede vivir en `src/admin/copas/index.js` (es pequeña) o en un nuevo `src/admin/copas/pasoIndicador.js`:

```javascript
function renderIndicadorPaso(paso, info = '') {
  const pasos = [
    { n: 1, label: 'Definir plan' },
    { n: 2, label: 'Esperar grupos' },
    { n: 3, label: 'Aprobar' },
    { n: 4, label: 'En curso' }
  ];

  const items = pasos.map(p => {
    const activo = p.n === paso;
    const completado = p.n < paso;
    const cls = activo ? 'paso-activo' : completado ? 'paso-completado' : 'paso-futuro';
    const label = completado ? `✓ ${p.label}` : `${p.n}. ${p.label}`;
    return `<span class="paso-item ${cls}">${label}</span>`;
  }).join('<span class="paso-sep">→</span>');

  const mensajes = {
    1: 'Definí el plan de copas para arrancar',
    2: info || 'Esperando que terminen los grupos',
    3: 'Hay propuestas de copa para aprobar',
    4: info || 'Copas en curso'
  };

  return `
    <div class="indicador-pasos">
      ${items}
    </div>
    <p class="paso-info">${mensajes[paso]}</p>
  `;
}
```

### 3. CSS en `src/style.css`

```css
.indicador-pasos {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  background: #F8FAFC;
  border-radius: 8px;
  border: 1px solid #E2E8F0;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.paso-item {
  font-size: 0.8rem;
  padding: 4px 10px;
  border-radius: 20px;
  white-space: nowrap;
}
.paso-activo  { background: #1D4ED8; color: white; font-weight: 600; }
.paso-completado { color: #16A34A; }
.paso-futuro  { color: #9CA3AF; }
.paso-sep     { color: #CBD5E1; font-size: 0.75rem; }
.paso-info    { font-size: 0.85rem; color: #64748B; margin: 0 0 12px 0; }
```

---

## Criterios de aceptación

- [ ] El breadcrumb de 4 pasos aparece siempre en la parte superior del panel de copas en admin.html
- [ ] El paso actual está resaltado visualmente (distinguible de los demás)
- [ ] Los pasos anteriores muestran ✓ (completados)
- [ ] Los pasos siguientes están en gris (pendientes)
- [ ] Debajo del breadcrumb, aparece un mensaje contextual de acción según el paso actual
- [ ] En Paso 2, el mensaje incluye cuántos grupos faltan (o al menos "Esperando que finalicen los grupos")
- [ ] El indicador se actualiza correctamente al refrescar el panel (cuando el estado cambia)
- [ ] Funciona en mobile (los pasos se pueden envolver en varias líneas)
- [ ] `npm run build` sin errores nuevos

---

## Archivos a modificar

- `src/admin/copas/index.js` — función `determinarPaso()`, inserción del indicador
- `src/admin/copas/index.js` o nuevo `src/admin/copas/pasoIndicador.js` — función `renderIndicadorPaso()`
- `src/style.css` — clases `.indicador-pasos`, `.paso-*`
