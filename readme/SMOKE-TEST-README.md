# 🧪 Smoke Test - Sistema Torneo Pádel

## ✅ Diseño Completo - Listo para Usar

Este directorio contiene el **diseño completo** de un smoke test para que un agente de IA (o QA humano) evalúe las funcionalidades críticas del sistema de torneo de pádel.

---

## 🚀 Quick Start

### Para Agente de IA

**Paso 1**: Proporcionar este prompt al agente:

```
Sos un QA Automation Engineer experto. Tu tarea es ejecutar un smoke test completo del 
sistema de torneo de pádel y generar un informe detallado.

Lee completamente el archivo AI-AGENT-PROMPT.md que contiene todas las instrucciones.
Luego ejecuta los test cases definidos en SMOKE-TEST-CASES.md.
Finalmente, genera un informe usando SMOKE-TEST-REPORT-TEMPLATE.md como base.

Sistema a testear: https://torneo-padel-teal.vercel.app/
```

**Paso 2**: Adjuntar estos archivos al contexto:
- `AI-AGENT-PROMPT.md`
- `SMOKE-TEST-CASES.md`
- `SMOKE-TEST-REPORT-TEMPLATE.md`

**Paso 3**: El agente ejecutará los 19 test cases y generará el informe automáticamente.

---

### Para QA Humano

1. **Leer**: `SMOKE-TEST-COMPLETO.md` para entender el sistema completo
2. **Ejecutar**: Test cases desde `SMOKE-TEST-CASES.md` en orden de prioridad
3. **Documentar**: Resultados en una copia de `SMOKE-TEST-REPORT-TEMPLATE.md`

---

## 📚 Documentos Incluidos

| Documento | Propósito | Páginas | Estado |
|-----------|-----------|---------|--------|
| **[SMOKE-TEST-COMPLETO.md](./SMOKE-TEST-COMPLETO.md)** | 📚 Documento maestro - Guía general del sistema | ~15 | ✅ Completo |
| **[SMOKE-TEST-CASES.md](./SMOKE-TEST-CASES.md)** | 📝 19 test cases detallados con validaciones | ~30 | ✅ Completo |
| **[AI-AGENT-PROMPT.md](./AI-AGENT-PROMPT.md)** | 🤖 Prompt completo para agente de IA | ~20 | ✅ Completo |
| **[SMOKE-TEST-REPORT-TEMPLATE.md](./SMOKE-TEST-REPORT-TEMPLATE.md)** | 📊 Template del informe de resultados | ~12 | ✅ Completo |

**Total**: ~77 páginas de documentación completa

---

## 🎯 Cobertura del Smoke Test

### Test Cases por Prioridad

| Prioridad | Cantidad | Test Cases | Criterio |
|-----------|----------|------------|----------|
| 🔴 **CRÍTICA** | 8 | TC-001 a TC-008 | 100% PASS requerido |
| 🟡 **ALTA** | 6 | TC-009 a TC-012, TC-015, TC-016 | ≥90% PASS requerido |
| 🟢 **MEDIA** | 5 | TC-013, TC-014, TC-017 a TC-019 | ≥80% PASS requerido |
| **TOTAL** | **19** | - | - |

### Roles Cubiertos

- ✅ Jugador/Viewer (vista personal)
- ✅ Cargador de Resultados
- ✅ Administrador (parejas, grupos, copas)
- ✅ Vista General (resultados públicos)
- ✅ Analytics (métricas de uso)

### Funcionalidades Validadas

#### Jugador/Viewer (CRÍTICO)
- ✅ Identificación de jugador
- ✅ Vista personalizada de partidos
- ✅ Carga de resultados (primera carga)
- ✅ Confirmación de resultados
- ✅ Gestión de conflictos

#### Cargador de Resultados (CRÍTICO)
- ✅ Vista de carga general
- ✅ Carga directa de admin (bypass confirmación)
- ✅ Resolución de conflictos

#### Administrador (ALTA)
- ✅ Gestión de parejas (import desde Excel)
- ✅ Gestión de grupos (ranking, ordenamiento manual)
- ✅ Gestión de copas (asignación automática incremental)
- ✅ Modo seguro (protección contra acciones destructivas)

#### Otros (MEDIA)
- ✅ Vista general pública
- ✅ Dashboard de analytics
- ✅ Navegación y UX/UI
- ✅ Performance básica

#### Validaciones Técnicas (ALTA)
- ✅ Integridad de base de datos
- ✅ Consistencia de datos
- ✅ Tracking de eventos

---

## 📋 Estructura de los Test Cases

Cada test case incluye:

```markdown
### TC-XXX: [Nombre]

**Rol**: [Rol de usuario]
**Prioridad**: [Crítica/Alta/Media]
**Pre-condiciones**: [Estado requerido del sistema]

**Pasos**:
1. [Acción específica]
2. [Acción específica]
...

**Resultado Esperado**: 
[Comportamiento esperado del sistema]

**Validaciones DB**:
```sql
-- Query SQL para verificar en la base de datos
```

**Validaciones LocalStorage/Tracking**:
[Validaciones adicionales]
```

---

## 🎓 Ejemplo de Uso

### Caso: Ejecutar smoke test después de un deploy

**Contexto**: Acaban de hacer deploy de una nueva versión a producción y necesitan verificar que las funcionalidades críticas funcionan.

**Proceso**:

