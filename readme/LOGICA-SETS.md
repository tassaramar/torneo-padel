# Lógica de Sets y Visualización

Este documento describe la lógica de visualización y validación de sets en el sistema de carga de resultados.

## Modos de Partido

El sistema maneja tres modos de partido según el valor de `num_sets` en la base de datos:

### Modo A: Indefinido (`num_sets = NULL`)

Cuando el torneo no tiene definido el número de sets, el sistema permite flexibilidad:

- **Set 1**: Se muestra siempre inicialmente
- **Botón "Agregar Set 2"**: 
  - Se muestra solo si Set 1 es válido (ver ## Validación de Datos para detalles)
  - Al hacer click, se muestra Set 2 y el partido se trata como de 3 sets en la UI (sin guardar en BD)
- **Set 2**: Se muestra solo después de hacer click en "Agregar Set 2" o si ya está cargado
- **Set 3**: Se muestra según las reglas del Modo 3 Sets (ver más abajo)
  - Si hay empate 1-1 en sets, se muestra automáticamente
  - Si no hay empate, no se muestra
- **Comportamiento por defecto**: Si nunca se hace click en "Agregar Set 2", el partido se trata como de 1 set

### Modo B: 1 Set (`num_sets = 1`)

Partidos que se juegan a un solo set:

- **Set 1**: Se muestra siempre
- **Set 2**: No se muestra
- **Set 3**: No se muestra
- **Botones**: No se muestran botones para agregar sets

### Modo C: 3 Sets (`num_sets = 3`)

Partidos que se juegan al mejor de 3 sets:

- **Set 1**: Se muestra siempre
- **Set 2**: Se muestra siempre
- **Set 3**: 
  - Se muestra automáticamente si ambos set tiene valores válidos (ver ## Validación de Datos) y hay empate 1-1 en sets (cada pareja ganó un set)
  - También se muestra si ya está cargado el 3er set
  - Si no hay empate (una pareja ganó 2-0), no se muestra
- **Botón "Agregar Set 3"**: No se usa. El Set 3 se muestra/oculta automáticamente según el empate.

## Validación de Datos

**Para cualquiera de los 3 sets y en todos los modos de partidos, la validación es la misma:**

Un set es válido si:
- Ambos valores son numéricos
- Ambos valores son >= 0 (null es distinto de 0 y se considerea valor inválido)
- Los valores no son iguales (no se permiten empates)

**No se aplican validaciones de reglas de padel:**
- No se valida mínimo de 6 games
- No se valida diferencia de 2 games
- No se valida límite máximo de 7 games
- No se valida formato de tie-break

Esto permite flexibilidad para diferentes formatos de torneo y situaciones especiales.

## Validación para Botón "Agregar Set 2"

En el Modo Indefinido, el botón "Agregar Set 2" se muestra solo si Set 1 es válido (ver ## Validación de Datos)

## Tipos de Mensajes divertidos

Hay 2 niveles de mensajes y a su vez hay dos categorias:
-Categorias: Ganar, Perder, Empate. 
-Niveles: Partido y Set.

Segun el momento de la carga se determina que nivel se utiliza (ver datalle de flujo de visualizacion)
las catergorias se definen segun si viene ganando o perdiendo


## Flujo de Visualización

### Modo Indefinido (NULL)

1. **Inicialmente: Solo Set 1 visible**
   - Si Set 1 no es válido: 
     - No se muestra botón "Agregar Set 2"
     - Mensaje: **Nivel Partido**, categoría según validación. Ejemplo: "Campeón, no podes empatar un set!" (si hay empate) o mensaje de error si falta algún valor
   - Si Set 1 es válido pero incompleto (falta algún valor):
     - No se muestra botón "Agregar Set 2"
     - Mensaje: **Nivel Partido**, indicando que falta completar el set

2. **Si Set 1 es válido (ambos valores >= 0, numéricos y no iguales):**
   - Botón "Agregar Set 2" visible
   - Mensaje: **Nivel Partido**, categoría según si ganó o perdió el Set 1. Ejemplos:
     - Si ganó: "¡Bien ahí! Arrancaste ganando el primer set"
     - Si perdió: "Tranquilo, todavía hay tiempo para remontar"

3. **Al hacer click en "Agregar Set 2":**
   - Botón se reemplaza por "Eliminar 2do set"
   - Set 2 se muestra
   - Mensaje: **Nivel Set**, categoría según resultado del Set 1. Ejemplos:
     - Si ganó Set 1: "¡Decime que cerraste acá!" o "¡A cerrarlo en el segundo!"
     - Si perdió Set 1: "Espero que hayas podido remontar en el 2do" o "¡A dar vuelta el partido!"
   - **Al hacer click en "Eliminar 2do set":**
     - Se oculta Set 2 y Set 3 (si estaba visible)
     - Se vuelve a mostrar botón "Agregar Set 2"
     - Mensaje: Vuelve a **Nivel Partido** según resultado del Set 1

4. **Cuando Set 2 está completo (ambos valores válidos):**
   - Si hay empate 1-1 en sets:
     - Set 3 se muestra automáticamente
     - Mensaje: **Nivel Set** (porque todavía falta el Set 3). Ejemplo: "¡Todo se define en el Super Tiebreak!"
   - Si no hay empate (2-0):
     - Set 3 no se muestra
     - Mensaje: **Nivel Partido**, categoría según resultado final. Ejemplos:
       - Si ganó 2-0: "¡Felicitaciones! Partido cerrado en dos sets"
       - Si perdió 2-0: "Buen partido, la próxima será"

5. **Si hay empate 1-1 y Set 3 se muestra:**
   - Si hay valores cargados en el 3er set y se cambia el Set 2 (rompiendo el empate): 
     - Se oculta Set 3 y no se guardan esos valores en la BD
     - Mensaje: **Nivel Partido** según nuevo resultado
   - Si se vuelve a mostrar el Set 3 (se restaura el empate 1-1):
     - Se mantienen los valores previamente cargados en el Set 3
   - **Mensajes del Set 3:**
     - Mientras Set 3 no es válido (falta algún valor o valores iguales):
       - Mensaje: **Nivel Set**, indicando que falta completar el Super Tiebreak
     - Cuando Set 3 es válido:
       - Mensaje: **Nivel Partido**, categoría según resultado final. Ejemplos:
         - Si ganó: "¡Increíble! Lo cerraste en el Super Tiebreak"
         - Si perdió: "Fue reñido hasta el final, buen partido"

### Modo 1 Set

1. **Solo Set 1 visible**
   - No hay botones ni Sets adicionales

2. **Mensajes:**
   - Mientras Set 1 no es válido (falta algún valor o valores iguales):
     - Mensaje: **Nivel Partido**, indicando error. Ejemplo: "Campeón, no podes empatar un set!" (si hay empate) o "Completá ambos valores del set" (si falta algún valor)
   - Cuando Set 1 es válido:
     - Mensaje: **Nivel Partido**, categoría según resultado. Ejemplos:
       - Si ganó: "¡Felicitaciones! Partido ganado"
       - Si perdió: "Buen partido, la próxima será"

### Modo 3 Sets

1. **Set 1 y Set 2 siempre visibles**
   - Set 3 visible solo si:
     - Hay empate 1-1 en sets, O
     - Ya está cargado el Set 3

2. **Mensajes:**
   - **Mientras se carga Set 1:**
     - Si Set 1 no es válido: Mensaje **Nivel Set**, indicando error
     - Si Set 1 es válido: Mensaje **Nivel Set**, categoría según resultado. Ejemplos:
       - Si ganó: "¡Bien arrancaste! Primer set ganado"
       - Si perdió: "Tranquilo, todavía hay dos sets por delante"
   
   - **Mientras se carga Set 2 (Set 1 ya completo):**
     - Si Set 2 no es válido: Mensaje **Nivel Set**, indicando error
     - Si Set 2 es válido pero incompleto: Mensaje **Nivel Set**, indicando que falta completar
     - Si Set 2 es válido:
       - Si hay empate 1-1: Mensaje **Nivel Set** (porque falta Set 3). Ejemplo: "¡Todo se define en el Super Tiebreak!"
       - Si no hay empate (2-0): Mensaje **Nivel Partido**, categoría según resultado final
   
   - **Si Set 3 se muestra (empate 1-1):**
     - Mientras Set 3 no es válido: Mensaje **Nivel Set**, indicando que falta completar el Super Tiebreak
     - Cuando Set 3 es válido: Mensaje **Nivel Partido**, categoría según resultado final. Ejemplos:
       - Si ganó: "¡Increíble! Lo cerraste en el Super Tiebreak"
       - Si perdió: "Fue reñido hasta el final, buen partido"
   
   - **Cuando el partido está completo (2 sets ganados o 2-1):**
     - Mensaje: **Nivel Partido**, categoría según resultado final. Ejemplos:
       - Si ganó 2-0: "¡Felicitaciones! Partido cerrado en dos sets"
       - Si ganó 2-1: "¡Felicitaciones! Partido ganado en tres sets"
       - Si perdió 2-0: "Buen partido, la próxima será"
       - Si perdió 2-1: "Fue reñido hasta el final, buen partido"

## Notas Técnicas

- El valor de `num_sets` en la base de datos puede ser `NULL`, 0, `1`, o `3`.  En este caso null se trata igual a 0  
- En Modo Indefinido, NO se actualiza `num_sets` en BD al hacer click en "Agregar Set 2"
- El sistema infiere el número de sets de cada partido del resultado cargado al guardar
- En un mismo torneo puede haber partidos jugados a 1 set y partidos jugados a 2 set.
- La validación simplificada permite diferentes formatos de torneo sin restricciones rígidas
