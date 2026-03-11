# Test Plan — Aprobación de copas v1.2

> Versión testeada: v1.2.1
> Fecha: —
> Tester: —

---

## Pre-condición base

- Torneo con 2 grupos (A y B), 3 parejas cada uno
- Todos los resultados de grupos cargados desde `carga.html`
- Sin empates dentro de cada grupo ni entre grupos (happy path)
- Esquema de copas definido: Copa Oro (1° de cada grupo), Copa Plata (2°), Copa Bronce (3°)

---

## Bloque 1 — Vista general (paso 3 "Aprobar")

**1.1** Ir a `admin.html` → tab **Copas**. Verificar que el breadcrumb muestra: ✓ Definir plan · ✓ Esperar grupos · **3. Aprobar** · 4. En curso

**1.2** Verificar que aparecen las 3 secciones de copa (Oro, Plata, Bronce) con badge "pendiente de aprobación"

**1.3** Verificar que aparece el botón **🔄 Proponer ahora** en la parte inferior

---

## Bloque 2 — Sección CLASIFICADOS (D1)

**2.1** En Copa Oro: verificar que la sección CLASIFICADOS muestra exactamente 2 equipos con ✅

**2.2** Verificar que cada equipo muestra: nombre · puntos · DS · grupo · posición (ej: "A 1°")

**2.3** Verificar que D1 se auto-confirma (no aparece botón "Confirmar clasificados") cuando no hay empate en frontera

---

## Bloque 3 — Tabla completa collapsible

**3.1** En Copa Oro: verificar que aparece el link **"Ver tabla completa (6 equipos)"**

**3.2** Hacer click → verificar que se expande mostrando los 6 equipos rankeados

**3.3** Verificar que los 2 clasificados tienen ✅ y están en negrita; los 4 restantes están en gris

**3.4** Verificar que hay una línea punteada separando clasificados de no clasificados

**3.5** Verificar que el orden es correcto: mayor puntaje arriba, desempate por DS

**3.6** Hacer click de nuevo → verificar que se cierra

**3.7** Verificar que Copa Plata y Copa Bronce tienen sus propias tablas con sus ✅ distintos

---

## Bloque 4 — Sección CRUCES (D2)

**4.1** En Copa Oro: verificar que la sección CRUCES muestra el cruce generado (Final: equipo A vs equipo B)

**4.2** Verificar que cada equipo en el cruce muestra el grupo entre paréntesis (ej: "Andy · Max (A)")

**4.3** Verificar que aparecen los botones **✅ Aprobar** (individual) y **✏️ Editar cruces**

**4.4** Verificar que no hay warnings ⚠️ "mismo grupo" (los cruces son entre equipos de grupos distintos)

---

## Bloque 5 — Edición de cruces

**5.1** Click en **✏️ Editar cruces** en Copa Oro → verificar que los slots se convierten en `<select>`

**5.2** _(Requiere copa con 4 equipos — ver nota al pie)_ En un cruce, cambiar un equipo por otro del mismo grupo → verificar que aparece badge ⚠️ "mismo grupo" en tiempo real (sin recargar)

**5.3** _(Idem 5.2)_ Volver al cruce correcto (equipos de grupos distintos) → verificar que el badge ⚠️ desaparece

**5.4** Click **↩ Volver a sugeridos** → verificar que los cruces vuelven al estado original

---

## Bloque 6 — Aprobación individual

**6.1** En Copa Plata: click en **✅ Aprobar** solo para ese cruce (sin aprobar Oro ni Bronce)

**6.2** Verificar en `fixture.html` que aparece exactamente 1 partido nuevo de Copa Plata

**6.3** Volver a admin/Copas → verificar que Copa Plata muestra "✅ aprobado" en ese cruce y ya no tiene botón Aprobar individual

**6.4** Verificar que Copa Oro y Bronce siguen con botón Aprobar disponible

---

## Bloque 7 — Aprobar todos

**7.1** En Copa Oro: click en **✅ Aprobar** (aprobar todos los cruces completos)

**7.2** Verificar en `fixture.html` que aparece el partido de Copa Oro

**7.3** En admin/Copas: verificar que Copa Oro pasa a mostrar vista "En curso" (✅ En curso)

---

## Bloque 8 — Copas en curso (post-aprobación)

**8.1** Aprobar Copa Bronce también → verificar que las 3 copas muestran "✅ En curso"

**8.2** Verificar que el breadcrumb avanza a **4. En curso**

**8.3** Verificar que `fixture.html` lista los 3 partidos de copa (uno por copa)

---

## Bloque 9 — Reset

**9.1** Click en **🗑 Reset copas** → seleccionar **"Solo resultados"** → verificar que los partidos de copa siguen en fixture pero sin score

**9.2** Click en **🗑 Reset copas** → seleccionar **"Todo (partidos + plan)"** → verificar que vuelve al paso "1. Definir plan"

