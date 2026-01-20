# Cambios: Sistema de Puntos y Dashboard

## Resumen de cambios

### 1. Dashboard reordenado ✅

**Antes:**
1. Partidos jugados
2. Por jugar
3. Partidos ganados
4. Posición en tabla

**Ahora:**
1. **Posición en tabla** (solo si hay partidos jugados)
2. **Por jugar**
3. **Partidos jugados** (resaltado)

**Eliminado:** "Partidos ganados" (no se muestra más)

**Diseño:**
- Si no hay partidos jugados, solo muestra "Por jugar" y "Partidos jugados"
- La posición aparece primero cuando hay al menos 1 partido jugado
- "Partidos jugados" mantiene el resaltado celeste

---

### 2. Nuevo sistema de puntos ✅

**Antes:**
- Victoria: 3 puntos
- Derrota: 0 puntos
- Empate: 1 punto

**Ahora:**
- **Victoria: 2 puntos**
- **Derrota: 1 punto**
- Empate: 1 punto (aunque no puede haber)

**Aplicado en:**
- Tabla de posiciones del grupo
- Cálculo de posición general
- Todas las estadísticas

**Criterios de desempate (en orden):**
1. Puntos (mayor)
2. Diferencia de games (mayor)
3. Games a favor (mayor)

---

### 3. Indicador visual de empates ✅

**Nuevas reglas:**
- Parejas con **mismo puntaje** se marcan con color naranja
- **Solo si tienen al menos 1 partido jugado**
- Parejas sin partidos NO se marcan como empatadas

**Colores:**
- Fondo: Naranja suave (`rgba(245, 158, 11, 0.1)`)
- Borde izquierdo: Naranja fuerte (`#f59e0b`)

**Casos especiales:**
- Si tu pareja está empatada: combina celeste + naranja (gradiente)
- Al hacer hover: se intensifica el color

---

## Archivos modificados

### 1. `src/viewer/vistaPersonal.js`

**Función `calcularEstadisticas()`:**
- Eliminado cálculo de `partidosGanados`
- Reordenada estructura de retorno

**Función `calcularTablaGrupo()`:**
- Cambiado: Victoria = 2 pts, Derrota = 1 pt
- Agregada lógica de detección de empates
- Marcado con `empatado: true/false`
- Solo marca empate si `jugados > 0`

**Función `calcularPosicionEnTabla()`:**
- Cambiado: Victoria = 2 pts, Derrota = 1 pt
- Agregado tracking de `gamesAFavor` y `gamesEnContra`
- Ordenamiento igual que tabla completa (dif games, luego GF)

**Renderizado HTML:**
- Dashboard reordenado (posición primero)
- Tabla con clase `empatado` cuando corresponde
- Combinación de clases: `mi-pareja empatado`

### 2. `style.css`

**Nuevos estilos:**
```css
.tabla-grupo tbody tr.empatado {
  background: rgba(245, 158, 11, 0.1);
  border-left: 3px solid #f59e0b;
}

.tabla-grupo tbody tr.mi-pareja.empatado {
  background: linear-gradient(...);
  border-left: 3px solid #f59e0b;
}
```

---

## Ejemplos visuales

### Ejemplo 1: Tabla sin empates
```
Pos | Pareja        | PJ | G | P | GF | GC | Dif | Pts
----+---------------+----+---+---+----+----+-----+----
 1  | Juan - María  | 3  | 3 | 0 | 18 | 12 | +6  | 7   ← (3 victorias = 6 pts + 0 derrotas = 6)
 2  | Ana - Carlos  | 3  | 2 | 1 | 16 | 14 | +2  | 5   ← (2 victorias = 4 pts + 1 derrota = 5)
 3  | Luis - Sofía  | 3  | 1 | 2 | 14 | 16 | -2  | 4   ← (1 victoria = 2 pts + 2 derrotas = 4)
 4  | Pedro - Laura | 3  | 0 | 3 | 12 | 18 | -6  | 3   ← (0 victorias = 0 pts + 3 derrotas = 3)
```

