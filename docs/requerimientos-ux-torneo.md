# Requerimientos UX/Funcionales — Torneo (post go-live)

## Objetivo
Definir requerimientos (sin implementación todavía) para mejorar la experiencia del torneo, con foco en:
- **Jugadores como agentes principales** (métrica de éxito: autogestión real).
- **Una sola pantalla principal** post-login (evitar navegar entre páginas).
- **Fixture como modelo principal** de programación (orden global), sin asignación de canchas.
- **Presentismo por torneo** para destrabar el arranque con ausentes.

Fuera de alcance en este documento:
- Cambios de código / implementación.
- Bugs ya resueltos (la tabla tuvo problemas por bugs; se considera corregido).

---

## Vocabulario (para no usar “CTA”)
- **Botón principal**: la acción más importante de la pantalla (lo que más ayuda a operar el torneo).
- **Botón secundario**: acciones relevantes, pero no las más urgentes/frecuentes.
- **Contador**: número visible en un botón/ícono (tipo “badge”) que aparece solo si hay pendientes.

---

## Decisiones ya tomadas (congeladas)
- **No sumamos tareas al organizador** como parte del flujo normal del jugador.
- **El sistema NO asigna canchas**.
  - Los jugadores ven canchas vacías y las ocupan; la app solo define **orden de partidos**.
- **El orden global de partidos (1..N) ya está implementado en `fixture.html` y funciona bien**.
  - No se rediseña desde cero; se considera base del sistema.
- **Doble confirmación de resultados** (para consistencia):
  - una pareja carga; la otra confirma/corrige.
  - Disputas y confirmaciones solo aparecen si hay datos.
- **Presentismo por torneo**:
  - se registra una vez y aplica a todo el torneo.

---

## Documento central por temas (títulos cortos)
Cada tema incluye: intención, comportamiento y criterios de aceptación.

### Tema A — **HomeUnico** (una sola pantalla principal)
**Intención**: que el jugador pueda operar el torneo desde un solo lugar, sin “perderse” entre páginas.

**Componentes obligatorios del Home**:
1) **QuienSoy** (header chico, claro)
2) **MisPendientes** (siempre visible)
3) **Dashboard** (resumen neutro)
4) **ContadoresAccionables** (solo si hay datos)
5) **TablasModal** (consulta rápida: mi grupo/otros/fixture sin salir del Home)

**Criterio de aceptación**:
- Un jugador puede: **ver qué le toca**, **cargar un resultado**, y **resolver disputas/confirmaciones** sin salir del Home.

#### Reglas de layout (orden y jerarquía)
- **Arriba**: **QuienSoy** (chico, siempre visible).
- **Primer bloque operativo**: **MisPendientes** (lista siempre visible).
- **Segundo bloque**: **Dashboard** (resumen neutro; no debe competir visualmente con MisPendientes).
- **Acciones excepcionales**: **ContadoresAccionables** como botones con contador (aparecen solo si existen).
- **Consulta**: botón **Tablas/Grupos** abre modal full-screen con tabs (Mi grupo / Otros grupos / Fixture).

#### Wireframe (texto)
Home (pantalla única):
- Header: QuienSoy (colapsado)
  - “Jugador: X · Pareja: X–Y · Grupo: A”
  - Links: “¿No sos vos?” · “Cambiar presente”
- MisPendientes (siempre visible)
  - Tarjetas de partidos pendientes (orden por fixture)
  - Si pareja incompleta: mensaje + tarjetas bloqueadas
- Dashboard (neutro)
  - “Posición: #” (solo si hay al menos 1 partido cargado en el grupo)
  - “Pendientes: N · Jugados: M”
- ContadoresAccionables (solo si existen)
  - Botón “Disputas (N)” (más llamativo)
  - Botón “Por confirmar (N)” (menos urgente)
- Botón “Tablas/Grupos” (consulta)
  - Abre modal full-screen con tabs: Mi grupo | Otros grupos | Fixture

#### Reglas de comportamiento (HomeUnico)
- **No navegación**: todas las consultas (tablas/fixture) deben volver al Home al cerrar el modal.
- **Siempre operativo**: si el jugador tiene pendientes, el Home debe mostrarlo sin scroll excesivo.
- **Baja carga cognitiva**: evitar que el primer pantallazo muestre “resúmenes” que no ayudan a actuar.

#### Casos y estados (HomeUnico)
1) **Pareja completa presente**:
   - MisPendientes habilitado.
   - Dashboard muestra posición solo si hay datos en el grupo.
2) **Pareja incompleta/no presente** (Opción A acordada):
   - Mensaje claro: “Esperando a tu compañero para habilitar tus partidos.”
   - MisPendientes visible pero “bloqueado por presentismo”.
   - Tablas/fixture accesibles en modo consulta (sin salir del Home).
3) **Sin datos en el grupo**:
   - No mostrar “posición” (evitar confusión).
   - Mostrar solo contadores neutros y pendientes.
4) **Con disputas**:
   - Botón “Disputas (N)” visible y llamativo.
5) **Con pendientes de confirmación**:
   - Botón “Por confirmar (N)” visible pero menos urgente.

#### Criterios de aceptación (medibles)
- **Tiempo a entender**: un jugador identifica “qué tiene que hacer ahora” en <10s.
- **Tiempo a acción**: un jugador llega a “cargar resultado” en <15s desde Home.
- **Sin pérdida de contexto**: el jugador puede consultar tablas y volver a cargar resultados sin “perder” dónde estaba.

---

### Tema B — **QuienSoy** (identidad + presentismo integrado)
**Intención**: el jugador entienda claramente “quién soy” y pueda resolver presentismo sin fricción.

