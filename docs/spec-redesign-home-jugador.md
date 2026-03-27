# Spec: Rediseño visual del Home del Jugador (index.html)

## Objetivo

Mejorar la jerarquía visual de la pantalla del jugador para que en 3 segundos entienda:
1. Qué tiene que resolver YA (disputas, confirmaciones)
2. Cuál es su próximo partido
3. Qué viene después

No se agrega funcionalidad. Se reorganiza y se mejora el tratamiento visual.

## Contexto técnico

- **Archivo principal**: `src/viewer/vistaPersonal.js` — función `renderVistaPersonal` (línea ~513)
- **CSS**: `style.css` — clases `.home-seccion-inline`, `.seccion-inline-titulo`, `.partido-home`, `.partido-home-*`
- **Render de disputas**: función `renderPartidosRevision` (línea ~991)
- **Render de confirmaciones**: función `renderPartidosConfirmar` (línea ~1064)
- **Render de pendientes**: función `renderPartidosPendientesHome` (línea ~934)

## Cambios

### 1. Fondo de color en disputas y confirmaciones

Las secciones `.home-seccion-inline` de disputas y confirmaciones hoy no tienen fondo diferenciado. Agregar fondos sutiles para reforzar urgencia visual.

**Disputas** (`.home-seccion-inline` que contiene `#partidos-revision`):
- Fondo: `#FEF2F2` (rojo muy suave)
- Borde izquierdo: `4px solid #DC2626` (rojo, consistente con color de derrota en la app)
- Border-radius: `8px`
- Padding: `12px`

**Confirmaciones** (`.home-seccion-inline` que contiene `#partidos-confirmar`):
- Fondo: `#FFFBEB` (amarillo/ámbar muy suave)
- Borde izquierdo: `4px solid #F59E0B` (amarillo, consistente con warning de presentismo)
- Border-radius: `8px`
- Padding: `12px`

**Implementación**: Agregar clases CSS específicas. En `renderVistaPersonal` (~línea 641), agregar clase al div:
- Disputas: `<div class="home-seccion-inline seccion-disputa">`
- Confirmaciones: `<div class="home-seccion-inline seccion-confirmacion">`

En `style.css`, agregar:
```css
.seccion-disputa {
  background: #FEF2F2;
  border-left: 4px solid #DC2626;
  border-radius: 8px;
  padding: 12px;
}

.seccion-confirmacion {
  background: #FFFBEB;
  border-left: 4px solid #F59E0B;
  border-radius: 8px;
  padding: 12px;
}
```

### 2. Destacar "Tu próximo partido" del resto de pendientes

