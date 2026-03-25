# Prompt: Unificar general.html con el modal de consulta

## Contexto
- Leer `CLAUDE.md` antes de hacer cualquier cambio
- Spec completa: `docs/spec-unificar-general-modal.md` — seguirla al pie de la letra

## Tarea

Implementar la spec `docs/spec-unificar-general-modal.md`. En resumen:

1. **Crear `src/viewer/renderConsulta.js`**: extraer las funciones de render de `src/viewer/modalConsulta.js` (renderGrupos, renderCopas, renderFixture, renderTablaGeneral, etc.) como funciones puras que reciben un objeto `state` en vez de leer del `modalState` interno. Incluir también `cargarDatosConsulta(supabase, torneoId)` que retorna el objeto cache.

2. **Reescribir `src/general.js`** (~80 líneas): entry point delgado que crea supabase, lee identidad de localStorage(`torneo_identidad`), crea el state, llama a las funciones de render, e inicia polling cada 30s (con pausa cuando tab no visible — reutilizar el patrón que ya tiene el general.js actual). Si hay identidad → mostrar botón "Ver Mis Partidos" (navega a index.html). Si no → mostrar botón "Identificarme".

3. **Actualizar `general.html`**: cambiar título/subtítulo. Los containers `#tabs-main`, `#viewer-content`, `#viewer-nav-buttons`, `#viewer-status` ya existen.

4. **Actualizar `src/viewer/vistaPersonal.js`**: el botón `#btn-abrir-modal` (línea ~674) pasa de ser un `<button>` que dispara evento a ser un `<a href="/general.html">` con el mismo estilo. Eliminar el event listener (línea ~910-912).

5. **Simplificar `src/personal.js`**: eliminar imports de `modalConsulta.js` (`initModal`, `abrirModal`, `cerrarModal`, `invalidarCache`), eliminar el event listener `abrirModalConsulta` (línea ~80), eliminar llamadas a `initModal()` (líneas ~189, ~203), eliminar `invalidarCache()` del polling (línea ~241).

6. **Eliminar HTML del modal** de `index.html`: borrar el bloque `<div id="modal-consulta">` (líneas ~25-39).

7. **Eliminar `src/viewer/modalConsulta.js`** completamente.

8. **Limpiar CSS**: eliminar de `style.css` las clases del overlay modal: `.modal-fullscreen`, `.modal-fullscreen-content`, `.modal-fullscreen-header`, `.modal-fullscreen-title`, `.modal-fullscreen-close`, `.modal-fullscreen-body`. Mantener TODAS las demás clases `modal-*` (las usan los renders).

## Pasos finales obligatorios

1. `npm run build` → verificar 0 errores
2. Verificar que no quedan imports muertos a `modalConsulta.js` (grep en todo el proyecto)
3. Actualizar `docs/brainstorming-proximas-mejoras.md`: mover "Unificar general.html con el modal de consulta" al historial con fecha y descripción. Mover también "Modal index — interceptar botón Back" (subsumido). Actualizar "Última actualización".
4. `npm version patch`