1. **Preparar el prompt para el agente de IA**:
   ```
   El sistema de torneo de pádel acaba de ser actualizado en producción.
   
   Ejecutá un smoke test completo siguiendo las instrucciones en AI-AGENT-PROMPT.md.
   
   URL del sistema: https://torneo-padel-teal.vercel.app/
   
   Ejecutá TODOS los test cases de prioridad CRÍTICA y ALTA.
   Los test cases de prioridad MEDIA son opcionales si el tiempo lo permite.
   
   Generá un informe completo usando el template SMOKE-TEST-REPORT-TEMPLATE.md.
   ```

2. **El agente ejecuta**:
   - TC-001 a TC-008 (CRÍTICOS): 8 tests
   - TC-009 a TC-012, TC-015, TC-016 (ALTA): 6 tests
   - Total: 14 test cases críticos en ~1 hora

3. **El agente genera informe** con:
   - Resumen: "14 tests ejecutados, 13 PASS, 1 FAIL"
   - Defecto encontrado: "TC-004: Alerta de pendientes no aparece (Severidad: Mayor)"
   - Recomendación: "Fix de prioridad P1 - no bloqueante pero afecta UX"
   - Conclusión: "✅ SMOKE TEST PASA (1 defecto menor, 0 bloqueantes)"

4. **Equipo de desarrollo**:
   - Lee el informe
   - Identifica el bug en el código
   - Crea ticket para fix
   - Sistema considerado estable para uso

---

## ⚙️ Configuración Requerida

### Acceso al Sistema

- **URL Producción**: https://torneo-padel-teal.vercel.app/
- **URL Desarrollo**: http://localhost:5173/ (si aplica)

### Acceso a Base de Datos

Los test cases requieren validaciones de DB. Se accede desde la consola del browser:

```javascript
// Importar cliente Supabase
const { supabase, TORNEO_ID } = await import('/src/carga/context.js');

// Ejecutar validaciones
const { data } = await supabase.from('partidos').select('*');
console.table(data);
```

### Datos de Prueba Requeridos

El sistema debe tener:
- ✅ Al menos 12 parejas en 3 grupos (4 parejas por grupo)
- ✅ Mix de estados de partidos: pendiente, a_confirmar, confirmado, en_revision
- ✅ Al menos 1 copa configurada
- ✅ Algunos eventos de tracking históricos (se generan al ejecutar tests)

**Si no hay datos**: Usar TC-009 para importar parejas desde Excel (⚠️ solo en desarrollo).

---

## 📊 Criterios de Éxito

### ✅ El Smoke Test PASA si:
- 🔴 **100%** de tests CRÍTICOS pasan (8 de 8)
- 🟡 **≥90%** de tests ALTA pasan (≥5 de 6)
- 🟢 **≥80%** de tests MEDIA pasan (≥4 de 5)
- ⚠️ **0** defectos BLOQUEANTES

### ❌ El Smoke Test FALLA si:
- Cualquier test CRÍTICO falla
- Más de 3 defectos bloqueantes
- Defectos de seguridad (RLS bypass, data leaks)

---

## 🔧 Troubleshooting

### "El agente no puede acceder a la base de datos"

**Solución**: Las validaciones de DB se ejecutan desde la consola del browser. Instrucciones están en AI-AGENT-PROMPT.md sección "Acceso a la Base de Datos".

### "No hay datos de prueba en el sistema"

**Solución**: 
1. Si estás en desarrollo, ejecutar TC-009 para importar parejas
2. Si estás en producción, documentar como "BLOCKED - Falta de datos" y sugerir crear script de seed

### "El test TC-009 es destructivo"

**Correcto**. TC-009 (Import de Parejas) borra y recrea datos. Solo ejecutar en desarrollo/testing, NUNCA en producción.

### "¿Puedo ejecutar solo algunos test cases?"

Sí, pero como mínimo debes ejecutar TODOS los tests CRÍTICOS (TC-001 a TC-008) para considerar el smoke test válido.

---

## 📈 Próximos Pasos

### Fase Actual: Diseño Completo ✅
- [x] 19 test cases diseñados
- [x] Prompt para agente de IA
- [x] Template de informe
- [x] Documentación completa

### Fase 2: Automatización (Futuro)
- [ ] Implementar con Playwright/Puppeteer
- [ ] Script de seed data
- [ ] Integración con CI/CD
- [ ] Dashboard de resultados

---

## 📞 Soporte

Para consultas sobre este smoke test:

- **Documentación**: Leer `SMOKE-TEST-COMPLETO.md`
- **Issues**: Crear issue en el repositorio
- **Mejoras**: Sugerir cambios a los test cases

---

## 📝 Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | Enero 2026 | Diseño inicial completo - 19 test cases, documentación completa |

---

## ✨ Resumen

**Este diseño está COMPLETO y LISTO PARA USAR.**

Tenés todo lo necesario para:
1. ✅ Ejecutar un smoke test completo (manual o con agente de IA)
2. ✅ Validar las 19 funcionalidades críticas del sistema
3. ✅ Generar un informe profesional con métricas y recomendaciones
4. ✅ Tomar decisiones de calidad basadas en resultados objetivos

**Empezá por**: `AI-AGENT-PROMPT.md` si usás un agente, o `SMOKE-TEST-COMPLETO.md` si ejecutás manualmente.

---

**¡Buena suerte con el testing! 🚀**
