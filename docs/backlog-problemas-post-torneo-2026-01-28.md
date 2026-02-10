# Backlog de problemas (post-torneo / post go-live) — 2026-01-28

## Propósito
Documentar y priorizar **problemas reales de uso** detectados en el torneo, con foco en:

- **Impacto operativo** (coordinar, decidir, cerrar grupos/copas)
- **Frecuencia** (cuántas veces / cuántas personas)
- **Ventana crítica** (inicio / fin de grupos)
- **Confianza** (si obliga a volver a WhatsApp, preguntar en cancha, “cerrar los ojos”)

Fuera de alcance en este documento: **propuestas de solución**, **diseño**, **revisión de código**.

---

## Marco de priorización (S/F/T/C)
Para cada problema se asigna (1–5):

- **S — Severidad**: cuánto puede afectar el torneo (decisiones mal tomadas, frena operación, etc.).
- **F — Frecuencia**: cuántas veces ocurrió / cuántas personas lo sufren.
- **T — Criticidad temporal**: si ocurre en ventanas donde no hay margen (inicio/fin de grupos).
- **C — Confianza**: cuánto erosiona confiar en el sistema (si obliga a verificar manualmente).

### Fórmula de score (ranking inicial)
Score sugerido:

> `Score = 2*S + 1.5*F + 2*T + 1*C`

Notas:
- El score es **orientativo** y se ajusta si cambiamos pesos.
- Cuando hay empates, se desempata con: **T** (ventana crítica) y luego **C** (confianza).

---

## Ranking inicial (ordenado por Score)

### Tabla alineada (monoespaciada)
Pegada acá como bloque para que se vea alineada en cualquier editor.

```
Rank | Problema (título corto)                                                                 | S | F | T | C | Score
-----+------------------------------------------------------------------------------------------+---+---+---+---+------
1    | Tabla/posiciones poco confiable en momento crítico (“números raros”)                     | 5 | 5 | 3 | 5 | 28.5
2    | Inicio: fixture no ayuda a armar rápido primeros partidos (ausencias + reglas mixtas...)| 5 | 2 | 5 | 4 | 27.0
3    | Autogestión de carga inconsistente (≈ mitad no carga sin intervención)                  | 4 | 5 | 4 | 2 | 25.5
4    | Fixture: prioridad/orden no acompaña intención (en juego arriba, pendientes abajo)      | 3 | 4 | 4 | 3 | 23.0
5    | Costo alto de “más de una página” para completar la tarea (fixture vs mis resultados)   | 4 | 2 | 4 | 4 | 23.0
6    | Fin de grupos: no se distingue estado real del partido (falta jugar vs falta cargar...) | 3 | 4 | 3 | 3 | 21.0
7    | Fixture: difícil encontrar “quién juega ahora” (4 nombres, orden, homónimos)            | 4 | 3 | 2 | 4 | 20.5
8    | Admin/disputas: ambigüedad al elegir resolución “a favor de quién”                       | 3 | 2 | 4 | 2 | 19.0
9    | Fixture: estado incorrecto de partido (pendiente → finalizado/en juego)                 | 3 | 1 | 4 | 3 | 18.5
10   | Mis resultados: primer uso confuso si hay confirmaciones pendientes y querés cargar...  | 2 | 3 | 2 | 2 | 14.5
11   | Riesgo humano al cargar por otros (6-4 vs 4-6) + disputa posterior                       | 2 | 2 | 2 | 1 | 12.0
12   | “Mi posición” no estaba donde se esperaba (regresión percibida respecto torneo anterior)| 1 | 1 | 1 | 1 | 6.5
```

### TSV (para pegar en Google Sheets / Excel)
Copiá y pegá directo (tab-separado).

```
Rank	Problema (título corto)	S	F	T	C	Score
1	Tabla/posiciones poco confiable en momento crítico (“números raros”)	5	5	3	5	28.5
2	Inicio: fixture no ayuda a armar rápido primeros partidos (ausencias + reglas mixtas + canchas)	5	2	5	4	27.0
3	Autogestión de carga inconsistente (≈ mitad no carga sin intervención)	4	5	4	2	25.5
4	Fixture: prioridad/orden no acompaña intención (en juego arriba, pendientes abajo)	3	4	4	3	23.0
5	Costo alto de “más de una página” para completar la tarea (fixture vs mis resultados)	4	2	4	4	23.0
6	Fin de grupos: no se distingue estado real del partido (falta jugar vs falta cargar vs en juego)	3	4	3	3	21.0
7	Fixture: difícil encontrar “quién juega ahora” (4 nombres, orden, homónimos)	4	3	2	4	20.5
8	Admin/disputas: ambigüedad al elegir resolución “a favor de quién”	3	2	4	2	19.0
9	Fixture: estado incorrecto de partido (pendiente → finalizado/en juego)	3	1	4	3	18.5
10	Mis resultados: primer uso confuso si hay confirmaciones pendientes y querés cargar uno nuevo	2	3	2	2	14.5
11	Riesgo humano al cargar por otros (6-4 vs 4-6) + disputa posterior	2	2	2	1	12.0
12	“Mi posición” no estaba donde se esperaba (regresión percibida respecto torneo anterior)	1	1	1	1	6.5
```