**9.3** Verificar que los grupos y resultados de grupos no se modificaron

---

---

> **Nota — pasos 5.2 y 5.3**: el warning "mismo grupo" solo aparece en copas con 4+ equipos donde el seeding cruza equipos del mismo grupo. Con el setup base (Copa Oro = 1° de cada grupo, 2 equipos) los selects solo muestran uno por grupo y no se puede generar la situación. Para testearlo: definir una copa con seeding `modo:'global'` que tome top-4 del ranking general.

---

## Bloque 10 — Regresión básica

**10.1** Después del reset completo, verificar que `index.html` (vista jugador) sigue mostrando los partidos de grupo correctamente

**10.2** Verificar que `fixture.html` no muestra partidos de copa (fueron borrados)

**10.3** Definir plan de copas nuevamente → verificar que el wizard funciona normalmente

---

## Bloque 11 — Zona gris (empate exacto en la frontera)

> Pre-condición: armar grupos donde el equipo que clasifica y el primero que no clasifica empaten en puntos Y en DS (ej: 2 pts, DS 0 los dos). Requiere armar partidos manualmente.

**11.1** Tab Copas → verificar que D1 muestra sección **"zona gris — empate en frontera"** con el equipo excluido y badge ⚠️ "empate frontera"

**11.2** Verificar que el botón ↔ Intercambiar aparece junto al equipo en zona gris

**11.3** Verificar que D2 (cruces) **no está visible** hasta confirmar D1

**11.4** Click ↔ Intercambiar → verificar que el botón cambia a "✓ Seleccionado (X ↔ Y)" y se deshabilita

**11.5** Click **✓ Confirmar clasificados** → verificar que D1 queda confirmado y aparece D2 con los cruces actualizados (el equipo intercambiado ya está en el cruce)

**11.6** Verificar que en la tabla completa (collapsible) el equipo intercambiado aparece con ✅

---

## Bloque 12 — Propuestas progresivas (grupos que terminan de a uno)

> Pre-condición: plan con seeding por posición de grupo (no global). Cargar resultados solo del Grupo A, dejar Grupo B sin terminar.

**12.1** Tab Copas → verificar que ya aparece la sección de la copa (no "Esperando grupos") con el equipo del Grupo A y ⏳ para el Grupo B

**12.2** Verificar que el cruce con slot vacío muestra "⏳ pendiente" en lugar del nombre del equipo

**12.3** Verificar que el botón **✅ Aprobar** está deshabilitado para el cruce con slot vacío

**12.4** Cargar todos los resultados del Grupo B → recargar admin/Copas → verificar que el ⏳ se reemplaza por el nombre del equipo real

**12.5** Verificar que ahora el botón Aprobar queda habilitado

---

## Bloque 13 — Seeding global (copa con top-4 del ranking general)

> Pre-condición: 2 grupos × 3 equipos. Definir una copa que toma `modo:'global'` desde 1 hasta 4. Dejar el Grupo A terminado, Grupo B incompleto.

**13.1** Tab Copas → verificar que la copa muestra "⏳ Esperando grupos… — Grupos completos: 1 de 2" y NO genera propuestas parciales

**13.2** Terminar el Grupo B → recargar → verificar que ahora genera las 2 semis con los top-4 del ranking general

**13.3** Verificar que el orden de los cruces respeta el seeding bombo: 1° vs 4°, 2° vs 3° en la tabla general

**13.4** Si los equipos 1° y 2° son del mismo grupo → verificar que aparece warning ⚠️ "mismo grupo" en D2

---

## Bloque 14 — Validaciones en edición de cruces

> Pre-condición: copa con al menos 2 cruces (bracket-4, 2 semis).

**14.1** Click Editar cruces → en un cruce, seleccionar la **misma pareja en los dos lados** → verificar que el sistema lo impide o muestra un error claro al intentar guardar

**14.2** En un cruce, dejar un slot en "— pendiente —" → click Guardar → verificar comportamiento (¿permite guardar o muestra error?)

**14.3** Mover un equipo del cruce 1 al cruce 2 → verificar que el equipo desaparece del cruce 1 (auto-dedup) y no queda duplicado

**14.4** Click ↩ Volver a sugeridos → verificar que los 2 cruces vuelven exactamente al estado que tenían antes de entrar a edición

---

## Bloque 15 — Reset a medio camino

> Pre-condición: 3 copas, Copa Oro y Copa Plata aprobadas (partidos creados), Copa Bronce todavía pendiente.

**15.1** Click **🗑 Reset copas → Solo resultados** → verificar que los partidos de copa siguen en fixture pero sin scores; Copa Bronce sigue con estado pendiente

**15.2** Click **🗑 Reset copas → Todo** → verificar que las 3 copas se borran, el breadcrumb vuelve a "1. Definir plan", y los resultados de grupos no se tocan

**15.3** Después del reset, ir a `fixture.html` → verificar que no aparece ningún partido de copa

