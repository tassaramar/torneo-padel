# Paso 1: Identificación de Pareja ✅

## ¿Qué se implementó?

Se agregó un sistema de identificación de usuarios basado en búsqueda de nombre y validación con compañero.

### Archivos creados:

1. **`src/identificacion/identidad.js`**
   - Lógica de negocio: parseo de jugadores, localStorage, validaciones
   - Funciones principales:
     - `parseJugadores()` - Convierte parejas en jugadores individuales
     - `getIdentidad()` - Lee identidad guardada
     - `saveIdentidad()` - Guarda en localStorage
     - `clearIdentidad()` - Limpia localStorage
     - `generarOpcionesCompanero()` - Genera 3 opciones para validación

2. **`src/identificacion/ui.js`**
   - UI del flujo de identificación
   - Pantallas:
     - Búsqueda de jugador (con filtrado en tiempo real)
     - Selección de compañero (3 botones)
     - Éxito (confirmación)
     - Error (reintentar u volver)

3. **`style.css`** (modificado)
   - Estilos para las pantallas de identificación

4. **`src/viewer.js`** (modificado)
   - Integración del flujo de identificación en la página de visualización
   - Función `checkIdentidadYCargar()` que:
     - Verifica si hay identidad guardada
     - Si hay → carga viewer normal
     - Si no hay → muestra flujo de identificación
   
   **Nota:** `src/main.js` (página de carga) NO tiene identificación. Es solo para administradores.

---

## Cómo funciona

### Primera visita (sin identidad guardada):

```
1. Usuario entra al sitio
   ↓
2. checkIdentidadYCargar() verifica localStorage → null
   ↓
3. Carga parejas desde Supabase
   ↓
4. Muestra pantalla: "¿Quién sos?"
   ↓
5. Usuario busca su nombre → ve resultados
   ↓
6. Selecciona su nombre
   ↓
7. Pantalla: "¿Quién es tu compañero?" (3 opciones)
   ↓
8. Selecciona compañero correcto
   ↓
9. ✅ Guarda en localStorage
   ↓
10. Carga la app normal
```

### Próximas visitas (con identidad guardada):

```
1. Usuario entra al sitio
   ↓
2. checkIdentidadYCargar() verifica localStorage → identidad encontrada
   ↓
3. 🚀 Carga directo la app normal (sin pasar por identificación)
```

---

## Datos guardados en localStorage

**Key:** `torneo_identidad`

**Estructura:**
```json
{
  "parejaId": "uuid-xxx",
  "parejaNombre": "Ari Kan - Martin G",
  "miNombre": "Ari Kan",
  "companero": "Martin G",
  "grupo": "A",
  "orden": 5,
  "validatedAt": "2026-01-19T..."
}
```

---

## Cómo probar

### 1. Modo desarrollo (localhost):

```bash
npm run dev
```

**Páginas:**
- **`/carga.html`** → Carga (admin, sin identificación)
- **`/` o `/index.html`** → Viewer (usuarios, CON identificación)

Abrí `/` (index.html):
- Primera vez → deberías ver "🎾 ¿Quién sos?"
- Buscá tu nombre (o cualquiera de la lista)
- Seleccioná compañero correcto → debería guardar y cargar viewer
- Recargá la página → debería ir directo al viewer (sin identificación)

### 2. Limpiar identidad (para re-testear):

**Opción A: Desde consola del navegador:**
```javascript
localStorage.removeItem('torneo_identidad');
location.reload();
```

**Opción B: DevTools:**
- Abrí DevTools (F12)
- Application → Local Storage → tu dominio
- Borrá `torneo_identidad`
- Recargá

### 3. Testear flujos de error:

- Elegí compañero incorrecto → deberías ver error
- Probá "Elegir otro compañero" → genera nuevas opciones
- Probá "No soy [nombre]" → vuelve a búsqueda

---

## Estado actual

✅ **Lo que funciona:**
- Identificación completa (búsqueda + validación) **en index.html (viewer)**
- Guardado en localStorage
- Re-ingreso automático
- Viewer sigue funcionando normal después de identificarse
- **Página de carga (carga.html) NO requiere identificación** (para admin)

❌ **Lo que NO está implementado aún (próximos pasos):**
- Vista personalizada (por ahora ve la app normal)
- Carga de resultados limitada a su pareja
- Sistema de confirmaciones dobles
- Botón "Cambiar de pareja" en el UI

---

## Próximo paso (Paso 2)

Cuando estés listo, el **Paso 2** sería:
- Crear vista personalizada para usuario identificado
- Mostrar sus próximos partidos
- Mostrar sus últimos resultados
- Agregar botón "Cambiar de pareja"

**Diferencia con ahora:**
- Ahora: usuario identificado ve el viewer normal (todos los grupos/partidos)
- Después: verá solo info relevante para su pareja (sus partidos, su posición, etc.)

---

## Notas técnicas

### Compatibilidad
- Funciona en todos los navegadores modernos
- No requiere cambios en la base de datos (por ahora)
- No rompe la funcionalidad actual

### Limitaciones conocidas
- Si borra cache/cookies, debe identificarse de nuevo
- No funciona cross-device (cada dispositivo debe identificarse)
- Los datos se almacenan solo en el navegador (no en servidor)

### Seguridad
- No hay seguridad real (es intencional según requerimientos)
- Solo previene errores accidentales, no intencionales
- Cualquiera puede ver el localStorage y editarlo (está OK)
