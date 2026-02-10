# Retrospectiva post-torneo (post go-live) — 2026-01-28

## Objetivo de la entrevista
Entender **cómo se usó realmente el sistema** durante el torneo (no teórico), identificando:

- **Flujos naturales** vs **flujos forzados**
- **Fricciones reales** (confusión, demora, estrés) con contexto, frecuencia e impacto
- **Qué funcionó bien** y conviene mantener

Fuera de alcance en esta etapa: **revisión de código**, **búsqueda de bugs**, **propuestas de solución**.

---

## Contexto del evento
- **Participantes**: 22 jugadores
- **Partidos**: 25
- **Canchas simultáneas**: se arrancó con 3 y se terminó con 5
- **Dispositivos**: acceso desde **varios celulares** (dispositivos propios)
- **Duración/entorno**: aprox. 19:00 a 22:30, al aire libre, con gente alrededor, poco margen entre partidos

## Tipos de usuario durante el torneo
- **Vos**: Admin del sistema + organizador + jugador (acceso a todas las páginas)
- **Jugadores**: acceso a `index.html`, `general.html`, `fixture.html` (no conocían `carga.html` ni `admin.html`)

---

## Cómo se usó realmente el sistema

### Uso como Admin / Organizador
- **Arranque del torneo**: el problema real a resolver fue “**qué partidos pueden empezar**” con:
  - llegadas tardías
  - solo 3 canchas al inicio
  - 11 parejas (2 grupos: 5 y 6 parejas)
  - reglas distintas por grupo (grupo de 5 a 6 games; grupo de 6 a 5 games)
- **Durante el torneo**: se buscó que **cada pareja cargue sus resultados**, pero el resultado fue mixto: algunos cargaron, muchos no y terminaste cargando vos.
- **Fin de grupos**: al acercarse la definición de copas, la **tabla de posiciones** se volvió crítica; aparecieron varios partidos sin resultados y no quedaba claro si faltaban jugar, se estaban jugando o faltaban cargar.

### Uso como Jugador (vos)
- Jugaste **4 partidos**.
- La mayor tensión personal se dio:
  - al inicio, por un incidente de carga en el primer partido
  - al final de tus partidos de ronda, al revisar tablas/posiciones
- En general cargabas resultados “al toque” salvo cuando jugaste 2 partidos seguidos sin pausa.

### Observaciones sobre otros jugadores (no técnicos)
- **Autogestión**: al principio no podían autogestionarse (no tenían claro su grupo); hacia el final mejoró por dinámica social (mirar partidos, conocer rivales, acordar contra quién jugar cuando se liberaba cancha).
- **Causa dominante de no carga**: más **pereza/costo de sacar el celular** (con poco tiempo entre partidos) que falta total de instrucciones.
- **Costo de usar más de una página**: al explicar `fixture.html`, varios intentaron cargar resultados “desde ahí”; pedirles que cambien a otra página para cargar tuvo un costo alto de comprensión/usabilidad.

---

## Momentos específicos (escenas)

### Momento A — Inicio: “qué partidos se podían empezar”
- **Quiénes**: vos + Diego + 8/10 jugadores
- **Situación**: faltaban <5 min para las 19:00; algunos jugadores no habían llegado
- **Qué intentaron**: abrir `fixture.html` para definir partidos
- **Qué pasó**: te diste cuenta de que el fixture **no resolvía** el problema concreto del momento; terminaste usando la imagen de WhatsApp (lista de parejas/grupos) y cálculo mental de “parejas completas” y “mismo grupo”.
- **Cómo se resolvió**: Diego armó los primeros 3 partidos (decidiendo también no jugar él aún para empujar el arranque).
- **Impacto**: **3 a 5 minutos**; arranque a las **19:00–19:05** con 3 partidos en juego.

### Momento B — Fin de grupos: incertidumbre de estados + tabla crítica
- **Situación**: tras tu 3er partido querías ver posición; no encontraste donde esperabas:
  - en la versión previa: en “Mis resultados” se veía posición en el dashboard
  - además antes veías la tabla del grupo al final de esa vista
- **Acción**: fuiste a `general.html` y viste inconsistencias: tu grupo mostraba que eras el único con 3 jugados, pero sabías que otros también tenían al menos 3.
- **Resolución**: buscaste rivales de tu grupo y cargaste vos resultados para completar.
- **Pico crítico posterior**: 20–30 min después, al terminar tu último partido de ronda, la tabla mostraba triple empate; los números eran “raros” (p.ej. “3 games a favor” cuando esperabas ~18), lo cual te hizo sospechar conversión de games/set. Aun así, el orden te pareció verosímil y anunciaste cruces.
- **Consecuencia social**: hubo cuestionamiento (en broma) del que quedó 3ro; lo aceptó con tu explicación del desempate por resultado directo.

---

## Fricciones reales detectadas (sin proponer soluciones)

### 1) Coordinación operativa: estados de partidos en fin de grupos
- No quedaba claro si faltaba **jugar** vs faltaba **cargar** vs “en juego”.
- Impacto: decisiones críticas con información incompleta; riesgo de error en clasificación (triple empate).

### 2) Confiabilidad percibida de tabla/posiciones en momento crítico
- Métricas extrañas en tabla (p.ej. games a favor) generaron desconfianza aunque el orden pareciera verosímil.
- Impacto: decisiones “a ciegas” o con validación parcial.

### 3) Fixture: dificultad para encontrar “quién juega ahora”
Problemas observados:
- 4 nombres por partido (orden de parejas y posición izquierda/derecha)
- homónimos (Nico B vs Nico E)
- prioridad visual (primero “en juego” aunque lo importante eran “pendientes”)
- buscador y teclado en móvil tapando contenido

### 4) Estado incorrecto en fixture (pendiente/en juego/finalizado)
Caso concreto:
- Un partido que sabías que no jugaste no aparecía en pendientes; lo encontraste en finalizados y lo pasaste a pendiente.
- Impacto: rompe confianza en la lista de pendientes.

### 5) Disputas: ambigüedad al resolver como admin
Caso concreto:
- En `carga.html`/disputas, dos botones grandes con resultados distintos no dejaban claro qué había cargado cada jugador ni a quién favorecía cada opción.
- Resolviste usando la opción manual (inputs por games) en ~2 min.

### 6) “Mis resultados” confuso cuando hay confirmaciones pendientes
Caso concreto:
- Jugador entra por primera vez y quiere cargar un resultado nuevo, pero lo primero que ve son botones grandes para confirmar/corregir otros partidos; necesitó guía para scrollear y encontrar el partido a cargar.

---

## Qué funcionó bien (a mantener)
- **Onboarding/identificación**: “poné tu nombre, confirmá tu pareja → bienvenida” gustó a todos.
- **Acceso desde celular / multi-dispositivo**: base de acceso sólida.
- **Percepción de camino para resolver errores**: para jugadores el estrés fue bajo (sienten que hay un flujo para corregir/disputar).

---

## Cierre
Esta retrospectiva documenta **hechos y escenas** de uso real durante el torneo. La salida está pensada para alimentar un backlog priorizado por impacto real (severidad, frecuencia, criticidad temporal y daño a la confianza).
