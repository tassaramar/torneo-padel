# Test Cases Detallados - Smoke Test Torneo Pádel

## Índice
- [TC-001 a TC-005: Jugador/Viewer (CRÍTICO)](#jugadorviewer---prioridad-crítica)
- [TC-006 a TC-008: Cargador de Resultados (CRÍTICO)](#cargador-de-resultados---prioridad-crítica)
- [TC-009 a TC-012: Administrador (ALTA)](#administrador---prioridad-alta)
- [TC-013: Vista General (MEDIA)](#vista-general---prioridad-media)
- [TC-014: Analytics (MEDIA)](#analytics---prioridad-media)
- [TC-015 a TC-016: Integridad de Datos (ALTA)](#integridad-de-datos---prioridad-alta)
- [TC-017 a TC-018: UX/UI (MEDIA)](#uxui---prioridad-media)
- [TC-019: Performance (MEDIA)](#performance---prioridad-media)

---

## JUGADOR/VIEWER - Prioridad: CRÍTICA

### TC-001: Identificación de Jugador

**Rol**: Jugador/Viewer  
**Prioridad**: Crítica  
**Pre-condiciones**: 
- Sistema tiene al menos 4 parejas registradas
- localStorage vacío o sin identidad previa

**Pasos**:
1. Navegar a `https://torneo-padel-teal.vercel.app/` o `http://localhost:5173/`
2. Verificar que aparece la pantalla "¿Quién sos?"
3. En el campo de búsqueda, escribir parte de un nombre de jugador (ej: "Ari")
4. Verificar que aparecen sugerencias de jugadores
5. Seleccionar un jugador de la lista
6. Verificar que aparecen opciones de compañeros para formar pareja
7. Seleccionar el compañero correcto
8. Verificar que la identidad se guarda y la vista cambia

**Resultado Esperado**: 
- Pantalla de identificación se muestra correctamente
- Búsqueda muestra resultados relevantes
- Al seleccionar jugador y compañero, se guarda en localStorage
- Vista personalizada se carga con el nombre de la pareja en el header
- Se registra un evento de tracking tipo "visita" en la tabla tracking_eventos

**Validaciones DB**:
```sql
-- Debe existir un evento de tracking reciente
SELECT * FROM tracking_eventos 
WHERE tipo_evento = 'visita' 
AND jugador_nombre LIKE '%[nombre seleccionado]%'
ORDER BY created_at DESC LIMIT 1;
```

**Validaciones LocalStorage**:
```javascript
const identidad = JSON.parse(localStorage.getItem('torneo_identidad'));
// Debe tener: jugadorNombre, companeroNombre, parejaId, parejaNombre, grupoId, grupoNombre
```

---

### TC-002: Vista Personalizada de Partidos

**Rol**: Jugador/Viewer  
**Prioridad**: Crítica  
**Pre-condiciones**: 
- Identidad guardada en localStorage (ejecutar TC-001 primero)
- La pareja seleccionada tiene al menos 3 partidos en diferentes estados

**Pasos**:
1. Con identidad ya guardada, recargar la página `/`
2. Verificar que NO se pide identificación nuevamente
3. Verificar que el header muestra el nombre de la pareja
4. Verificar que aparece el botón "Cambiar de pareja"
5. Verificar que los partidos están agrupados en secciones según estado:
   - "Por cargar" (estado null o 'pendiente')
   - "Por confirmar" (estado 'a_confirmar')
   - "Partidos confirmados" (estado 'confirmado')
   - "Partidos en revisión" (estado 'en_revision')
6. Verificar que SOLO se muestran partidos de la pareja identificada
7. Verificar que existe botón "Ver todos los grupos"

**Resultado Esperado**: 
- Vista personalizada muestra solo partidos de la pareja identificada
- Partidos correctamente agrupados por estado
- Secciones con estilos diferenciados por prioridad
- Si hay partidos pendientes (por confirmar o en revisión), aparece alerta amarilla en la parte superior

**Validaciones**:
- Contar partidos en cada sección y verificar contra DB
- Verificar que no aparecen partidos de otras parejas

---

### TC-003: Carga de Resultado - Primera Carga

**Rol**: Jugador/Viewer  
**Prioridad**: Crítica  
**Pre-condiciones**: 
- Identidad guardada (TC-001)
- Existe al menos 1 partido pendiente (sin resultado) para la pareja identificada

**Pasos**:
1. En la sección "Por cargar", localizar un partido sin resultado
2. Click en el botón "Cargar resultado" del partido
3. Verificar que se abre un modal
4. Verificar que el modal muestra:
   - Nombres de ambas parejas
   - Indicación visual de cuál es "tu pareja"
   - Dos inputs para ingresar games (uno por pareja)
5. Ingresar un resultado válido (ej: 6 para tu pareja, 4 para la otra)
6. Click en "Guardar resultado"
7. Verificar mensaje de confirmación: "Resultado cargado. Esperando confirmación."
8. Verificar que el modal se cierra
9. Verificar que el partido ahora aparece en la sección "Por cargar" con badge "Esperando confirmación"

**Resultado Esperado**: 
- Modal se abre y cierra correctamente
- Resultado se guarda en la base de datos
- Estado del partido cambia a 'a_confirmar'
- Campo `cargado_por_pareja_id` contiene el ID de la pareja que cargó
- Se registra evento de tracking tipo "carga_resultado"
- Vista se actualiza sin necesidad de recargar

**Validaciones DB**:
```sql
SELECT estado, games_a, games_b, cargado_por_pareja_id, updated_at
FROM partidos 
WHERE id = '[partido_id]';
-- Debe mostrar: estado='a_confirmar', games con valores ingresados, cargado_por_pareja_id=[UUID]

SELECT * FROM tracking_eventos 
WHERE tipo_evento = 'carga_resultado' 
AND metadata->>'partido_id' = '[partido_id]'
ORDER BY created_at DESC LIMIT 1;
-- Debe existir el evento
```

---

### TC-004: Confirmación de Resultado (Coincidente)

**Rol**: Jugador/Viewer  
**Prioridad**: Crítica  
**Pre-condiciones**: 
- Existe un partido con estado 'a_confirmar' (ejecutar TC-003 primero)
- Identificarse como la OTRA pareja del partido

**Pasos**:
1. Click en "Cambiar de pareja" o limpiar localStorage y re-identificarse como la otra pareja
2. Verificar que aparece alerta amarilla: "⚠️ 1 resultado requiere tu atención" (o número correspondiente)
3. Localizar el partido en la sección "Por confirmar"
4. Verificar que muestra el resultado ya cargado (ej: "6 - 4")
5. Click en "Confirmar este resultado"
6. En el modal, ingresar el MISMO resultado (6 - 4)
7. Click en "Guardar resultado"
8. Verificar mensaje: "¡Resultado confirmado! Ambas parejas coinciden."
9. Verificar que el partido se mueve a "Partidos confirmados"
10. Verificar que la alerta de pendientes desaparece (o se actualiza el contador)

**Resultado Esperado**: 
- Alerta de pendientes se muestra correctamente
- Partido aparece en sección "Por confirmar" con resultado pre-cargado
- Al confirmar con mismo resultado, estado cambia a 'confirmado'
- Partido desaparece de pendientes y aparece en confirmados
- Se registra evento de tracking

**Validaciones DB**:
```sql
SELECT estado, games_a, games_b
FROM partidos 
WHERE id = '[partido_id]';
-- Debe mostrar: estado='confirmado'
```

---

### TC-005: Conflicto de Resultado (No Coincidente)

**Rol**: Jugador/Viewer  
**Prioridad**: Crítica  
**Pre-condiciones**: 
- Existe un partido con estado 'a_confirmar'
- Identificarse como la OTRA pareja del partido

**Pasos**:
1. Identificarse como la pareja que NO cargó el resultado original
2. Localizar el partido en "Por confirmar"
3. Click en "Cargar resultado diferente" (o el botón equivalente)
4. Ingresar un resultado DIFERENTE al pre-cargado (ej: si era 6-4, ingresar 4-6)
5. Click en "Guardar resultado"
6. Verificar mensaje: "Los resultados no coinciden. El partido pasó a revisión."
7. Verificar que el partido aparece en "Partidos en revisión"
8. Verificar que muestra AMBOS resultados lado a lado
9. Verificar opciones disponibles:
   - "Aceptar resultado de [otra pareja]"
   - "Volver a cargar mi resultado"
   - "Pedir ayuda al admin"

**Resultado Esperado**: 
- Conflicto se detecta correctamente
- Estado cambia a 'en_revision'
- Campos `resultado_temp_a` y `resultado_temp_b` guardan el resultado alternativo
- Ambos resultados son visibles en la UI
- Opciones de resolución disponibles

**Validaciones DB**:
```sql
SELECT estado, games_a, games_b, resultado_temp_a, resultado_temp_b
FROM partidos 
WHERE id = '[partido_id]';
-- estado='en_revision', games_a/b con primer resultado, resultado_temp_a/b con segundo resultado
```

**Validaciones de Gestión de Conflicto**:
10. Probar opción "Pedir ayuda al admin"
11. Ingresar mensaje opcional
12. Verificar que se guarda en campo `notas_revision`

```sql
SELECT notas_revision FROM partidos WHERE id = '[partido_id]';
-- Debe contener el mensaje ingresado
```

---

## CARGADOR DE RESULTADOS - Prioridad: CRÍTICA

### TC-006: Vista de Carga General

**Rol**: Cargador de Resultados  
**Prioridad**: Crítica  
**Pre-condiciones**: 
- Existe al menos 1 partido en cada estado posible

**Pasos**:
1. Navegar a `/carga`
2. Verificar que la página carga correctamente
3. Verificar que existen tabs para "Grupos" y "Copas"
4. Verificar que los partidos se muestran agrupados
5. Si existe al menos 1 partido en estado 'en_revision', verificar que aparece sección roja en la parte superior: "⚠️ Partidos en revisión (X)"
6. Click en diferentes tabs y verificar que cambia el contenido

**Resultado Esperado**: 
- Página carga sin errores
- Tabs funcionan correctamente
- Sección de revisión aparece cuando hay conflictos
- Todos los partidos son visibles (no filtrados por pareja)

---

### TC-007: Carga Directa de Admin

**Rol**: Cargador de Resultados  
**Prioridad**: Crítica  
**Pre-condiciones**: 
- Existe al menos 1 partido pendiente

**Pasos**:
1. En `/carga`, localizar un partido sin resultado
2. Click en editar/cargar resultado
3. Ingresar un resultado válido (ej: 6 - 4)
4. Guardar
5. Verificar que el resultado se guarda

**Resultado Esperado**: 
- Resultado se guarda como 'confirmado' directo (NO pasa por 'a_confirmar')
- Admin bypasea el sistema de confirmación
- No requiere que la otra pareja confirme

**Validaciones DB**:
```sql
SELECT estado, games_a, games_b, cargado_por_pareja_id
FROM partidos 
WHERE id = '[partido_id]';
-- estado='confirmado', cargado_por_pareja_id=null (porque admin no se identifica como pareja)
```

---

### TC-008: Resolución de Conflictos por Admin

**Rol**: Cargador de Resultados  
**Prioridad**: Crítica  
**Pre-condiciones**: 
- Existe al menos 1 partido en estado 'en_revision' con resultados diferentes
- Opcionalmente, tiene notas de jugadores

**Pasos**:
1. En `/carga`, verificar que la sección "Partidos en revisión" es visible
2. Localizar el partido en conflicto
3. Verificar que se muestran AMBOS resultados:
   - Primera carga: games_a / games_b
   - Segunda carga: resultado_temp_a / resultado_temp_b
4. Si hay notas, verificar que son visibles
5. Probar opción "Aceptar primera carga"
6. Verificar que el conflicto se resuelve

**Resultado Esperado**: 
- Admin puede ver ambos resultados claramente
- Puede leer notas de los jugadores
- Al aceptar primera carga:
  - estado cambia a 'confirmado'
  - Se mantienen games_a / games_b
  - resultado_temp_a / resultado_temp_b se limpian o mantienen para historial
- Partido desaparece de la sección de revisión

**Validaciones DB**:
```sql
SELECT estado, games_a, games_b FROM partidos WHERE id = '[partido_id]';
-- estado='confirmado'
```

**Pasos Alternativos**:
7. Repetir con otro partido en revisión, probando "Aceptar segunda carga"
8. Verificar que se usan los valores de resultado_temp

**Pasos Alternativos 2**:
9. Repetir con otro partido, probando "Ingresar resultado correcto"
10. Ingresar un resultado manual diferente a ambos
11. Verificar que se guarda el nuevo resultado

---

## ADMINISTRADOR - Prioridad: ALTA

### TC-009: Gestión de Parejas - Import desde Excel

**Rol**: Administrador  
**Prioridad**: Alta  
**Pre-condiciones**: 
- Acceso a `/admin`
- MODO SEGURO: Este test puede ser destructivo. Se recomienda ejecutar en ambiente de desarrollo.

**Pasos**:
1. Navegar a `/admin`
2. Expandir sección "🧰 Setup previo (antes del torneo)"
3. Localizar textarea con placeholder para pegar datos
4. Preparar datos de prueba en formato: `Nombre1 - Nombre2[TAB]Grupo`
```
Ejemplo:
Mauri - Diego	a
Gaby - Chiqui	a
Tincho - Sebi	b
Marian - Uri	b
```
5. Pegar los datos en el textarea
6. Click en "👀 Previsualizar"
7. Verificar que se muestra preview con:
   - Cantidad de parejas detectadas
   - Grupos detectados
   - Posibles errores de formato
8. Si todo está OK, verificar que hay advertencia: "⚠️ Importar borra y recrea..."
9. Verificar que el modo seguro está activo (botón import deshabilitado)
10. Desbloquear modo seguro (checkbox "Desbloquear acciones peligrosas")
11. Click en "💣 Importar (borra y recrea)"
12. Confirmar acción
13. Verificar que se muestra mensaje de éxito

**Resultado Esperado**: 
- Preview parsea correctamente el formato TAB
- Detecta errores de formato (si los hay)
- Modo seguro previene ejecución accidental
- Import borra datos previos y crea nuevos registros
- Grupos, parejas y partidos de grupo se generan correctamente

**Validaciones DB**:
```sql
-- Verificar parejas creadas
SELECT nombre, orden FROM parejas WHERE torneo_id = '[torneo_id]' ORDER BY orden;

-- Verificar grupos
SELECT nombre FROM grupos WHERE torneo_id = '[torneo_id]' ORDER BY nombre;

-- Verificar que se generaron partidos de grupo
SELECT COUNT(*) FROM partidos WHERE grupo_id IS NOT NULL AND torneo_id = '[torneo_id]';
```

---

### TC-010: Gestión de Grupos - Ranking y Ordenamiento Manual

**Rol**: Administrador  
**Prioridad**: Alta  
**Pre-condiciones**: 
- Existen grupos con parejas asignadas
- Al menos 2 partidos del mismo grupo tienen resultados

**Pasos**:
1. En `/admin`, sección "Cierre de grupos"
2. Localizar un grupo con resultados cargados
3. Verificar que la tabla de posiciones muestra:
   - Nombre de pareja
   - PJ (partidos jugados)
   - PG (partidos ganados)
   - PP (partidos perdidos)
   - GF (games a favor)
   - GC (games en contra)
   - Dif (diferencia)
   - Puntos
4. Verificar que el ordenamiento por defecto es correcto (por puntos, luego diferencia)
5. Localizar botones ▲▼ junto a cada pareja
6. Click en ▲ de una pareja para subirla manualmente
7. Verificar que el orden cambia en la UI
8. Recargar página y verificar que el orden manual persiste

**Resultado Esperado**: 
- Tabla calcula estadísticas correctamente
- Ordenamiento automático funciona
- Botones de ordenamiento manual funcionan
- Cambio se persiste en tabla `posiciones_manual`

**Validaciones DB**:
```sql
SELECT pareja_id, orden_manual 
FROM posiciones_manual 
WHERE grupo_id = '[grupo_id]' 
ORDER BY orden_manual;
```

---

### TC-011: Gestión de Copas - Asignación Automática Incremental

**Rol**: Administrador  
**Prioridad**: Alta  
**Pre-condiciones**: 
- Existen copas creadas (al menos 2)
- Al menos 1 grupo tiene todos sus partidos completados
- Grupos terminados NO tienen parejas ya asignadas a copas

**Pasos**:
1. En `/admin`, sección "Copas"
2. Click en "🔄 Refrescar Vista"
3. Verificar que se muestra el estado actual de copas
4. Click en "🤖 Asignar Grupos Terminados"
5. Verificar que el sistema detecta automáticamente grupos completados
6. Si hay 2 equipos disponibles para una copa, verificar que muestra modal de confirmación
7. Si hay 4 equipos disponibles, verificar que propone generar 2 semifinales con sistema de bombos
8. Confirmar la acción
9. Verificar que las parejas se asignan a las copas correspondientes
10. Verificar que se crean los partidos de copa (si aplica)

**Resultado Esperado**: 
- Sistema detecta inteligentemente grupos terminados
- No asigna parejas ya asignadas (incremental)
- Genera partidos de copa según cantidad de equipos disponibles
- No duplica partidos existentes
- Parejas quedan marcadas en campo `copa_asignada_id`

**Validaciones DB**:
```sql
-- Verificar asignaciones
SELECT id, nombre, copa_asignada_id FROM parejas WHERE copa_asignada_id IS NOT NULL;

-- Verificar partidos de copa creados
SELECT id, ronda_copa, orden_copa FROM partidos WHERE copa_id IS NOT NULL ORDER BY orden_copa;
```

---

### TC-012: Modo Seguro

**Rol**: Administrador  
**Prioridad**: Alta  
**Pre-condiciones**: 
- Acceso a `/admin`

**Pasos**:
1. Navegar a `/admin`
2. Verificar que en la parte superior existe el control de "Modo seguro"
3. Verificar que el checkbox "Desbloquear acciones peligrosas" está DESMARCADO por defecto
4. Verificar que el badge muestra "Modo seguro"
5. Intentar click en un botón marcado como peligroso (ej: "💣 Importar", "🔄 Reset partidos")
6. Verificar que el botón está deshabilitado o muestra advertencia
7. Marcar el checkbox "Desbloquear acciones peligrosas"
8. Verificar que el badge cambia a "Modo peligroso" (o similar)
9. Verificar que los botones peligrosos ahora están habilitados
10. Intentar ejecutar una acción peligrosa
11. Verificar que muestra confirmación adicional (confirm dialog)

**Resultado Esperado**: 
- Modo seguro activo por defecto
- Botones peligrosos deshabilitados
- Al desbloquear, botones se habilitan
- Confirmaciones adicionales para acciones destructivas
- Protección contra ejecución accidental

---

## VISTA GENERAL - Prioridad: MEDIA

### TC-013: Vista Pública de Todos los Resultados

**Rol**: Visualizador Público  
**Prioridad**: Media  
**Pre-condiciones**: 
- Existen partidos en al menos 2 grupos
- Existen partidos de copa (opcional)

**Pasos**:
1. Navegar a `/general`
2. Verificar que la página carga sin pedir identificación
3. Verificar que existen tabs para cada grupo (A, B, C, D, etc.)
4. Click en diferentes tabs de grupos
5. Verificar que cada tab muestra los partidos del grupo correspondiente
6. Verificar que los partidos muestran:
   - Nombres de ambas parejas
   - Resultado (si está cargado)
   - Estado visual (pendiente, confirmado, etc.)
7. Si existen partidos de copa, verificar que hay tab o sección de "Copas"
8. Verificar que existe botón "Ver mis partidos" o similar
9. Click en "Ver mis partidos"
10. Verificar que redirige a `/` (vista personal)

**Resultado Esperado**: 
- Vista pública accesible sin identificación
- Todos los partidos visibles (no filtrados)
- Tabs de grupos funcionan correctamente
- Partidos ordenados lógicamente (por ronda, orden)
- Navegación a vista personal funciona

---

## ANALYTICS - Prioridad: MEDIA

### TC-014: Dashboard de Analytics

**Rol**: Visualizador de Analytics  
**Prioridad**: Media  
**Pre-condiciones**: 
- Existen eventos de tracking en la tabla tracking_eventos
- Al menos 3 jugadores diferentes han visitado la app
- Al menos 2 resultados han sido cargados

**Pasos**:
1. Navegar a `/analytics`
2. Verificar que la página carga correctamente
3. Verificar que existen 6 tarjetas de métricas:
   - Jugadores activos
   - Visitas totales
   - Resultados cargados
   - Promedio visitas/jugador
   - Parejas activas
   - Eventos totales
4. Verificar que cada tarjeta muestra un número (no "0" o "NaN")
5. Localizar el selector de periodo (7, 14, 30, 90 días)
6. Cambiar el periodo a "Últimos 7 días"
7. Verificar que las métricas se actualizan
8. Localizar el gráfico de "Timeline de Actividad"
9. Verificar que el gráfico se renderiza (canvas con líneas)
10. Localizar la tabla de "Ranking de Actividad por Jugador"
11. Verificar que muestra lista de jugadores con:
    - Número de ranking
    - Estado/indicador de actividad (🔥, ✅, 👀, ⚠️)
    - Nombre de jugador
    - Nombre de pareja
    - Grupo
    - Cantidad de visitas
    - Cantidad de cargas
    - Total de eventos
    - Última actividad (tiempo relativo)
12. En el campo de búsqueda, escribir parte de un nombre
13. Verificar que la tabla se filtra
14. Localizar el "Feed de Actividad Reciente"
15. Verificar que muestra eventos en orden cronológico descendente

**Resultado Esperado**: 
- Dashboard carga sin errores
- Métricas calculadas correctamente
- Timeline visualiza datos
- Ranking ordenado por actividad total (descendente)
- Búsqueda filtra correctamente
- Tiempos relativos se calculan bien ("hace 2h", "ayer", etc.)
- Feed muestra eventos formateados legiblemente

**Validaciones**:
- Comparar números de tarjetas con queries directas a DB
- Verificar que el ranking coincide con conteos reales

```sql
-- Verificar eventos totales
SELECT COUNT(*) FROM tracking_eventos;

-- Verificar jugadores únicos
SELECT COUNT(DISTINCT jugador_nombre) FROM tracking_eventos;

-- Top jugadores
SELECT jugador_nombre, COUNT(*) as total
FROM tracking_eventos
GROUP BY jugador_nombre
ORDER BY total DESC
LIMIT 5;
```

---

## INTEGRIDAD DE DATOS - Prioridad: ALTA

### TC-015: Validaciones de Base de Datos

**Rol**: Validación Técnica  
**Prioridad**: Alta  
**Pre-condiciones**: Sistema en cualquier estado

**Validaciones**:

1. **Integridad Referencial**
```sql
-- Verificar que todas las parejas tienen torneo válido
SELECT p.id FROM parejas p 
LEFT JOIN torneos t ON p.torneo_id = t.id 
WHERE t.id IS NULL;
-- Resultado esperado: 0 filas

-- Verificar que todos los partidos tienen parejas válidas
SELECT p.id FROM partidos p 
LEFT JOIN parejas pa ON p.pareja_a_id = pa.id 
WHERE pa.id IS NULL;
-- Resultado esperado: 0 filas

SELECT p.id FROM partidos p 
LEFT JOIN parejas pb ON p.pareja_b_id = pb.id 
WHERE pb.id IS NULL;
-- Resultado esperado: 0 filas
```

2. **Estados Válidos**
```sql
-- Verificar que todos los estados de partidos son válidos
SELECT DISTINCT estado FROM partidos;
-- Resultado esperado: solo null, 'pendiente', 'a_confirmar', 'confirmado', 'en_revision'
```

3. **Timestamps**
```sql
-- Verificar que updated_at se actualiza
SELECT id, games_a, games_b, updated_at 
FROM partidos 
WHERE games_a IS NOT NULL 
AND updated_at < created_at;
-- Resultado esperado: 0 filas (updated_at >= created_at siempre)
```

4. **Tracking Eventos**
```sql
-- Verificar que eventos de carga tienen metadata completa
SELECT * FROM tracking_eventos 
WHERE tipo_evento = 'carga_resultado' 
AND (metadata->>'partido_id' IS NULL OR metadata->>'resultado' IS NULL);
-- Resultado esperado: 0 filas
```

**Resultado Esperado**: Todas las validaciones pasan sin errores de integridad

---

### TC-016: Consistencia de Datos

**Rol**: Validación Técnica  
**Prioridad**: Alta  
**Pre-condiciones**: Sistema tiene datos operacionales

**Validaciones**:

1. **Partidos de Grupo**
```sql
-- Partidos de grupo deben tener grupo_id
SELECT id FROM partidos WHERE grupo_id IS NOT NULL AND copa_id IS NOT NULL;
-- Resultado esperado: 0 filas (un partido no puede ser de grupo Y copa)
```

2. **Partidos de Copa**
```sql
-- Partidos de copa deben tener copa_id y ronda_copa
SELECT id FROM partidos WHERE copa_id IS NOT NULL AND ronda_copa IS NULL;
-- Resultado esperado: 0 filas
```

3. **No Duplicados**
```sql
-- No deben existir partidos duplicados (mismas parejas, mismo grupo/copa)
SELECT pareja_a_id, pareja_b_id, grupo_id, COUNT(*) 
FROM partidos 
WHERE grupo_id IS NOT NULL 
GROUP BY pareja_a_id, pareja_b_id, grupo_id 
HAVING COUNT(*) > 1;
-- Resultado esperado: 0 filas
```

4. **Posiciones Manuales**
```sql
-- Verificar que orden_manual no tiene duplicados en mismo grupo
SELECT grupo_id, orden_manual, COUNT(*) 
FROM posiciones_manual 
GROUP BY grupo_id, orden_manual 
HAVING COUNT(*) > 1;
-- Resultado esperado: 0 filas
```

**Resultado Esperado**: Todas las validaciones de consistencia pasan

---

## UX/UI - Prioridad: MEDIA

### TC-017: Navegación

**Rol**: Usuario General  
**Prioridad**: Media  
**Pre-condiciones**: Ninguna

**Pasos**:
1. Navegar a `/`
2. Verificar que existe topnav con enlaces a: Cargar resultados, Viewer, Admin, Analytics
3. Verificar que el enlace activo (actual) tiene clase CSS diferenciada
4. Click en "Cargar resultados"
5. Verificar que navega a `/carga` y el enlace se marca como activo
6. Repetir para cada enlace del nav
7. En dispositivo móvil o con viewport reducido (< 768px), verificar que el nav es responsive

**Resultado Esperado**: 
- Navegación funciona en todas las páginas
- Enlace activo se marca visualmente
- Responsive funciona en mobile

---

### TC-018: Estilos y Visual

**Rol**: Usuario General  
**Prioridad**: Media  
**Pre-condiciones**: Ninguna

**Pasos**:
1. Navegar a cualquier página del sistema
2. Verificar que el archivo `style.css` carga correctamente (sin errores en Network)
3. Localizar elementos con diferentes estados:
   - Partido pendiente
   - Partido confirmado
   - Partido en revisión
4. Verificar que cada estado tiene colores diferenciados
5. Localizar badges de estado
6. Verificar que son legibles (contraste adecuado)
7. Abrir un modal (ej: cargar resultado)
8. Verificar que está centrado vertical y horizontalmente
9. Verificar que el fondo (backdrop) oscurece el contenido detrás
10. Cambiar viewport a mobile (< 768px)
11. Verificar que el modal sigue siendo usable

**Resultado Esperado**: 
- CSS carga sin errores
- Colores consistentes con el diseño
- Badges legibles
- Modales centrados y responsive
- Sistema visualmente consistente

---

## PERFORMANCE - Prioridad: MEDIA

### TC-019: Tiempos de Carga

**Rol**: Validación Técnica  
**Prioridad**: Media  
**Pre-condiciones**: 
- Sistema con datos operacionales (al menos 12 parejas, 36 partidos)

**Mediciones**:

1. **Carga Inicial de Página**
   - Navegar a `/` con cache limpio
   - Medir tiempo desde navegación hasta "DOMContentLoaded"
   - **Resultado esperado**: < 3 segundos

2. **Queries de Base de Datos**
   - Abrir DevTools → Console
   - Ejecutar query de partidos:
```javascript
const start = performance.now();
const { data } = await supabase.from('partidos').select('*').eq('torneo_id', TORNEO_ID);
const end = performance.now();
console.log(`Query time: ${end - start}ms`);
```
   - **Resultado esperado**: < 1000ms

3. **Render de Listas Grandes**
   - Navegar a `/general` (vista con todos los partidos)
   - Medir tiempo de render con Performance API
   - Verificar que no hay "jank" (freezing de UI) al scrollear
   - **Resultado esperado**: UI responsiva, sin freezes

4. **Actualización de Vista después de Acción**
   - Cargar un resultado
   - Medir tiempo desde "Guardar" hasta actualización de la vista
   - **Resultado esperado**: < 2 segundos

**Resultado Esperado**: Sistema rápido y responsivo bajo carga normal

---

## Resumen de Prioridades

| Prioridad | Test Cases | Crítico para Smoke Test |
|-----------|------------|-------------------------|
| CRÍTICA   | TC-001 a TC-008 | ✅ SÍ - Bloquean uso básico |
| ALTA      | TC-009 a TC-012, TC-015, TC-016 | ⚠️ Importante - No bloquean pero afectan calidad |
| MEDIA     | TC-013, TC-014, TC-017, TC-018, TC-019 | ℹ️ Deseable - Mejoran experiencia |

**Criterio de Aprobación del Smoke Test:**
- ✅ PASA: 100% de CRÍTICA + 90% de ALTA + 80% de MEDIA
- ❌ FALLA: Cualquier test crítico falla

---

## Notas para Ejecución Automatizada

1. **Orden de Ejecución**: Algunos tests dependen de otros (ej: TC-004 requiere TC-003)
2. **Cleanup**: Después de tests destructivos (TC-009), considerar rollback o reset de datos
3. **Paralelización**: TC-001 a TC-005 pueden ejecutarse en paralelo si se usan diferentes parejas
4. **Screenshots**: Capturar screenshot en cada FAIL para debugging
5. **Logs**: Guardar console.log del browser para análisis