---

## Detalle por problema (con evidencia)

### P1 — Fin de grupos: no se distingue estado real del partido
- **Descripción**: en el fin de grupos, no era claro si un partido estaba **pendiente de jugar**, **jugándose** o **sin cargar**, especialmente cuando “pendientes” aparecían en cancha.
- **Evidencia**: Momento B. Estimación: ~5 partidos sin resultados en el pico.
- **Impacto**: decisiones críticas (copas) con info incompleta; riesgo de elegir ganadores incorrectos.
- **Usuarios afectados**: principalmente **admin/organizador** (y por arrastre todos los jugadores).
- **Cuándo ocurre**: **fin de grupos** (ventana crítica).

### P2 — Tabla/posiciones percibida como poco confiable ("números raros") ✅ RESUELTO
- **Descripción**: métricas de tabla no coincidían con expectativa (p.ej. "3 games a favor" cuando esperabas ~18), generando dudas de interpretación.
- **Evidencia**: triple empate; decisión tomada con confianza parcial ("cerré los ojos y anuncié").
- **Impacto**: cuestionamientos; riesgo real de anuncio incorrecto; pérdida de confianza en el sistema.
- **Usuarios afectados**: **admin/organizador** (y jugadores al validar justicia).
- **Cuándo ocurre**: **fin de grupos** (ventana crítica).

**✅ RESOLUCIÓN (2026-01-30)**:
- **Causa raíz identificada**: Funciones diferentes calculando posiciones en distintas páginas → resultados inconsistentes.
- **Solución implementada**: Centralización de cálculo de tabla en función única [`calcularTablaGrupo()`](../src/utils/tablaPosiciones.js:210).
- **Implementación**: Todos los lugares del sistema (viewer, personal, modal, admin, copas) importan y usan la misma función centralizada.
- **Verificación**: Código auditado - no existe lógica duplicada. Las funciones locales son solo wrappers async que fetch data y llaman a la función central.
- **Resultado**: Garantía de consistencia - mismo grupo muestra mismas posiciones en todas las vistas.

### P3 — Fixture: encontrar “quién juega ahora” es difícil (4 nombres, orden, homónimos)
- **Descripción**: localizar rápidamente el partido correcto es cognitivamente costoso:
  - 4 jugadores por fila
  - orden de pareja (Nico–Diego vs Diego–Nico)
  - posición izquierda/derecha (pueden estar en cualquiera)
  - homónimos (Nico B vs Nico E)
  - teclado/buscador en móvil tapa contenido
- **Evidencia**: relato detallado de búsqueda para decirle a Nico contra quién jugar.
- **Impacto**: consume tiempo; reduce adopción del fixture como herramienta operativa.
- **Usuarios afectados**: **admin/organizador** y jugadores que intentan autogestionarse.
- **Cuándo ocurre**: todo el torneo, pero duele más con **poco margen** entre partidos.

### P4 — Autogestión de carga inconsistente (≈ mitad no carga sin intervención)
- **Descripción**: objetivo era que cada pareja cargue su resultado; ocurrió parcialmente (aprox. mitad).
- **Evidencia**: jugadores alegan desconocimiento pero el factor dominante fue pereza / celular guardado / poco tiempo.
- **Impacto**: sobrecarga para el admin; datos incompletos justo cuando se necesita decidir.
- **Usuarios afectados**: admin; indirectamente todos (tabla/fixture incompletos).
- **Cuándo ocurre**: durante todo el torneo, con pico en fin de grupos.

### P5 — Inicio: fixture no ayuda a armar rápido primeros partidos
- **Descripción**: en el arranque (con ausentes), el fixture no resolvió la decisión de “qué partidos arrancan ya” bajo restricciones reales.
- **Evidencia**: Momento A (3–5 min) terminó usando WhatsApp + cálculo mental + apoyo de Diego.
- **Impacto**: arranque lento y estresante; coordinación manual.
- **Usuarios afectados**: admin/organizador.
- **Cuándo ocurre**: **inicio** (ventana crítica).