Hoy todos los partidos pendientes tienen el mismo peso visual (cards `.partido-home` idénticas). Separar el primero (menor # en la cola) como card destacada.

**En `renderPartidosPendientesHome`** (~línea 934):

Dividir `partidosConPosicion` en dos:
- `proximo = partidosConPosicion[0]` — el primero de la cola
- `resto = partidosConPosicion.slice(1)` — los demás

**Card del próximo partido** (nuevo estilo `.partido-proximo`):
- Subtítulo arriba: `🎾 Tu próximo partido` (texto `h3` o similar, tamaño 15px, color `#374151`)
- Card más grande que las demás: padding `16px`, fondo blanco, sombra suave (`box-shadow: 0 2px 8px rgba(0,0,0,0.08)`)
- Borde izquierdo: `4px solid #16A34A` (verde, color de "presente" / acción positiva)
- Posición (#) y rival con tipografía más grande (nombre del oponente en 18px bold)
- El botón "Cargar resultado" con estilo primario (más grande, más prominente)
- Debajo del rival, mostrar: `#N en la cola` en texto secundario (14px, color `#6B7280`)
- Si es partido de copa, mostrar `🏆 Copa Nombre — Ronda` como badge

**Sección "Los que vienen después"** (solo si hay `resto.length > 0`):
- Subtítulo: `Los que vienen después` (texto `h3`, 14px, color `#6B7280`)
- Cards del resto: mantener el estilo actual `.partido-home` (más compactas, menos prominentes)

**HTML resultante** (pseudo-código):
```html
<!-- Próximo partido -->
<div class="partido-proximo">
  <h3 class="proximo-titulo">🎾 Tu próximo partido</h3>
  <div class="proximo-card">
    <span class="proximo-posicion">#6</span>
    <span class="proximo-vs">vs Gaby A - Ari Kan</span>
    <span class="proximo-cola">#6 en la cola</span>
    <button class="btn-cargar-resultado btn-cargar-proximo" onclick="app.cargarResultado('...')">
      📝 Cargar resultado
    </button>
  </div>
</div>

<!-- Los que vienen después -->
<h3 class="pendientes-resto-titulo">Los que vienen después</h3>
<div class="partido-resto">
  <span class="resto-posicion">#8</span>
  <span class="resto-vs">vs Lean - Leo</span>
  <button class="btn-cargar-resto" onclick="app.cargarResultado('...')">📝 Cargar</button>
</div>
<div class="partido-resto">
  <span class="resto-posicion">#11</span>
  <span class="resto-vs">vs Andy - Max</span>
  <button class="btn-cargar-resto" onclick="app.cargarResultado('...')">📝 Cargar</button>
</div>
```

**Estilo de "Los que vienen después"** (`.partido-resto`):
- Layout: una fila horizontal con flexbox (`justify-content: space-between; align-items: center`)
- Padding: `10px 12px`
- Borde inferior: `1px solid #E5E7EB` (separador sutil entre partidos)
- Sin fondo, sin sombra — visualmente más liviano que la card del próximo
- Posición (#): `font-weight: 600`, color `#6B7280`, ancho fijo ~40px
- Nombre rival: `flex: 1`, font-size `14px`
- Botón "📝 Cargar": compacto, inline, font-size `13px`, padding `6px 12px`, mismo color que el botón principal pero sin relleno (outline/ghost style o fondo gris claro `#F3F4F6`)

**Edge cases**:
- Si solo hay 1 partido pendiente: mostrar solo "Tu próximo partido" sin la sección "Los que vienen después"
- Si hay partidos de copa en el resto: mostrar badge `🏆` antes del rival

### 3. Renombrar botón de navegación

En `renderVistaPersonal` (~línea 674), cambiar el texto del botón de consulta:
- Antes: `Tablas / Grupos`
- Después: `Ver posiciones y cruces`

```html
<a href="/general.html" class="btn-consulta">
  <span class="btn-consulta-icon">📊</span>
  <span class="btn-consulta-text">Ver posiciones y cruces</span>
</a>
```

### 4. Orden de render (sin cambios)

Mantener el orden actual:
1. Quién soy (header + presentismo) — sin cambios
2. Dashboard (posición, pendientes, jugados) — sin cambios
3. Disputas inline (con nuevo fondo rojo)
4. Confirmaciones inline (con nuevo fondo amarillo)
5. Tu próximo partido (card destacada) + Los que vienen después
6. Botón "Ver posiciones y cruces" (navega a general.html)
7. Partidos jugados colapsados — sin cambios

## Lo que NO cambia

- La mecánica de disputas y confirmaciones (botones inline, sin modal)
- El dashboard (posición, pendientes, jugados)
- El header "Quién soy" con presentismo
- El botón de navegación a general.html (texto cambia a "Ver posiciones y cruces")
- Los partidos jugados colapsados
- La lógica de polling/refresh

## Pasos finales obligatorios

1. `npm run build` → 0 errores
2. Actualizar `docs/brainstorming-proximas-mejoras.md`: agregar al historial "Rediseño visual home jugador: fondos disputa/confirmación + próximo partido destacado" con fecha.
3. `npm version patch`