**Contenido (colapsado por defecto)**:
- Nombre + pareja + grupo (y formato de juego si aplica).
- Link: **“¿No sos vos?”** (igual a hoy).
- Link: **“Cambiar presente”** (abre/expande la sección).

**Contenido (expandido)**:
- Estado de presencia:
  - “Estoy yo solo”
  - “Estamos los dos”
- Acciones:
  - “Estoy” (marca presente al usuario)
  - “Mi compañero también” (permite que 1 integrante marque por ambos)

**Comportamiento**:
- Si la pareja queda “completa presente”, la sección **se colapsa** automáticamente.
- Cualquiera de la pareja puede **corregir/desmarcar** si se marcó mal.

**Criterio de aceptación**:
- Un jugador puede marcar presente **por ambos** en <10s sin pedir ayuda.

---

### Tema C — **MisPendientes** (partidos pendientes siempre visibles)
**Intención**: maximizar autogestión y velocidad. Es lo más frecuente y crítico.

**Regla clave**:
- “Partidos por jugar” y “resultado por cargar” son equivalentes a nivel UX porque el sistema no puede asegurar qué ya se jugó.
- Por eso se habla de **“Mis partidos pendientes”** y, cuando corresponde, el jugador **carga resultado** al finalizar.

**Contenido**:
- Lista/tarjetas de partidos pendientes del jugador (ordenados por el orden del fixture).
- Cada tarjeta tiene botón principal “Cargar resultado” cuando corresponde (y/o acceso a detalle).

**Caso: pareja incompleta/no presente**:
- Se muestra mensaje: “Esperando a tu compañero para habilitar tus partidos.”
- El jugador puede ver el torneo en modo lectura (tablas/fixture), pero sus partidos aparecen como “bloqueados por presentismo”.

**Criterio de aceptación**:
- El jugador identifica su próximo partido en <15s.

---

### Tema D — **Dashboard** (resumen neutro)
**Intención**: dar contexto rápido sin distraer del trabajo operativo.

**Contenido**:
- **Posición en tabla**: solo si existe al menos 1 partido cargado en el grupo.
- Contadores neutros:
  - partidos pendientes
  - partidos jugados
- Colores neutros (no “alarma”).

**Criterio de aceptación**:
- El dashboard no desplaza el foco del jugador si tiene pendientes (no debe competir con MisPendientes).

---

### Tema E — **ContadoresAccionables** (confirmaciones y disputas)
**Intención**: que acciones excepcionales sean visibles sin ensuciar la pantalla cuando no aplican.

**Reglas**:
- **Solo aparecen si hay datos**.
- Se muestran como **botones con contador** (tipo badge).
- Prioridad visual:
  - **Disputas**: más llamativo (ej. rojo).
  - **Por confirmar**: menos urgente (debe existir pero no robar foco).

**Criterio de aceptación**:
- Si hay 1 disputa, el jugador lo ve inmediatamente (sin scrollear) y entiende que “no impacta en tabla” hasta resolver.

---

### Tema F — **TablasModal** (consulta rápida sin salir del Home)
**Intención**: el jugador consulte tablas/otros grupos/fixture sin cambiar de página.

**Comportamiento**:
- Botón “Tablas/Grupos” abre un **modal full-screen**.
- El modal tiene **tabs**:
  - “Mi grupo”
  - “Otros grupos”
  - “Fixture”
- Cerrar modal vuelve al Home (sin navegación).

**Criterio de aceptación**:
- Un jugador puede consultar “Mi grupo” y volver a cargar un resultado sin perder el contexto.

---

### Tema G — **PresentismoAdmin** (`presente.html`)
**Intención**: permitir al admin gestionar presentismo de forma granular, sin mezclarlo con `admin.html`.

**Acceso**:
- Pantalla separada: **`presente.html`**
- Acceso **solo admin**, por **URL directa** (sin link visible para jugadores).

**Funciones mínimas**:
- Vista por pareja:
  - completa/incompleta
  - quién marcó a quién (auditabilidad)
- Buscador por jugador (por nombre).
- Acciones rápidas:
  - marcar/desmarcar pareja completa (1 tap)
  - marcar/desmarcar individuo (A o B)
- Botón global: “Están todos presentes”
  - reversible, pero **sin desmarcar** automáticamente a nadie (mantiene a todos presentes).
- Sección “Ausentes”:
  - lista de **jugadores NO presentes** (solo nombres; no se guardan contactos).

**Criterio de aceptación**:
- El admin puede identificar a quién falta y corregir presencia en <30s.

---

### Tema H — **IntegracionPresentismoFixture**
**Intención**: que el arranque se destrabe filtrando a “parejas completas presentes”, sin romper el orden del fixture.

**Reglas**:
- Presentismo habilita/bloquea elegibilidad de la pareja.
- El **orden global** del fixture no cambia: una pareja tardía entra “naturalmente” cuando está presente.
- No se asignan canchas desde el sistema.

**Criterio de aceptación**:
- Al inicio, el fixture muestra claramente qué partidos son “jugables ahora” porque las parejas están presentes.

---

## Pendientes de definición (para el siguiente paso)
Estas decisiones están abiertas y se resolverán tema por tema:
- Texto exacto y microcopy de estados (bloqueado por presentismo, disputa, por confirmar).
- Detalle del modal “Fixture” dentro de TablasModal (qué se muestra exactamente y en qué orden).
- Ajustes de usabilidad del fixture (búsqueda, homónimos, teclado, orden visual), si se decide abordarlo como tema específico.

