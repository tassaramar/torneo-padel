# Test Plan — Formato de Sets por Torneo

> **Feature**: Formato de sets configurable (1 set / al mejor de 3)
> **Spec**: [spec-formato-sets-por-torneo.md](spec-formato-sets-por-torneo.md)

---

## A. Admin — Selector de formato

1. Ir a `/admin` → tab **Setup**
2. Verificar que arriba de "Parejas" aparece **"Formato del torneo"** con un `<select>`
3. Cambiar de "1 Set" a "Al mejor de 3 sets" → verificar que aparece log "Formato actualizado: Al mejor de 3 sets"
4. Recargar página → verificar que el selector mantiene el valor "Al mejor de 3 sets"

## B. Jugador — Formato 1 Set (default)

5. En Admin → Setup → poner **1 Set**
6. Ir a `/` (home jugador), identificarse
7. Tocar un partido pendiente para cargar resultado
8. Verificar: **un solo bloque** de inputs (Set 1), **sin botón "Agregar Set 2"**
9. Cargar un resultado (ej: 6-3) → verificar mensaje de PARTIDO ("Felicitaciones!" o "Buen partido")

## C. Jugador — Formato 3 Sets

10. En Admin → Setup → poner **Al mejor de 3 sets**
11. Ir a `/` → tocar otro partido pendiente
12. Verificar: **dos bloques** visibles desde el inicio (Set 1 + Set 2), sin boton manual
13. Completar Set 1 (ej: 6-3) → verificar mensaje de SET ("Bien arrancaste! Contame...")
14. Completar Set 2 (ej: 3-6, para empatar 1-1) → verificar que aparece **Set 3 (Super Tiebreak)** automaticamente + mensaje "Tremendo! Contame..."
15. Completar Set 3 (ej: 10-8) → verificar mensaje de PARTIDO final
16. En otro partido, completar Set 1 + Set 2 con victoria 2-0 (ej: 6-4, 6-3) → verificar que Set 3 **no aparece** y el mensaje es de PARTIDO

## D. Carga organizer — Formato 3 Sets

17. Con formato en "Al mejor de 3 sets", ir a `/carga`
18. En partidos **pendientes**: verificar que la card muestra **grid con 3 columnas** (Set 1, Set 2) + STB condicional
19. Completar Set 1 + Set 2 con empate → verificar que aparece columna STB
20. Guardar → verificar que se guarda como confirmado con los 3 sets

## E. Confirmacion y disputas

21. Con formato 3 sets, hacer que un jugador cargue un resultado (2 o 3 sets)
22. En `/carga` → modo **Confirmar**: verificar que la card muestra el resultado completo (ej: "6-3, 4-6, 10-8")
23. Boton **Editar** → verificar que abre grid multi-set con valores pre-cargados
24. En modo **Disputas**: verificar que "Ingresar resultado correcto" abre grid multi-set