### P6 — Fixture: estado incorrecto de partido (pendiente → finalizado/en juego)
- **Descripción**: al menos un partido fue clasificado como en juego/finalizado cuando en realidad estaba pendiente.
- **Evidencia**: era tu partido; no figuraba en pendientes; lo encontraste en finalizados y lo pasaste a pendientes.
- **Impacto**: erosiona confianza; obliga a “chequear por todos lados”.
- **Usuarios afectados**: admin (y cualquiera que use pendientes para coordinar).
- **Cuándo ocurre**: potencialmente en cualquier momento; crítico si pasa al fin de grupos.

### P7 — Fixture: prioridad/orden no acompaña intención (en juego arriba, pendientes abajo)
- **Descripción**: se priorizan visualmente los “en juego”, pero lo más importante para coordinación eran los “pendientes”.
- **Evidencia**: observado durante uso en móvil y coordinación.
- **Impacto**: más scroll/búsqueda; menos adopción.
- **Usuarios afectados**: admin y jugadores.
- **Cuándo ocurre**: durante todo el torneo.

### P8 — Costo alto de usar más de una página para completar tareas (fixture vs mis resultados)
- **Descripción**: varios intentaron cargar resultados desde fixture por haber sido la página explicada/visible; cambiar de contexto a otra página fue costoso.
- **Evidencia**: caso donde jugador abrió la app en fixture, tocó partido y no pudo cargar; tuviste que guiarlo a “Mis resultados”.
- **Impacto**: abandono de autogestión; deriva carga al admin.
- **Usuarios afectados**: jugadores (no técnicos).
- **Cuándo ocurre**: al cargar/confirmar.

### P9 — Mis resultados: primer uso confuso si hay confirmaciones pendientes y querés cargar uno nuevo
- **Descripción**: al entrar por primera vez, el usuario ve primero confirmaciones pendientes (botones grandes) y puede no llegar a la sección de carga nueva sin guía.
- **Evidencia**: jugador con apuro; necesitó que le indiques que baje para encontrar el partido a cargar.
- **Impacto**: frena autogestión; aumenta soporte 1:1.
- **Usuarios afectados**: jugadores.
- **Cuándo ocurre**: cuando alguien entra tarde y quiere “cargar ya”.

### P10 — Riesgo humano al cargar por otros + disputa posterior
- **Descripción**: cuando el admin carga por otro, aumenta el riesgo de error de orientación (ganador/perdedor).
- **Evidencia**: cargaste 6-4 en lugar de 4-6; rival corrigió por el camino diseñado; quedó disputa y se resolvió como admin.
- **Impacto**: tiempo extra, datos inconsistentes transitorios, potencial impacto en tabla.
- **Usuarios afectados**: admin y parejas involucradas.
- **Cuándo ocurre**: cuando el admin “se hace cargo” por pereza/ausencias.

### P11 — Admin/disputas: ambigüedad al elegir resolución “a favor de quién”
- **Descripción**: interfaz con dos resultados posibles no deja claro cuál corresponde a qué jugador ni qué implica cada opción.
- **Evidencia**: elegiste la 3ª opción manual (inputs por games) por claridad.
- **Impacto**: carga mental; riesgo de elegir mal; pero resoluble rápido.
- **Usuarios afectados**: admin.
- **Cuándo ocurre**: cuando hay disputas.

### P12 — “Mi posición” no estaba donde se esperaba
- **Descripción**: buscaste la posición en “Mis resultados” como en la versión anterior y no la encontraste durante el torneo.
- **Evidencia**: Momento B (nota al pie).
- **Impacto**: fricción para el jugador-organizador; más navegación en momento de presión.
- **Usuarios afectados**: admin/jugador.
- **Cuándo ocurre**: durante el torneo cuando querés ubicarte rápido.

---

## Señales de éxito (sin diseño) — para los Top 5
Estas son “pruebas de realidad” para validar que el problema dejó de doler, sin adelantar cómo.

### P1 — Estados fin de grupos
- **Señal de éxito**: en fin de grupos, el organizador puede responder “qué falta” (jugar vs cargar) en <60s sin preguntar en cancha.

### P2 — Confianza tabla/posiciones
- **Señal de éxito**: ante un triple empate, el organizador puede explicar el ranking usando la tabla sin “cerrar los ojos” ni dudar del significado de las métricas.

### P3 — Encontrar “quién juega ahora”
- **Señal de éxito**: en móvil, decirle a un jugador “tu próximo partido es vs X” lleva <30s incluso con nombres repetidos.

### P4 — Autogestión de carga
- **Señal de éxito**: en un torneo similar, la proporción de partidos con resultado cargado por jugadores llega a un nivel que evita picos de “carga masiva” al final (sin que el admin tenga que entrar como otros usuarios).

### P5 — Arranque con ausentes
- **Señal de éxito**: con canchas limitadas y ausencias, el organizador arma los primeros partidos sin recurrir a WhatsApp/cálculo manual y sin demoras >2 min.