### Ejemplo 2: Tabla con empates (marcados en naranja)
```
Pos | Pareja        | PJ | G | P | GF | GC | Dif | Pts
----+---------------+----+---+---+----+----+-----+----
 1  | Juan - María  | 3  | 3 | 0 | 18 | 12 | +6  | 7   
 2  | Ana - Carlos  | 2  | 2 | 0 | 12 | 8  | +4  | 5   🟠 (empatado)
 2  | Luis - Sofía  | 2  | 2 | 0 | 12 | 10 | +2  | 5   🟠 (empatado)
 4  | Pedro - Laura | 3  | 0 | 3 | 12 | 18 | -6  | 3   
 5  | Martín - Vale | 0  | 0 | 0 | 0  | 0  | 0   | 0   ← NO marcado (sin partidos)
```

---

## Testing recomendado

### Test 1: Verificar nuevo sistema de puntos
1. Pareja A gana 3 partidos
2. ✅ Debería tener 6 puntos (3 × 2)
3. Pareja B pierde 3 partidos
4. ✅ Debería tener 3 puntos (3 × 1)

### Test 2: Dashboard reordenado
1. Entrar sin partidos jugados
2. ✅ NO ver "Posición en tabla"
3. ✅ Ver "Por jugar" y "Partidos jugados"
4. Jugar 1 partido
5. ✅ Ahora SÍ ver "Posición" primero

### Test 3: Empates visuales
1. Crear 2 parejas con mismo puntaje
2. ✅ Ambas deben tener fondo naranja
3. ✅ Borde izquierdo naranja
4. Si una es tu pareja:
5. ✅ Ver gradiente celeste → naranja

### Test 4: Parejas sin jugar NO se marcan
1. Crear pareja nueva sin partidos
2. Otra pareja también sin partidos (ambas con 0 pts)
3. ✅ NO deben tener marca de empate
4. ✅ Solo fondo normal

### Test 5: Desempate por diferencia
1. Pareja A: 2 victorias, 1 derrota = 5 pts, +4 dif
2. Pareja B: 2 victorias, 1 derrota = 5 pts, +2 dif
3. ✅ Pareja A debe estar primera (mejor dif)
4. ✅ Ambas marcadas como empatadas (mismo puntaje)

---

## Impacto del cambio

**Sistema más equilibrado:**
- Perder ya no es 0 puntos, es 1 punto
- Incentiva participación aunque pierdas
- Menos diferencia entre primeros y últimos

**Más claro visualmente:**
- Posición primero (lo más importante)
- Empates destacados para saber dónde hay disputa
- Dashboard más simple (3 cards en lugar de 4)

**Matemática más justa:**
- Con 3 partidos: máximo 6 pts, mínimo 3 pts
- Rango más chico = tabla más competitiva
- Antes: máximo 9 pts, mínimo 0 pts (muy amplio)

---

## Cálculo de ejemplo

### Escenario: 4 parejas, 3 partidos cada una

**Sistema anterior (Victoria 3, Derrota 0):**
- 1°: 9 pts (3-0)
- 2°: 6 pts (2-1)
- 3°: 3 pts (1-2)
- 4°: 0 pts (0-3)
- **Diferencia:** 9 puntos entre primero y último

**Sistema nuevo (Victoria 2, Derrota 1):**
- 1°: 7 pts (3-0) → 6 por victorias + 1 base = 7
- 2°: 5 pts (2-1) → 4 por victorias + 1 por derrota = 5
- 3°: 4 pts (1-2) → 2 por victoria + 2 por derrotas = 4
- 4°: 3 pts (0-3) → 0 por victorias + 3 por derrotas = 3
- **Diferencia:** 4 puntos entre primero y último

**Resultado:** Tabla más competitiva y equilibrada

---

## Próximos pasos

1. Probar cálculos con datos reales
2. Verificar que los empates se marquen correctamente
3. Verificar orden de dashboard
4. Deploy a producción
