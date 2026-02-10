# Home Único — Especificación funcional (UX/flujo)

## Objetivo
Definir en detalle la pantalla **Home Único** (post-login) para que el jugador pueda operar el torneo **desde un solo lugar**, minimizando navegación y maximizando autogestión.

## Principios (resumen)
- **Jugadores como agentes principales** (métrica de éxito: autogestión real).
- **Una sola pantalla** para operar (consultas en modal, no navegación).
- **Fixture ordena**, la app **no asigna canchas**.
- **Presentismo por torneo** integrado a “Quién soy”.
- **Confirmaciones/disputas** aparecen solo si existen (con contador).

## Fuera de alcance
- Implementación/código.
- Rehacer el fixture: **el orden global 1..N ya está implementado en `fixture.html` y funciona bien**.
- Correcciones de bugs de tabla (se consideran resueltas).

---

## Vocabulario (para evitar “CTA”)
- **Botón principal**: acción más importante en contexto.
- **Botón secundario**: acción útil pero menos prioritaria.
- **Contador**: número en botón/ícono tipo “badge”.

---

## Layout (jerarquía visual y orden)
La pantalla se compone de estos bloques, en este orden:

1) **Quién soy** (header pequeño, colapsado por defecto)
2) **Mis partidos pendientes** (bloque principal, siempre visible)
3) **Dashboard** (resumen neutro)
4) **Acciones con contador** (solo si hay datos)
5) **Botón de consulta**: “Tablas/Grupos” (abre modal full-screen con tabs)

Regla de oro: **si el jugador tiene algo pendiente, debe verlo sin scrollear demasiado**.

---

## 1) Bloque: “Quién soy” (header + presentismo integrado)

### Estado colapsado (default)
Muestra en 1–2 líneas:
- **Jugador**: Nombre
- **Pareja**: A–B
- **Grupo**: letra/nombre
- (Opcional) **Formato** del grupo: a 5 o 6 games (si aplica)

Links:
- **“¿No sos vos?”** (igual a hoy)
- **“Cambiar presente”** (abre/expande presentismo)

### Estado expandido (presentismo)
Muestra:
- Estado de presencia:
  - **“Estoy yo solo”**
  - **“Estamos los dos”**
- Acciones:
  - **“Estoy”** (marca presente al usuario)
  - **“Mi compañero también”** (cualquiera puede marcar por ambos)
  - **“Desmarcar”** (cualquiera de la pareja puede corregir)

Comportamiento:
- Cuando la pareja queda **completa presente**, el bloque **se colapsa automáticamente**.
- Presentismo es **por torneo**.

Caso: Admin “Están todos presentes”
- Si el admin activó el modo “Están todos presentes”, el home debe comportarse como si todos estuvieran presentes (no requiere flujo de presentismo al jugador).

---

## 2) Bloque principal: “Mis partidos pendientes”

### Concepto
El sistema no puede asegurar qué partidos “ya se jugaron”, por lo que UX trata:
- **“por jugar” = “pendiente”**
El jugador usa el bloque para:
- identificar qué partido le toca
- cargar resultado cuando termina

### Orden
Los partidos aparecen ordenados por:
- **orden global del fixture (1..N)** (lo que ya existe hoy en `fixture.html`)

### Tarjeta de partido (mínimo)
Cada tarjeta muestra:
- **# de partido** (global)
- **Rivales**: NombreA–NombreB vs NombreC–NombreD (formato consistente)
- **Estado visible** (texto corto):
  - “Pendiente”
  - “Resultado cargado por rival — falta confirmar”
  - “En disputa”
  - (Best effort) “En juego” si existe esa marca
- **Acción principal contextual**:
  - Si no hay resultado: **“Cargar resultado”**
  - Si hay resultado del rival: **“Confirmar / Corregir”** (pero sin quitar prioridad a cargar si hay partidos sin resultado)
  - Si disputa: **“Resolver”** (o abrir detalle de disputa)

### Caso: pareja incompleta/no presente (Opción A)
En la cabecera del bloque:
- Mensaje claro: **“Esperando a tu compañero para habilitar tus partidos.”**

En tarjetas:
- Se muestran igual (para contexto), pero con estado:
  - **“Bloqueado por presentismo”**
- Acciones de carga/confirmación se deshabilitan o se explican (según decisión de implementación).

### Reglas de prioridad (dentro del bloque)
- **Cargar resultado** es más prioritario que **confirmar**.
- Disputa es visible, pero no debe ocultar el “qué me toca” (se refuerza con contadores).

---

## 3) Bloque: Dashboard (resumen neutro)
Objetivo: contexto rápido sin distraer.

Contenido:
- **Posición**: solo si en el grupo hay al menos 1 partido cargado/visible.
- Contadores neutros:
  - **Pendientes**: N
  - **Jugados**: M

Reglas:
- Colores neutros (no urgentes).
- No debe empujar hacia abajo el bloque principal.

---

## 4) Acciones con contador (solo si existen)
Estos elementos **no aparecen** si el contador es 0.

### Botón: “Disputas (N)”
- **Más llamativo** (por ejemplo rojo, alto contraste).
- Intención: “hay partidos que no impactan plenamente hasta resolver”.

### Botón: “Por confirmar (N)”
- Visible pero **menos urgente** (no rojo).
- Puede incluir ícono (p.ej. campana) además del número.

Comportamiento al tocar:
- Abre un panel/lista filtrada dentro del Home **o** abre el modal (a definir en implementación).
- Regla: **no navegar a otra página**.

---

## 5) Consulta rápida: Modal “Tablas/Grupos” (full-screen)
Objetivo: poder consultar sin salir del Home.

### Acceso
- Botón en el Home: **“Tablas/Grupos”**

### Comportamiento
- Abre **modal full-screen**
- Tabs dentro del modal:
  - **Mi grupo**
  - **Otros grupos**
  - **Fixture**
- Cerrar modal vuelve al Home inmediatamente.

Reglas:
- No debe romper el contexto de “tareas” del Home.
- Ideal: desde el modal se puede volver a pendientes sin “perderse” (cerrar basta).

---

## Estados globales del Home (casos)

### Caso 1: todo normal (pareja presente)
- “Mis partidos pendientes” habilitado.
- Dashboard visible.
- Contadores visibles solo si hay disputas/confirmaciones.

### Caso 2: pareja incompleta
- Mensaje “esperando a tu compañero”.
- Pendientes visibles pero bloqueados.
- Modal de consulta disponible.

### Caso 3: sin datos de grupo
- Dashboard no muestra posición.

### Caso 4: existen disputas
- Botón “Disputas (N)” aparece (alto contraste).

### Caso 5: existen confirmaciones
- Botón “Por confirmar (N)” aparece (menos urgente).

---

## Criterios de aceptación (medibles)
- **Tiempo a entender**: el jugador entiende “qué hacer ahora” en **<10s**.
- **Tiempo a acción**: llega a “Cargar resultado” en **<15s** desde el Home.
- **Sin navegación**: consultar tablas/fixture y volver no requiere cambiar de página; cerrar modal devuelve al Home.
- **Baja fricción**: confirmaciones/disputas no “tapan” la tarea principal.

---

## Decisiones confirmadas relacionadas (contexto)
- Fixture como modelo principal (orden global) **ya implementado y funciona**.
- El sistema no asigna canchas; los jugadores se autogestionan viendo canchas libres.
- Presentismo por torneo integrado a “Quién soy”.
- Admin tiene pantalla separada `presente.html` (no se implementa acá; solo referencia).

---


