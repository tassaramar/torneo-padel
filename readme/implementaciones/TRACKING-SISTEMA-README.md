# Sistema de Tracking de Uso - Documentación

## 📋 Resumen

Se implementó un sistema completo de tracking de uso por jugador individual que registra automáticamente:
- **Visitas**: Cuando un jugador se identifica en la app
- **Carga de resultados**: Cuando un jugador carga o actualiza el resultado de un partido

## 🗂️ Archivos Creados/Modificados

### 1. Base de Datos
- **`supabase/migrations/20260121031147_add_tracking_eventos.sql`**
  - Nueva tabla `tracking_eventos` con índices optimizados
  - RLS habilitado con policies públicas
  - Columnas: id, torneo_id, pareja_id, jugador_nombre, tipo_evento, metadata, created_at

### 2. Servicio de Tracking
- **`src/tracking/trackingService.js`** (NUEVO)
  - `trackVisita()` - Registra visitas
  - `trackCargaResultado()` - Registra cargas de resultados
  - `getActivityStats()` - Obtiene estadísticas agregadas
  - `getTimelineData()` - Datos para gráfico temporal
  - `getRankingActividad()` - Ranking de jugadores por actividad
  - `getActividadReciente()` - Feed de eventos recientes
  - `getStatsPorPareja()` - Estadísticas por pareja

### 3. Integraciones Automáticas
- **`src/identificacion/identidad.js`** (MODIFICADO)
  - `saveIdentidad()` ahora acepta cliente Supabase
  - Llama automáticamente a `trackVisita()` al guardar identidad

- **`src/identificacion/ui.js`** (MODIFICADO)
  - `iniciarIdentificacion()` acepta parámetro `supabase`
  - Pasa el cliente a través del flujo de identificación

- **`src/personal.js`** (MODIFICADO)
  - Pasa cliente Supabase a `iniciarIdentificacion()`

- **`src/viewer.js`** (MODIFICADO)
  - Pasa cliente Supabase a `iniciarIdentificacion()`

- **`src/viewer/cargarResultado.js`** (MODIFICADO)
  - Importa `trackCargaResultado`
  - Llama automáticamente al servicio después de cada operación exitosa:
    - Primera carga de resultado
    - Actualización de resultado propio
    - Confirmación de resultado coincidente
    - Carga con conflicto
    - Actualización en revisión

### 4. Dashboard de Analytics
- **`analytics.html`** (NUEVO)
  - Página completa del dashboard
  - Navegación integrada con topnav
  - Controles de periodo y búsqueda

- **`src/analytics.js`** (NUEVO)
  - Punto de entrada del dashboard
  - Carga datos en paralelo
  - Auto-refresh cada 60 segundos
  - Manejo de estado global

- **`src/analytics/statsCards.js`** (NUEVO)
  - 6 tarjetas de métricas principales:
    - Jugadores activos
    - Visitas totales
    - Resultados cargados
    - Promedio visitas/jugador
    - Parejas activas
    - Eventos totales

- **`src/analytics/timeline.js`** (NUEVO)
  - Gráfico temporal usando Canvas API
  - Dos líneas: visitas (azul) y cargas (verde)
  - Ejes con etiquetas y grid
  - Responsive

- **`src/analytics/rankingTable.js`** (NUEVO)
  - Tabla ordenada por actividad
  - Columnas: #, estado, jugador, pareja, grupo, visitas, cargas, total, última actividad
  - Filtrable por búsqueda
  - Indicadores visuales de nivel de actividad (🔥 muy activo, ✅ activo, 👀 moderado, ⚠️ bajo)
  - Tiempo relativo ("hace 2h", "ayer", etc.)

- **`src/analytics/activityList.js`** (NUEVO)
  - Feed cronológico de eventos recientes
  - Formato legible: "Juan Pérez (Pareja #3) cargó resultado (6-4) hace 1h"
  - Scroll para lista larga
  - Diferenciación visual por tipo de evento

### 5. Estilos CSS
- **`style.css`** (MODIFICADO)
  - ~350 líneas de estilos nuevos para analytics
  - Variables CSS existentes reutilizadas
  - Responsive (tablet y mobile)
  - Animaciones y transiciones
  - Tema consistente con el resto de la app

## 🚀 Cómo Usar

### 1. Aplicar Migración a Producción

```bash
# Si usás Supabase CLI con Docker local
supabase db reset

# O si querés pushear a producción directamente
supabase db push
```

### 2. Acceder al Dashboard

Navegar a: `https://tu-dominio.com/analytics`

O en desarrollo local: `http://localhost:5173/analytics`

### 3. Verificar que el Tracking Funciona

