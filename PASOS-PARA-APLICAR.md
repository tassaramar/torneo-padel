# Checklist: Pasos para Aplicar el Sistema

## 1. Aplicar Migración de Base de Datos

**CRÍTICO: Hacer esto PRIMERO antes de usar el código nuevo**

### Opción A: Supabase CLI (recomendado)

```bash
supabase migration up
```

### Opción B: Supabase Dashboard

1. Abrir Supabase Dashboard
2. Ir a "SQL Editor"
3. Copiar contenido de: `supabase/migrations/20260119140000_add_estado_partidos.sql`
4. Ejecutar
5. Verificar que no haya errores

### Opción C: Consola JavaScript (solo desarrollo)

```javascript
// En consola del navegador en localhost
const { supabase } = await import('./src/carga/context.js');

// Verificar campo existe
const { data } = await supabase.from('partidos').select('estado').limit(1);
console.log('Campo estado existe:', data[0].hasOwnProperty('estado'));
```

**Verificación:** Debería mostrar `true`

---

## 2. Probar Localmente

```bash
npm run dev
```

### Test Rápido (5 minutos):

**A. Identificación**
1. Abrir `http://localhost:5173/`
2. Debería ver "¿Quién sos?"
3. Identificarse correctamente
4. ✅ Ver vista personalizada

**B. Carga de resultado**
1. En "Por cargar", click "Cargar resultado"
2. Ingresar resultado (ej: 6 - 4)
3. ✅ Debería guardar y mostrar "Esperando confirmación"

**C. Confirmación**
1. Abrir DevTools (F12) → Consola
2. Ejecutar: `localStorage.removeItem('torneo_identidad'); location.reload();`
3. Identificarse como la otra pareja
4. ✅ Debería ver alerta "⚠️ 1 resultado requiere tu atención"
5. Confirmar con mismo resultado
6. ✅ Debería pasar a confirmado

**D. Admin**
1. Abrir `http://localhost:5173/carga.html`
2. ✅ Debería funcionar sin identificación
3. Cargar cualquier resultado
4. ✅ Debería guardarse como confirmado directo

---

## 3. Testing Completo (Opcional)

Seguir la guía completa en:
**`GUIA-TESTING-SISTEMA-CARGA.md`**

Incluye:
- Test de conflictos
- Test de resolución
- Test de edge cases
- Troubleshooting

---

## 4. Deploy a Producción

### Antes de deployar:

- [ ] Testing local completo
- [ ] Backup de base de datos de producción
- [ ] Aplicar migración en staging (si existe)
- [ ] Documentar cambios para usuarios

### Deploy:

1. **Base de datos:**
   - Aplicar migración en producción
   - Verificar que se ejecutó correctamente
   - Verificar que partidos existentes tienen estado 'confirmado'

2. **Código:**
   - Commit y push a repositorio
   - Deploy según tu proceso normal (Vercel/otro)

3. **Verificación post-deploy:**
   - Abrir sitio de producción
   - Probar identificación
   - Probar carga de resultado
   - Verificar que carga.html funciona

### Comunicar a usuarios:

Mensaje sugerido:
```
📢 Novedad en el torneo!

Ahora podés cargar tus propios resultados:

1. Entrá a [URL_DEL_TORNEO]
2. Identificate con tu nombre (una sola vez)
3. Cuando termines un partido, cargá el resultado
4. Tu rival lo confirmará (o lo corregirá si hay error)

Si algo no coincide, lo podemos resolver entre todos.

¡Más fácil y rápido para todos! 🎾
```

---

## 5. Monitoreo Post-Deploy (Primera Semana)

### Métricas a revisar:

```javascript
// En consola de Supabase o navegador
const { data } = await supabase
  .from('partidos')
  .select('estado')
  .eq('torneo_id', TORNEO_ID);

const estadisticas = {};
data.forEach(p => {
  const estado = p.estado || 'pendiente';
  estadisticas[estado] = (estadisticas[estado] || 0) + 1;
});

console.table(estadisticas);
```

**Alertas:**
- Si muchos partidos en 'a_confirmar' por varios días → recordar a usuarios
- Si muchos 'en_revision' → revisar si UX está clara
- Si nadie usa el sistema → mejorar comunicación

---

## Rollback (Si algo falla)

### Revertir migración:

```sql
ALTER TABLE public.partidos 
DROP COLUMN IF EXISTS estado,
DROP COLUMN IF EXISTS cargado_por_pareja_id,
DROP COLUMN IF EXISTS resultado_temp_a,
DROP COLUMN IF EXISTS resultado_temp_b,
DROP COLUMN IF EXISTS notas_revision;

DROP INDEX IF EXISTS idx_partidos_estado;
DROP INDEX IF EXISTS idx_partidos_cargado_por;
```

### Revertir código:

```bash
git revert HEAD~X  # Donde X es cantidad de commits a revertir
```

---

## Archivo de Referencia Rápida

| Necesito... | Archivo |
|-------------|---------|
| Testing completo | GUIA-TESTING-SISTEMA-CARGA.md |
| Detalles técnicos | IMPLEMENTACION-COMPLETADA.md |
| Qué cambió | RESUMEN-IMPLEMENTACION.md |
| Troubleshooting | GUIA-TESTING-SISTEMA-CARGA.md (final) |
| SQL de migración | supabase/migrations/20260119140000_add_estado_partidos.sql |

---

## ¿Listo?

1. [ ] Migración aplicada en Supabase
2. [ ] Testing local exitoso
3. [ ] Documentación leída
4. [ ] Plan de comunicación a usuarios

¡A deployar! 🚀
