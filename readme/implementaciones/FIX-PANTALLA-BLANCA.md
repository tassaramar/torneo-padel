# Fix: Pantalla en blanco ✅

## Problema
La pantalla quedaba en blanco al abrir el viewer y la consola mostraba:
```
Usuario no identificado, iniciando flujo de identificación...
```

## Causa
El módulo `ui.js` buscaba el elemento `#app` para renderizar la identificación, pero en `index.html` (viewer) ese elemento no existe. La estructura DOM del viewer es diferente a la de carga.

## Solución aplicada

### 1. Módulo `ui.js` más flexible
- Agregado parámetro `containerId` a `iniciarIdentificacion()`
- Ahora puede renderizar en cualquier contenedor (no solo `#app`)
- Default: `'app'` (para mantener compatibilidad)

### 2. Viewer usa contenedor temporal
En `viewer.js`:
1. Oculta `.viewer-shell` (header, tabs, etc.)
2. Crea `div#identificacion-container` en el body
3. Renderiza identificación ahí
4. Al completar: borra el contenedor y muestra el viewer

### 3. Documentación actualizada
- Aclarada estructura real de archivos
- `index.html` = VIEWER (con identificación)
- `carga.html` = ADMIN (sin identificación)

---

## Archivos modificados

✅ `src/identificacion/ui.js`
- Parámetro `containerId` configurable
- Manejo de errores mejorado

✅ `src/viewer.js`
- Gestión de contenedor temporal
- Ocultar/mostrar viewer correctamente

✅ Documentación
- `CAMBIOS-PASO-1.md` corregido
- `PASO-1-IDENTIFICACION.md` corregido

---

## Cómo probar ahora

```bash
npm run dev
```

### Viewer (con identificación):
1. Abrí `http://localhost:5173/` 
2. ✅ Deberías ver "🎾 ¿Quién sos?" (no más pantalla en blanco)
3. Completá identificación
4. ✅ Viewer carga correctamente

### Carga (sin identificación):
1. Abrí `http://localhost:5173/carga.html`
2. ✅ Carga directa (sin identificación)

---

## Estructura final de archivos

```
index.html         → VIEWER (público, requiere identificación)
  └─ viewer.js     → Usa identificación

carga.html         → ADMIN (sin restricciones)
  └─ main.js       → Sin identificación

admin.html         → ADMIN (gestión)
  └─ admin.js      → Sin identificación
```
