# Guía de Testing: Sistema de Carga Distribuida

## Aplicar cambios en Base de Datos

### Opción 1: Aplicar migración en Supabase

Si usas Supabase local o CLI:

```bash
supabase migration up
```

### Opción 2: Ejecutar SQL directo en Supabase Dashboard

1. Abrí Supabase Dashboard
2. SQL Editor
3. Copiá y ejecutá el contenido de:
   `supabase/migrations/20260119140000_add_estado_partidos.sql`

### Opción 3: Ejecutar desde consola del navegador (solo desarrollo)

```javascript
// En la consola del navegador, ejecutar:
const { supabase, TORNEO_ID } = await import('./src/carga/context.js');

// Verificar estructura actual
const { data } = await supabase.from('partidos').select('*').limit(1);
console.log('Campos actuales:', Object.keys(data[0]));
```

---

## Testing Manual - Flujo Completo

### Preparación

1. Iniciar servidor:
```bash
npm run dev
```

2. Limpiar localStorage:
```javascript
localStorage.removeItem('torneo_identidad');
location.reload();
```

---

### TEST 1: Identificación y Vista Personalizada

**Objetivo:** Verificar que la identificación funcione y la vista personalizada se cargue correctamente.

1. Abrí `http://localhost:5173/` (index.html)
2. ✅ Debería ver "¿Quién sos?"
3. Buscá un jugador (ej: "Ari Kan")
4. Seleccioná el jugador correcto
5. Elegí el compañero correcto
6. ✅ Debería ver la vista personalizada con:
   - Header con nombre de pareja
   - Botón "Cambiar de pareja"
   - Secciones según estado de partidos
   - Botón "Ver todos los grupos"

**Verificaciones:**
- [ ] Vista personalizada se carga
- [ ] Muestra solo partidos de la pareja identificada
- [ ] Botón "Cambiar de pareja" funciona
- [ ] Botón "Ver todos los grupos" muestra vista completa

---

### TEST 2: Carga de Resultado (Primera Pareja)

**Objetivo:** Primera pareja carga un resultado.

1. En vista personalizada, buscá un partido en "Por cargar"
2. Click en "Cargar resultado"
3. ✅ Debería abrir modal con:
   - Nombres de ambas parejas
   - Identificado claramente cuál sos vos
   - Inputs para games
4. Ingresá resultado (ej: 6 - 4)
5. Click "Guardar resultado"
6. ✅ Debería mostrar mensaje: "Resultado cargado. Esperando confirmación."
7. ✅ El partido debería moverse a sección "Por cargar" con badge "Esperando confirmación"

**En base de datos verificar:**
```javascript
// Consola navegador
const { data } = await supabase
  .from('partidos')
  .select('estado, games_a, games_b, cargado_por_pareja_id')
  .eq('id', 'PARTIDO_ID');
console.log(data[0]);
// Debería mostrar: estado='a_confirmar', games_a=6, games_b=4, cargado_por_pareja_id=[UUID]
```

**Verificaciones:**
- [ ] Modal se abre correctamente
- [ ] Resultado se guarda
- [ ] Estado cambia a 'a_confirmar'
- [ ] cargado_por_pareja_id se guarda
- [ ] Vista se actualiza

---

### TEST 3: Confirmación (Segunda Pareja - Coincide)

**Objetivo:** Segunda pareja confirma el mismo resultado.

1. Cambiá de pareja (botón "Cambiar de pareja" o reset localStorage)
2. Identificate como la otra pareja del partido
3. ✅ Debería ver una alerta amarilla: "⚠️ 1 resultado requiere tu atención"
4. ✅ Debería ver el partido en "Por confirmar"
5. ✅ Debería mostrar el resultado cargado: "6 - 4"
6. Click "Confirmar este resultado"
7. Ingresá el MISMO resultado (6 - 4) en el modal
8. ✅ Debería mostrar: "¡Resultado confirmado! Ambas parejas coinciden."
9. ✅ El partido debería moverse a "Partidos confirmados"

**Verificaciones:**
- [ ] Alerta de pendientes aparece
- [ ] Resultado pre-cargado se muestra
- [ ] Confirmación funciona
- [ ] Estado cambia a 'confirmado'
- [ ] Partido desaparece de pendientes

---

### TEST 4: Conflicto (Segunda Pareja - No Coincide)

**Objetivo:** Segunda pareja carga un resultado diferente.

