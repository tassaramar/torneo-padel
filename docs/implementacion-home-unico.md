# Implementación Home Único

**Fecha:** 2026-01-30  
**Basado en:** `docs/home-unico-especificacion.md`

## Resumen

Se implementó el **Home Único**, una pantalla que permite al jugador operar el torneo desde un solo lugar, minimizando navegación y maximizando autogestión.

## Cambios realizados

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `index.html` | Reestructurado para el nuevo layout. Contenedor `#home-content` + modal full-screen |
| `src/personal.js` | Integración de módulos de presentismo y modal. Event listeners para Home Único |
| `src/viewer/vistaPersonal.js` | Nuevo layout con 5 bloques: Quién soy, Partidos pendientes, Dashboard, Acciones con contador, Botón consulta |
| `style.css` | Estilos para Home Único, presentismo, modal full-screen, botones con contador |

### Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `src/viewer/presentismo.js` | Lógica de marcar presencia por pareja (localStorage) |
| `src/viewer/modalConsulta.js` | Modal full-screen con tabs (Mi grupo, Otros grupos, Fixture) |

## Arquitectura del Home Único

```
┌────────────────────────────────────────┐
│  1. QUIÉN SOY (header colapsable)      │
│     - Pareja + Grupo                   │
│     - Estado de presentismo            │
│     - Acciones: Estoy / Ambos / Desmar │
│     [Colapsa automáticamente al compl] │
├────────────────────────────────────────┤
│  2. MIS PARTIDOS PENDIENTES            │
│     - Ordenados por ronda (fixture)    │
│     - Tarjeta con acción "Cargar"      │
│     - Bloqueados si pareja incompleta  │
├────────────────────────────────────────┤
│  3. DASHBOARD                          │
│     [Posición] [Pendientes] [Jugados]  │
├────────────────────────────────────────┤
│  4. ACCIONES CON CONTADOR (si >0)      │
│     [🔴 Disputas (N)] [🔔 Confirmar(M)]│
├────────────────────────────────────────┤
│  5. BOTÓN CONSULTA                     │
│     [📊 Tablas / Grupos]               │
│     → Abre modal full-screen           │
└────────────────────────────────────────┘
```

## Sistema de Presentismo

El presentismo está almacenado en **Supabase** utilizando el campo `presentes` en la tabla `parejas`:

```sql
-- Estructura en BD
ALTER TABLE public.parejas
ADD COLUMN IF NOT EXISTS presentes TEXT[] DEFAULT '{}';

-- Ejemplo de datos
presentes = ['Tincho', 'Max']  -- ambos presentes
presentes = ['Tincho']         -- solo uno presente
presentes = []                 -- ninguno presente
```

**Migraciones aplicadas**:
- `20260130010000_add_presentes_to_parejas.sql` - Agrega campo `presentes TEXT[]`
- `20260130020000_add_presentismo_activo_to_torneos.sql` - Agrega flag `presentismo_activo BOOLEAN` a torneos

### Funciones disponibles (src/viewer/presentismo.js)

Todas las funciones usan Supabase:

- `obtenerPresentes(parejaId)` → Promise<string[]>
- `marcarPresente(parejaId, nombre)` → Promise<boolean>
- `marcarAmbosPresentes(parejaId, nombre1, nombre2)` → Promise<boolean>
- `desmarcarPresente(parejaId, nombre)` → Promise<boolean>
- `desmarcarTodos(parejaId)` → Promise<boolean>
- `estaPresente(presentes, nombre)` → boolean
- `parejaCompleta(presentes, nombre1, nombre2)` → boolean
- `estadoPresentismo(presentes, miNombre, companero)` → { estado, yoPresente, companeroPresente }

### LocalStorage (solo UX)

LocalStorage se usa únicamente para mejorar UX (no para sincronizar datos):

```javascript
// Key: presentismo_toast_visto_{torneoId}_{parejaId}
// Valor: 'true' si el usuario ya vio el toast de presentismo
```

Funciones auxiliares:
- `toastYaVisto(torneoId, parejaId)` → boolean
- `marcarToastVisto(torneoId, parejaId)`
- `limpiarToastVisto(torneoId, parejaId)`

## Modal de Consulta

El modal full-screen tiene 3 tabs:

1. **Mi grupo**: Tabla de posiciones + partidos del grupo del usuario
2. **Otros grupos**: Selector de grupo + tabla + partidos
3. **Fixture**: Cola de partidos pendientes ordenados

### Navegación

- Abrir: Botón "Tablas/Grupos" en el Home
- Cerrar: Botón ✕, ESC, o click fuera del modal
- Cerrar siempre vuelve al Home (no navega)

## Cómo probar

### Flujo básico

1. Abrir `http://localhost:5173/`
2. Identificarse (si no está identificado)
3. Verificar que aparezca el bloque "Quién soy" con el estado de presentismo
4. Marcar "Estoy" o "Estamos los dos"
5. Verificar que el panel se colapse automáticamente al completar la pareja
6. Verificar que los partidos pendientes estén habilitados
7. Hacer clic en "Cargar resultado" y completar el flujo
8. Verificar que el botón "Tablas/Grupos" abra el modal
9. Navegar por los tabs del modal
10. Cerrar el modal y verificar que vuelva al Home

### Casos especiales

- **Pareja incompleta**: Los partidos aparecen bloqueados con mensaje
- **Disputas**: Si hay disputas, aparece el botón rojo con contador
- **Confirmaciones**: Si hay resultados por confirmar, aparece el botón naranja

### URLs de prueba

- Home: `http://localhost:5173/`
- Fixture (separado): `http://localhost:5173/fixture`
- General (todos los grupos): `http://localhost:5173/general`

## Decisiones de implementación

1. **Presentismo en localStorage**: Rápido de implementar, pero no sincroniza entre dispositivos. Se puede migrar a BD después.

2. **Modal en lugar de navegación**: Cumple con el requisito "consultas en modal, no navegación".

3. **Orden de partidos**: Se usa el campo `ronda` de la BD, que es consistente con `fixture.html`.

4. **Responsive**: Diseñado mobile-first para usuarios +40 años (botones grandes, fuentes legibles).

## Compatibilidad

- Las páginas existentes (`/fixture`, `/general`, `/admin`) siguen funcionando sin cambios.
- El Home Único reemplaza el comportamiento anterior de `index.html`.

## Próximos pasos sugeridos

1. Migrar presentismo a BD para sincronización entre dispositivos
2. Agregar notificación push cuando el compañero marca presente
3. Integrar con la pantalla de admin `presente.html` para ver quiénes están presentes
