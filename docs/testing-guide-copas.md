# Guía de testing — Sistema de Copas (end-to-end)

**Última actualización**: 2026-03-03

---

## Paso 0 — Empezar limpio

1. Admin → **Setup** → "Importar" → pegá la lista de parejas y grupos → **Importar (borra y recrea)**
   - ✅ Fix reciente: ahora limpia también esquemas y propuestas de copa del ciclo anterior
   - Debería recargar la página automáticamente

---

## Paso 1 — Definir plan de copas

2. Admin → **Copas** → verificar que el breadcrumb está en "**1. Definir plan**"
3. Elegir un preset de la lista o crear uno custom con el wizard
   - ⚠️ **Limitación conocida**: el wizard no muestra cuántos grupos/parejas tiene el torneo — tenés que saberlo de memoria (backlog: punto 7)
   - ⚠️ **Limitación conocida**: los presets de usuario se muestran todos, sin filtrar por compatibilidad (backlog: punto 2)
4. Aplicar el preset → verificar que el breadcrumb pasa a "**2. Esperar grupos**"
   - ⚠️ **Bug conocido**: una vez en paso 2, si querés des-seleccionar el esquema, el botón Reset **no aparece**. Workaround: tab Grupos → "Regenerar torneo" (borra todo y vuelve a paso 1)

---

## Paso 2 — Jugar partidos de grupos

5. Desde `fixture.html` (o `index.html` como jugador) → cargar resultados de los partidos de grupos
6. Ambas parejas deben confirmar cada resultado
7. Cuando se confirma el último partido de un grupo, el motor debería generar propuestas automáticamente (fire-and-forget)

---

## Paso 3 — Aprobar propuestas de copa

8. Admin → **Copas** → verificar que el breadcrumb pasó a "**3. Aprobar**"
9. Revisar las propuestas generadas: nombres de copa, parejas asignadas a cada copa
   - Verificar que los seeds son correctos (1ros de grupo a copa oro, etc. según el plan)
   - Verificar que la cantidad de cruces es correcta (ej: copa de 4 equipos → 2 cruces de semifinal)
   - ⚠️ **Bug reportado**: en algunos casos la propuesta muestra 1 partido en vez de 2 cruces para una copa de 4 equipos con seeding por tabla general. Workaround: aplicar el preset nuevamente desde el paso 1. Ver `Bugs-Mejoras-raw.md` para detalle.
10. Clic en **"Aprobar propuestas"** → las copas se generan con sus partidos

---

## Paso 4 — Copas en curso

11. Breadcrumb debe estar en "**4. En curso**"
12. Admin → Copas → verificar la sección de cada copa:
   12.1 Nombre de la copa correcto
   12.2 Las rondas muestran nombre correcto: "Semifinal", "Final", etc. (no "SF", "F") ✅ Fix reciente: labels centralizados en `copaRondas.js`.
   12.3 Los partidos jugados muestran el resultado en games (ej: "6-4, 3-6") y no en sets (ej: "1-0") ✅ Fix reciente: usa `formatearResultado()`.
13. Jugar los partidos de copa desde `fixture.html` o `index.html`

---

## Paso 5 — Vista del jugador durante copa

14. Abrir `index.html` como jugador que tiene partidos de copa
15. Verificar que el partido de copa aparece en su lista de pendientes
16. Verificar que al abrir el modal (Tablas/Grupos/Fixture) → tab **Copas** → se ven las llaves
17. ⚠️ **Limitación conocida**: cuando el jugador termina todos sus partidos (incluidos los de copa), el empty state dice "No tenés partidos pendientes" sin mensaje de cierre (backlog: Doc 7 pendiente de implementar)

---

## Paso 6 — Finales automáticas

18. Confirmar las semis → verificar que las finales se generan automáticamente (RPC `generar_finales_copa`)
19. Jugar la final → confirmar resultado
20. ⚠️ **Limitación conocida**: el breadcrumb seguirá en "4. En curso" aunque todas las copas terminaron — no hay paso 5 "Finalizado" todavía (backlog: Estado Finalizado pendiente de análisis)

---

## Paso 7 — Reimportar parejas (ciclo nuevo)

21. Admin → Setup → Importar nuevas parejas
    - ✅ Fix reciente: limpia correctamente esquemas y propuestas del ciclo anterior
    - ✅ Fix reciente: el toast de error ya no aparece como columna roja
22. Admin → Copas → debe mostrar paso 1 "Definir plan" limpio, sin rastros del ciclo anterior

---

## Resumen de bugs conocidos durante el test

| Bug | Workaround |
|-----|-----------|
| Reset copas no aparece en paso 2 | "Regenerar torneo" desde tab Grupos |
| Propuesta muestra cruces incorrectos (copa 4eq → 1 partido en vez de 2) | Aplicar el preset nuevamente desde paso 1 |
| Wizard no muestra info del torneo (grupos/parejas) | Saberlo de memoria |
| No hay botón Cancelar en el wizard | Navegar con el breadcrumb o recargar |
| No hay estado "Finalizado" al terminar todas las copas | Normal por ahora |
| Presets de usuario no filtran por compatibilidad | Ver todos y elegir el correcto manualmente |
