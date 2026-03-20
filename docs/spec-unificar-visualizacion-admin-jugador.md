# Unificar Visualización entre Admin e Index — Spec Funcional

> **Estado**: Borrador — pendiente de priorización
> **Tipo**: Epic (varios sub-ítems independientes)

---

## El problema hoy

La vista del jugador (index.html → modal Tablas/Grupos/Fixture) muestra una versión simplificada de la información que el admin ve en admin.html. Esto genera confusión porque el jugador no tiene acceso a la misma información que se usó para tomar decisiones (sorteos, desempates, estadísticas completas).

### Diferencias actuales

**Tabla de posiciones por grupo:**

| Dato | Admin | Jugador |
|------|:-----:|:-------:|
| Pos, Pareja, PJ, Ganados, Perdidos, Puntos | Sí | Sí |
| Sets favor / contra (SF, SC) | Sí | No |
| Diferencia de sets (DS) | Sí | No |
| Games favor / contra (GF, GC) | Sí | No |
| Diferencia de games (DG) | Sí | No |
| Sorteo superíndice (emoji 🎲) | Sí | Superíndice plano (sin emoji) |
| Colores de cluster de empate | Sí | Sí |
| Leyenda "Posición definida por sorteo" | Sí | No |

**Copa bracket:**

| Dato | Admin | Jugador |
|------|:-----:|:-------:|
| Bracket gráfico con llaves SVG | Sí | No (lista plana) |
| Ganador resaltado (negrita + verde) | Sí | No |
| Indicador "mismo grupo" en cruce | Sí | No |

**Tabla general (cross-grupos):**

| Dato | Admin | Jugador |
|------|:-----:|:-------:|
| Columnas y sorteo inter-grupo | Sí | Sí |
| Separadores entre bloques | Sí | Sí |

La tabla general ya está bastante alineada. Los gaps están en las tablas intra-grupo y en las copas.

---

## Solución propuesta

### Sub-ítem A: Columnas completas en tablas de grupo del jugador

**Qué cambia**: La tabla de posiciones en el modal del jugador (tab Grupos → cada grupo) pasa de 7 columnas a 13, igualando la del admin.

**Antes**: `#, Pareja, PJ, G, P, Dif, Pts`

**Después**: `#, Pareja, PJ, PG, PP, SF, SC, DS, GF, GC, DG, Pts`

**Consideración mobile**: La tabla tiene scroll horizontal en pantallas chicas. Las columnas numéricas son angostas (2-3 caracteres), así que no debería ser un problema de espacio. Si lo es, una alternativa es usar abreviaturas de 1 carácter o agrupar con un sub-header.

**Impacto**: El jugador puede entender por qué un equipo está arriba de otro — ve las mismas stats que el admin.

---

### Sub-ítem B: Sorteo superíndice unificado

**Qué cambia**: Las tablas intra-grupo del jugador muestran el emoji 🎲 con el número de sorteo (igual que el admin) en lugar del superíndice plano actual. Se agrega leyenda "🎲 = Posición definida por sorteo" debajo de la tabla cuando hay sorteos guardados.

**Impacto**: El jugador entiende que la posición se definió por sorteo, no por stats.

---

### Sub-ítem C: Bracket gráfico en vista de copas del jugador

**Qué cambia**: El tab Copas del modal del jugador pasa de una lista plana de partidos a un bracket gráfico con llaves SVG, igual al del admin.

**Antes**: Lista vertical de partidos (Cuartos 1, Cuartos 2... Semi 1... Final)

**Después**: Bracket visual con conexiones entre rondas, ganadores resaltados en negrita con fondo verde.

**Diferencia con admin**: El bracket del jugador es read-only (sin botones de confirmar/editar). Además resalta los partidos donde juega el jugador (fondo diferente o borde).

**Implementación sugerida**: Extraer el componente de bracket de `statusView.js` a un módulo compartido en `src/utils/` que ambas vistas puedan importar. El admin le pasa opciones de interactividad (botones), el jugador lo usa en modo read-only.

**Impacto**: El jugador ve de un vistazo el estado del bracket completo — quién ganó, contra quién juega, qué falta.

---

### Sub-ítem D: Badge H2H cuando el desempate es por enfrentamiento directo

**Qué cambia**: Cuando dos equipos están empatados en todas las stats (puntos, DS, DG, GF) y se desempatan por enfrentamiento directo (H2H), se muestra un badge `H2H` al lado del nombre del equipo que se benefició.

**Diseño**: Superíndice `H2H` con estilo similar al 🎲 de sorteo. Color diferente (ej. azul) para distinguirlo.

**Restricción importante**: Solo mostrar cuando son exactamente 2 equipos empatados. En triple empate el H2H puede ser circular (A le ganó a B, B le ganó a C, C le ganó a A) — no tiene sentido indicar quién "ganó".

**Alcance**: Aplica en ambas vistas (admin + jugador).

**Impacto**: El jugador y el admin entienden por qué un equipo quedó arriba del otro cuando las stats son idénticas.

---

## Orden de implementación sugerido

Los sub-ítems son independientes y se pueden hacer en cualquier orden. Sugerencia por impacto/esfuerzo:

| Orden | Sub-ítem | Esfuerzo | Impacto |
|-------|----------|----------|---------|
| 1 | **A**: Columnas completas | Bajo | Alto — el jugador ve todas las stats |
| 2 | **B**: Sorteo 🎲 unificado | Trivial | Medio — claridad en empates |
| 3 | **C**: Bracket gráfico | Medio | Alto — visual, atractivo |
| 4 | **D**: Badge H2H | Medio | Bajo — edge case de empates exactos |

---

## Archivos clave

**Admin (referencia de cómo se ve "bien"):**
- `src/admin/groups/ui.js` — render de tablas de posiciones con todas las columnas, sorteo 🎲, colores cluster
- `src/admin/copas/statusView.js` — bracket gráfico (`_renderBracket`, `_renderBracketMatch`, `_normalizarPartidosParaBracket`)

**Jugador (lo que hay que mejorar):**
- `src/viewer/modalConsulta.js` — render de tablas en modal (tab Grupos) y copa como lista plana (tab Copas)

**Compartidos (ya existen):**
- `src/utils/tablaPosiciones.js` — cálculo de posiciones (usado por ambos)
- `src/utils/formatoResultado.js` — formateo de resultados (usado por ambos)
- `src/utils/copaRondas.js` — labels de rondas de copa
- `style.css` — clases `.sbracket`, `.sb-match`, `.sb-team`, `.sb-winner` ya definidas

---

## Qué NO cambia

- La tabla general cross-grupos (ya está alineada)
- El fixture (funciona igual en ambas vistas)
- Los cálculos de posiciones (ya son los mismos, vienen de `tablaPosiciones.js`)
- La lógica de desempate (ya existe, solo falta mostrarla al usuario)

---

## Ítems del backlog que se absorben en este epic

- "index.html — tabla de posiciones muestra badge cuando hay sorteo guardado" (CRUDA) → Sub-ítem B
- "index.html — bracket gráfico en vista de copas del jugador" (CRUDA) → Sub-ítem C
- "Grupos — badge H2H cuando el desempate es por enfrentamiento directo" (PRIORIZADA) → Sub-ítem D