1. Repetí TEST 2 con una pareja
2. Cambiá a la otra pareja
3. En "Por confirmar", click "Cargar resultado diferente"
4. Ingresá un resultado DIFERENTE (ej: 4 - 6 en lugar de 6 - 4)
5. ✅ Debería mostrar: "Los resultados no coinciden. El partido pasó a revisión."
6. ✅ El partido debería aparecer en "Partidos en revisión"
7. ✅ Debería mostrar ambos resultados lado a lado

**En base de datos verificar:**
```javascript
const { data } = await supabase
  .from('partidos')
  .select('*')
  .eq('id', 'PARTIDO_ID');
console.log(data[0]);
// estado='en_revision', games_a=6, games_b=4, resultado_temp_a=4, resultado_temp_b=6
```

**Verificaciones:**
- [ ] Conflicto se detecta
- [ ] Estado cambia a 'en_revision'
- [ ] resultado_temp se guarda
- [ ] Ambos resultados se muestran
- [ ] Aparece en sección correcta

---

### TEST 5: Resolver Conflicto (Jugadores)

**Objetivo:** Jugadores resuelven el conflicto sin admin.

**Opción A: Aceptar otro resultado**

1. En "Partidos en revisión", click "Aceptar resultado de [otra pareja]"
2. Confirmar
3. ✅ Debería resolver el conflicto y confirmar

**Opción B: Volver a cargar**

1. Click "Volver a cargar mi resultado"
2. Ingresá nuevo resultado
3. ✅ Actualiza tu resultado en revisión
4. La otra pareja debe hacer lo mismo o aceptar

**Opción C: Pedir ayuda**

1. Click "Pedir ayuda al admin"
2. Ingresá mensaje opcional
3. ✅ Nota se guarda en `notas_revision`

**Verificaciones:**
- [ ] Aceptar otro resultado funciona
- [ ] Recargar resultado funciona
- [ ] Pedir ayuda guarda nota
- [ ] Estado final es 'confirmado'

---

### TEST 6: Admin Resuelve Conflicto

**Objetivo:** Admin resuelve conflictos desde carga.html.

1. Abrí `http://localhost:5173/carga.html`
2. ✅ Debería ver sección roja arriba: "⚠️ Partidos en revisión (X)"
3. ✅ Muestra ambos resultados lado a lado
4. ✅ Si hay nota, la muestra
5. Opciones:
   - Click "Aceptar primera carga"
   - Click "Aceptar segunda carga"
   - Click "Ingresar resultado correcto"
6. ✅ Conflicto se resuelve y desaparece de la sección

**Verificaciones:**
- [ ] Sección de revisión aparece en carga
- [ ] Admin ve ambos resultados
- [ ] Admin ve notas si existen
- [ ] Todas las opciones funcionan
- [ ] Partido desaparece al resolverse

---

### TEST 7: Admin Carga Directo (Bypass Confirmación)

**Objetivo:** Admin puede cargar resultados directamente como confirmados.

1. En `carga.html`, modo "Pendientes"
2. Editar cualquier partido
3. Ingresar resultado
4. Guardar
5. ✅ Debería guardarse directo como 'confirmado' (sin pasar por a_confirmar)

**Verificaciones:**
- [ ] Admin bypasea sistema de confirmación
- [ ] Estado = 'confirmado' directo
- [ ] No requiere confirmación de parejas

---

### TEST 8: Flujos Edge Cases

**Test 8A: Editar antes de confirmación**

1. Pareja A carga resultado
2. Pareja A click "Editar resultado" (antes de que B confirme)
3. ✅ Debería poder editar
4. ✅ Sigue en estado 'a_confirmar'

**Test 8B: Múltiples partidos pendientes**

1. Identificate como pareja con varios partidos
2. ✅ Debería ver todos los partidos por confirmar/cargar
3. ✅ Alerta muestra cantidad correcta

**Test 8C: Sin partidos**

1. Identificate como pareja que jugó todo
2. ✅ Solo debería ver "Partidos confirmados"
3. ✅ Mensaje claro de que no hay pendientes

---

## Checklist de Funcionalidad Completa

### Base de Datos
- [ ] Migración aplicada correctamente
- [ ] Campos nuevos existen: estado, cargado_por_pareja_id, resultado_temp_a, resultado_temp_b, notas_revision
- [ ] Índices creados
- [ ] Constraint de estados válidos funciona
- [ ] Partidos existentes actualizados a 'confirmado'