#### Test de Visita:
1. Abrir `/` o `/carga`
2. Identificarse como un jugador
3. Ir a `/analytics`
4. Verificar que aparece un evento de visita reciente con tu nombre

#### Test de Carga de Resultado:
1. Identificarse como jugador
2. Ir a `/carga` o usar el viewer para cargar un resultado
3. Cargar o actualizar el resultado de un partido
4. Ir a `/analytics`
5. Verificar que aparece un evento de carga de resultado con tu nombre y el resultado

### 4. Explorar el Dashboard

- **Selector de Periodo**: Cambiar entre 7, 14, 30 o 90 días
- **Tarjetas**: Ver métricas generales de un vistazo
- **Timeline**: Visualizar tendencias temporales de uso
- **Ranking**: Ver quiénes son los jugadores más activos
- **Feed**: Ver actividad en tiempo real

## 📊 Datos que se Registran

### Evento de Visita
```json
{
  "torneo_id": "uuid-del-torneo",
  "pareja_id": "uuid-de-la-pareja",
  "jugador_nombre": "Juan Pérez",
  "tipo_evento": "visita",
  "metadata": {
    "timestamp": "2026-01-21T03:30:00.000Z",
    "pareja_nombre": "Juan Pérez - María García",
    "grupo": "A",
    "companero": "María García"
  },
  "created_at": "2026-01-21T03:30:00.000Z"
}
```

### Evento de Carga de Resultado
```json
{
  "torneo_id": "uuid-del-torneo",
  "pareja_id": "uuid-de-la-pareja",
  "jugador_nombre": "Juan Pérez",
  "tipo_evento": "carga_resultado",
  "metadata": {
    "timestamp": "2026-01-21T03:35:00.000Z",
    "partido_id": "uuid-del-partido",
    "games_a": 6,
    "games_b": 4,
    "resultado": "6-4",
    "pareja_nombre": "Juan Pérez - María García"
  },
  "created_at": "2026-01-21T03:35:00.000Z"
}
```

## 🔒 Privacidad

- **No se registra información sensible**: No se guarda IP, user agent completo, ni datos de dispositivo
- **Datos públicos**: Solo se usa información que ya es pública en el fixture (nombres de jugadores, parejas, grupos)
- **Acceso al dashboard**: Por ahora es público (misma seguridad que el resto de la app). Si necesitás restringir acceso, se puede agregar autenticación

## 🛠️ Mantenimiento

### Limpiar Datos Antiguos (opcional)

Si en el futuro querés limpiar eventos muy antiguos:

```sql
DELETE FROM tracking_eventos 
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Ver Datos Directamente en Supabase

```sql
-- Total de eventos
SELECT COUNT(*) FROM tracking_eventos;

-- Eventos por tipo
SELECT tipo_evento, COUNT(*) 
FROM tracking_eventos 
GROUP BY tipo_evento;

-- Top 10 jugadores más activos
SELECT 
  jugador_nombre, 
  COUNT(*) as total_eventos
FROM tracking_eventos 
GROUP BY jugador_nombre 
ORDER BY total_eventos DESC 
LIMIT 10;

-- Eventos de hoy
SELECT * 
FROM tracking_eventos 
WHERE created_at >= CURRENT_DATE 
ORDER BY created_at DESC;
```

## 🐛 Troubleshooting

### No aparecen eventos en el dashboard
1. Verificar que la migración se aplicó correctamente
2. Abrir consola del navegador y buscar errores
3. Verificar que las variables de entorno de Supabase están configuradas

### El tracking no se registra automáticamente
1. Verificar que te identificaste correctamente como jugador
2. Revisar consola del navegador (los errores de tracking solo aparecen como warnings)
3. Verificar que el cliente Supabase se está pasando correctamente

### El gráfico no se ve bien en mobile
- El gráfico es responsive pero tiene un ancho mínimo de 600px
- En pantallas muy pequeñas puede requerir scroll horizontal

## 📈 Métricas Útiles

El dashboard te permite responder preguntas como:
- ¿Cuántos jugadores están usando activamente la app?
- ¿Quiénes son los más comprometidos con cargar resultados?
- ¿Hay parejas que nunca entraron a la app?
- ¿Qué días/horarios hay más actividad?
- ¿El uso está aumentando o disminuyendo?

## 🎯 Próximas Mejoras (opcional)

Si querés expandir el sistema en el futuro:
- Agregar más tipos de eventos (ver fixture, ver tabla, etc.)
- Implementar notificaciones para jugadores inactivos
- Dashboard personalizado por pareja
- Exportar datos a Excel/CSV
- Métricas de engagement más sofisticadas
- Comparación entre grupos
