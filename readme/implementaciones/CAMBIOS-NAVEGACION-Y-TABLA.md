# Cambios: Navegación y Tabla de Posiciones

## Resumen de mejoras implementadas

### 1. Tabla de posiciones en vista personalizada ✅

**Ubicación:** Vista personalizada (index.html después de login)

**Características:**
- Se muestra abajo, después de partidos confirmados
- Expandida por defecto (`open`)
- Tabla completa con todas las columnas:
  - Posición (#)
  - Pareja (nombre)
  - PJ (partidos jugados)
  - G (ganados)
  - P (perdidos)
  - GF (games a favor)
  - GC (games en contra)
  - Dif (diferencia de games)
  - Pts (puntos)

**Destacado visual:**
- Tu fila está resaltada con fondo celeste (mismo color que el dashboard)
- Fuente más gruesa (bold)
- Colores destacados en posición y puntos

**Lógica de puntos:**
- Victoria: 3 puntos
- Empate: 1 punto (aunque no puede haber)
- Derrota: 0 puntos

**Orden:**
1. Por puntos (mayor a menor)
2. Por diferencia de games
3. Por games a favor

---

### 2. Botón "Ver todos los grupos" funcional ✅

**Antes:** No hacía nada

**Ahora:** 
- Navega a la vista completa del torneo
- Muestra todos los grupos y partidos
- Mantiene la estructura original del viewer

**Funcionamiento:**
- Click en botón → carga vista completa
- Muestra el `.viewer-shell` original
- Funciona igual que antes de la implementación

---

### 3. Nuevo selector en carga.html ✅

**Antes:** Pendientes / Jugados

**Ahora:** Pendientes / Jugados / Disputas

**Modo "Pendientes":**
- Muestra partidos sin resultado (games_a o games_b null)
- Agrupados por ronda
- Con indicación de fecha libre

**Modo "Jugados":**
- Muestra partidos con resultado
- **NOVEDAD:** Primero aparecen los "a_confirmar" (amarillo)
- Luego los "confirmados" (normal)
- NO muestra los "en_revision" (esos están en Disputas)

**Modo "Disputas":**
- Muestra SOLO partidos "en_revision"
- Cards especiales con ambos resultados
- Opciones para resolver el conflicto
- Si no hay disputas: "No hay partidos en disputa 👍"

---

## Archivos modificados

### 1. `src/viewer/vistaPersonal.js`
- Agregada función `calcularTablaGrupo()`
- Agregada función `agregarGrupoAParejas()` (duplicada de viewer.js)
- Renderizado de tabla HTML completa
- Fetch de todas las parejas del grupo
- Cálculo de estadísticas (puntos, games, diferencia)

### 2. `src/viewer.js`
- Función `cargarVistaCompleta()` ahora muestra el viewer-shell
- Arregla el botón "Ver todos los grupos"

### 3. `src/carga/state.js`
- Agregado modo 'disputas'
- Comentario actualizado

### 4. `src/carga/layout.js`
- Agregado tercer botón "Disputas"
- Actualizada función `pintarModoToggle()` para 3 modos
- Actualizada función `wireModoToggle()` para 3 modos
- Retorna `btnDisputas` en el DOM

### 5. `src/carga/partidosGrupos.js`
- Query modificada para soportar modo 'disputas'
- En modo 'disputas', solo obtiene `estado = 'en_revision'`
- En modo 'jugados', ordena primero los 'a_confirmar'
- Manejo especial para renderizar en modo 'disputas'
- Mensaje personalizado si no hay disputas

### 6. `style.css`
- Estilos completos para `.tabla-posiciones`
- Tabla responsive
- Destacado de fila `.mi-pareja`
- Colores y tipografía
- Responsive para móvil

---

## Testing recomendado

### Test 1: Tabla de posiciones
1. Entrar como pareja con partidos jugados
2. ✅ Ver tabla de posiciones abajo
3. ✅ Tu fila debe estar resaltada en celeste
4. ✅ Verificar orden correcto (por puntos)
5. ✅ Verificar cálculos correctos

### Test 2: Botón "Ver todos los grupos"
1. En vista personalizada
2. Click en "👀 Ver todos los grupos"
3. ✅ Debe mostrar vista completa del torneo
4. ✅ Sin errores en consola

### Test 3: Selector Pendientes/Jugados/Disputas
1. Abrir `carga.html`
2. ✅ Ver 3 botones
3. Click en "Jugados"
4. ✅ Primero aparecen los "a_confirmar" (amarillos)
5. ✅ Luego los confirmados
6. ✅ NO aparecen los "en_revision"

### Test 4: Modo Disputas
1. En `carga.html`, click "Disputas"
2. ✅ Solo ver partidos en revisión
3. ✅ Ver ambos resultados lado a lado
4. ✅ Opciones para resolver
5. Si no hay: ✅ "No hay partidos en disputa 👍"

### Test 5: Orden en "Jugados"
1. Crear 2 partidos jugados
2. Uno en estado "confirmado"
3. Otro en estado "a_confirmar"
4. ✅ El "a_confirmar" debe aparecer primero

---

## Impacto en la experiencia

**Más clara:**
- La tabla de posiciones es fácil de entender
- Tu posición está super visible
- El modo "Disputas" separa los conflictos

**Más organizada:**
- Los 3 modos están bien diferenciados
- En "Jugados" primero lo que falta confirmar
- En "Disputas" solo lo que requiere atención

**Más funcional:**
- El botón "Ver todos" ahora funciona
- Navegación fluida entre vistas

---

## Próximos pasos

1. Probar todo el flujo completo
2. Verificar cálculos de puntos
3. Ajustar estilos si es necesario
4. Deploy a producción