### Vista Personalizada (index.html)
- [ ] Identificación funciona
- [ ] Vista personalizada se carga
- [ ] Muestra solo partidos propios
- [ ] Secciones correctas según estados
- [ ] Alertas de pendientes funcionan
- [ ] Badges de estado son correctos
- [ ] Botón "Cambiar de pareja" funciona
- [ ] Botón "Ver todos los grupos" funciona

### Carga de Resultados
- [ ] Modal se abre correctamente
- [ ] Inputs funcionan
- [ ] Validaciones funcionan (números válidos)
- [ ] Primera carga → estado 'a_confirmar'
- [ ] Confirmación igual → estado 'confirmado'
- [ ] Confirmación diferente → estado 'en_revision'
- [ ] Mensajes claros en cada caso

### Sistema de Revisión
- [ ] Partidos en revisión se muestran
- [ ] Ambos resultados visibles
- [ ] Opción "Aceptar otro" funciona
- [ ] Opción "Recargar" funciona
- [ ] Opción "Pedir ayuda" funciona
- [ ] Notas se guardan correctamente

### Admin (carga.html)
- [ ] Sección de revisión aparece
- [ ] Ve todos los conflictos
- [ ] Ve notas de jugadores
- [ ] Puede aceptar resultado 1
- [ ] Puede aceptar resultado 2
- [ ] Puede ingresar resultado manual
- [ ] Carga directa como 'confirmado'

### Estilos y UX
- [ ] Todo está centrado correctamente
- [ ] Colores por prioridad funcionan
- [ ] Modal responsive
- [ ] Alertas visibles
- [ ] Badges legibles
- [ ] Responsive funciona en móvil

---

## Troubleshooting

### "No se ve la vista personalizada"

1. Verificar que estés identificado:
```javascript
JSON.parse(localStorage.getItem('torneo_identidad'))
```

2. Verificar consola para errores

3. Verificar que la migración se aplicó:
```javascript
const { data } = await supabase.from('partidos').select('estado').limit(1);
console.log(data[0]); // Debe tener campo 'estado'
```

### "Modal no se abre"

1. Verificar que `window.app` está definido:
```javascript
console.log(window.app); // Debe tener funciones
```

2. Verificar errores en consola

### "No veo partidos en revisión"

1. Verificar que existan en la DB:
```javascript
const { data } = await supabase
  .from('partidos')
  .select('*')
  .eq('estado', 'en_revision');
console.log(data);
```

2. Forzar uno manualmente:
```javascript
await supabase
  .from('partidos')
  .update({
    estado: 'en_revision',
    games_a: 6,
    games_b: 4,
    resultado_temp_a: 4,
    resultado_temp_b: 6
  })
  .eq('id', 'ALGUN_PARTIDO_ID');
```

---

## Próximos Pasos (Post-Testing)

Una vez que todo funcione:

1. **Deploy a producción**
   - Aplicar migración en DB de producción
   - Deploy del código

2. **Comunicación a usuarios**
   - Explicar nuevo sistema de carga
   - Compartir link de index.html (viewer)
   - Recordar que admin sigue usando carga.html

3. **Monitoreo**
   - Ver cuántos partidos quedan en 'a_confirmar' mucho tiempo
   - Ver cantidad de conflictos (en_revision)
   - Ajustar UX según feedback

---

## Logs útiles para debugging

```javascript
// Ver todos los estados actuales
const { data } = await supabase
  .from('partidos')
  .select('id, estado, games_a, games_b, cargado_por_pareja_id')
  .eq('torneo_id', TORNEO_ID);

const porEstado = {};
data.forEach(p => {
  const estado = p.estado || 'pendiente';
  porEstado[estado] = (porEstado[estado] || 0) + 1;
});

console.table(porEstado);
// Ejemplo output:
// pendiente: 15
// a_confirmar: 3
// confirmado: 8
// en_revision: 1
```

---

## Rollback (si algo falla)

Para revertir cambios de DB:

```sql
-- Eliminar columnas agregadas
ALTER TABLE public.partidos 
DROP COLUMN IF EXISTS estado,
DROP COLUMN IF EXISTS cargado_por_pareja_id,
DROP COLUMN IF EXISTS resultado_temp_a,
DROP COLUMN IF EXISTS resultado_temp_b,
DROP COLUMN IF EXISTS notas_revision;

-- Eliminar índices
DROP INDEX IF EXISTS idx_partidos_estado;
DROP INDEX IF EXISTS idx_partidos_cargado_por;
```

Para revertir código: revertir commits de Git.
