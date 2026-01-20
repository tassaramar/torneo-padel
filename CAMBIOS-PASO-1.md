# Cambios realizados - Paso 1

## ✅ Cambios aplicados

### Identificación movida de `main.js` (carga) a `viewer.js` (viewer)

**Archivos modificados:**

1. **`src/main.js`** - REVERTIDO al estado original
   - ❌ Sin flujo de identificación
   - ✅ Página de carga para admin (sin restricciones)

2. **`src/viewer.js`** - AGREGADO flujo de identificación
   - ✅ Check de identidad al inicio
   - ✅ Si no está identificado → muestra flujo
   - ✅ Si ya está identificado → carga viewer directo

3. **`PASO-1-IDENTIFICACION.md`** - Documentación actualizada
   - Refleja que la identificación está en viewer, no en carga
   - Instrucciones de testing actualizadas

---

## 📄 Páginas de la app

### **`/carga.html`** → Página de CARGA (admin)
- **Propósito:** Administrador carga resultados de TODOS los partidos
- **Acceso:** Sin identificación requerida
- **Funcionalidad:** 
  - Ver todos los partidos (pendientes/jugados)
  - Cargar resultados de cualquier partido
  - Gestionar copas
  - Ver tabla de posiciones
- **Archivo JS:** `src/main.js`

### **`/` o `/index.html`** → Página de VIEWER (usuarios)
- **Propósito:** Usuarios visualizan el torneo
- **Acceso:** **REQUIERE identificación** (Paso 1 implementado)
- **Funcionalidad actual:**
  - Primera visita → flujo de identificación
  - Ver grupos y posiciones
  - Ver partidos del torneo
  - Ver copas y brackets
- **Funcionalidad futura (Paso 2):**
  - Vista personalizada por pareja
  - Ver solo sus partidos
  - Cargar solo sus resultados
  - Confirmar/revisar resultados
- **Archivo JS:** `src/viewer.js`

---

## 🧪 Cómo probar

### Testing del viewer (con identificación):

```bash
npm run dev
```

1. Abrí `http://localhost:5173/` (o `/index.html`)
2. Deberías ver: "🎾 ¿Quién sos?"
3. Buscá un nombre (ej: "Ari")
4. Seleccioná el correcto
5. Elegí compañero correcto → ✅ Viewer carga
6. Recargá → debería entrar directo (sin identificación)

### Testing de la carga (sin identificación):

```bash
npm run dev
```

1. Abrí `http://localhost:5173/carga.html`
2. Debería cargar DIRECTAMENTE la página de carga
3. No pide identificación
4. Ves todos los partidos

### Limpiar identidad:

```javascript
// En consola del navegador
localStorage.removeItem('torneo_identidad');
location.reload();
```

---

## 📊 Estado actual

| Funcionalidad | Estado | Página |
|--------------|--------|---------|
| Identificación de usuario | ✅ Implementado | index.html (viewer) |
| Carga admin sin restricción | ✅ Funciona | carga.html |
| Vista personalizada | ❌ Pendiente (Paso 2) | - |
| Carga por pareja | ❌ Pendiente (Paso 3) | - |
| Sistema confirmaciones | ❌ Pendiente (Paso 4) | - |

---

## 🔄 Próximos pasos

**Paso 2:** Vista personalizada en viewer
- Mostrar solo partidos de la pareja identificada
- Mostrar su posición en la tabla
- Agregar botón "Cambiar de pareja" en el header
- Destacar visualmente sus partidos pendientes

**Paso 3:** Carga de resultados por pareja
- Permitir que usuarios identific ados carguen resultados
- Solo pueden cargar sus propios partidos
- Estados: pendiente → a confirmar → confirmado

**Paso 4:** Sistema de confirmaciones
- Primera pareja carga → estado "a confirmar"
- Segunda pareja confirma o rechaza
- Flujo de revisión cuando no coinciden
