Contexto

Web app torneo pádel (Vite + JS vanilla + Supabase + Vercel)

Deploy: https://torneo-padel-teal.vercel.app/

Páginas: / viewer, /carga/ carga resultados, /admin/ admin

Rol del asistente (en el chat)

Analista Funcional Senior (go-live/eventos en vivo)

Desarrollador Senior Full Stack (implementa cambios end-to-end)

Feedback clave del torneo (hechos)

Carga previa fue dolorosa: parejas/grupos se cargaron “a mano” en Supabase editando nombres, con riesgo alto de error por orden y mapeo.

Reemplazo de jugador no quedó reflejado en app (se manejó “de palabra”).

Carga resultados funcionó bien pero encontrar el partido era lento (scroll + nadie sabe su grupo).

Copas: el torneo real necesitó arrancar copas antes de cerrar todos los grupos; la app no soportó ese flujo. Se definieron copas manualmente y partidos de semifinal a 2 sets (la app no lo contemplaba).

Prioridades acordadas (orden)
A (P0), B (P0), D (P1), C (P1)

A) Admin Parejas (P0)

ABM de parejas + carga rápida “pegar desde Excel” con preview/validación.

Objetivo: eliminar edición manual en Supabase y el “mapeo por orden” para que cada pareja quede en su grupo real.

B) Copas manuales registrables (P0) - EN PROGRESO

Sistema flexible de pre-asignación de equipos a copas:
- Asignación manual equipo por equipo (dropdown)
- Asignación automática desde grupos terminados
- Generación de semis con 2, 3 o 4 equipos (flexible)
- Mantiene generación automática full como opción
- Sin bracket: lista de partidos por copa (simple, confiable)

D) Engagement Viewer (P1)

Búsqueda por nombre, QR visible, estados claros.

C) Carga distribuida + confirmación (P1)

Resultado “por confirmar/confirmado/en revisión” con resolución admin.

Siguiente paso

Implementar P0-A primero (ABM + import + asignación correcta a grupos), luego P0-B.