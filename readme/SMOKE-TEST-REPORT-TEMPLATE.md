# Informe de Smoke Test - Sistema Torneo Pádel

**Fecha de Ejecución**: [DD/MM/YYYY HH:MM]  
**Ejecutado por**: [Nombre del Agente IA / QA Engineer]  
**Versión del Sistema**: [Commit hash / Fecha de deploy]  
**Ambiente**: [Producción / Desarrollo Local]  
**URL Testeada**: [URL completa]  
**Browser**: [Chrome 120.0 / Firefox 115.0 / Safari 17.0]  
**Duración Total**: [HH:MM:SS]

---

## 📊 Resumen Ejecutivo

### Resultado General

**Total de casos de prueba ejecutados**: [X]  
**✅ PASS**: [Y] ([Z]%)  
**❌ FAIL**: [W] ([Q]%)  
**⏭️ SKIPPED**: [S] ([P]%)

### Conclusión

[✅ El smoke test ha PASADO exitosamente. | ❌ El smoke test ha FALLADO.]

[Explicación breve de la conclusión, mencionando si se cumplieron los criterios de éxito]

---

## 📈 Resultados por Rol

| Rol | Total | Pass | Fail | Skipped | % Éxito |
|-----|-------|------|------|---------|---------|
| Jugador/Viewer | [X] | [Y] | [Z] | [S] | [W]% |
| Cargador de Resultados | [X] | [Y] | [Z] | [S] | [W]% |
| Administrador | [X] | [Y] | [Z] | [S] | [W]% |
| Vista General | [X] | [Y] | [Z] | [S] | [W]% |
| Analytics | [X] | [Y] | [Z] | [S] | [W]% |
| Integridad de Datos | [X] | [Y] | [Z] | [S] | [W]% |
| UX/UI | [X] | [Y] | [Z] | [S] | [W]% |
| Performance | [X] | [Y] | [Z] | [S] | [W]% |

---

## 🎯 Resultados por Prioridad

| Prioridad | Total | Pass | Fail | Skipped | % Éxito | Cumple Criterio |
|-----------|-------|------|------|---------|---------|----------------|
| **CRÍTICA** | [X] | [Y] | [Z] | [S] | [W]% | [✅ SÍ (100% requerido) / ❌ NO] |
| **ALTA** | [X] | [Y] | [Z] | [S] | [W]% | [✅ SÍ (≥90% requerido) / ❌ NO] |
| **MEDIA** | [X] | [Y] | [Z] | [S] | [W]% | [✅ SÍ (≥80% requerido) / ❌ NO] |

---

## 🚨 Bloqueantes Identificados

[Si no hay bloqueantes: "No se identificaron defectos bloqueantes. ✅"]

[Si hay bloqueantes, listar cada uno:]

### Bloqueante #1: [Título descriptivo del defecto]

- **Test Case**: TC-XXX - [Nombre]
- **Funcionalidad Afectada**: [Qué funcionalidad crítica no funciona]
- **Impacto**: [Descripción del impacto en el sistema/usuarios]
- **Pasos para Reproducir**:
  1. [Paso 1]
  2. [Paso 2]
  ...
- **Prioridad de Fix**: [Inmediata / Alta / Media]

[Repetir para cada bloqueante]

---

## 💡 Recomendaciones

### Acciones Inmediatas (P0)

[Lista de acciones que deben tomarse de inmediato, basadas en defectos bloqueantes o críticos]

1. [Acción 1]
2. [Acción 2]
...

### Acciones de Corto Plazo (P1)

[Acciones importantes pero no bloqueantes]

1. [Acción 1]
2. [Acción 2]
...

### Mejoras Sugeridas (P2)

[Mejoras de usabilidad, performance o features deseables]

1. [Mejora 1]
2. [Mejora 2]
...

---

## 📋 Detalle de Pruebas

### JUGADOR/VIEWER - Prioridad: CRÍTICA

---

#### TC-001: Identificación de Jugador

**Rol**: Jugador/Viewer  
**Prioridad**: Crítica  
**Pre-condiciones**: Sistema tiene al menos 4 parejas registradas, localStorage vacío

**Estado**: [✅ PASS / ❌ FAIL / ⏭️ SKIPPED]

[Si PASS:]
**Notas**: [Observaciones relevantes aunque haya pasado]

[Si FAIL:]
**Desvíos**:

##### Desvío 1: [Título del desvío]

- **Paso donde falló**: Paso #X - [descripción]
- **Acción Tomada**: [Qué se intentó hacer]
- **Resultado Esperado**: [Qué debería haber pasado]
- **Resultado Obtenido**: [Qué pasó en realidad]
- **Severidad**: [Bloqueante / Mayor / Menor / Trivial]
- **Evidencia**:
  - Screenshot: [Descripción o URL]
  - Logs:
    ```
    [logs relevantes]
    ```
  - DB State:
    ```sql
    [query y resultado]
    ```
- **Comentarios Adicionales**: [Contexto adicional]
- **Workaround**: [Si existe]

[Si SKIPPED:]
**Razón**: [Por qué se saltó: falta de datos, ambiente no disponible, acción destructiva en producción, etc.]

---

#### TC-002: Vista Personalizada de Partidos

[Repetir estructura para cada TC]

---

### CARGADOR DE RESULTADOS - Prioridad: CRÍTICA

[Repetir estructura para TC-006, TC-007, TC-008]

---

### ADMINISTRADOR - Prioridad: ALTA

[Repetir estructura para TC-009, TC-010, TC-011, TC-012]

---

### VISTA GENERAL - Prioridad: MEDIA

[Repetir estructura para TC-013]

---

### ANALYTICS - Prioridad: MEDIA

[Repetir estructura para TC-014]

---

### INTEGRIDAD DE DATOS - Prioridad: ALTA

[Repetir estructura para TC-015, TC-016]

---

### UX/UI - Prioridad: MEDIA

[Repetir estructura para TC-017, TC-018]

---

### PERFORMANCE - Prioridad: MEDIA

[Repetir estructura para TC-019]

---

## 📊 Métricas de Calidad

### Cobertura Funcional

- **Funcionalidades Críticas Verificadas**: [X] de [Y] ([Z]%)
- **Roles de Usuario Cubiertos**: [X] de 5 (100%)
- **Flujos End-to-End Validados**: [X] de [Y]

### Tasa de Defectos

| Módulo | Defectos Encontrados | Severidad Bloqueante | Severidad Mayor | Severidad Menor |
|--------|---------------------|---------------------|-----------------|-----------------|
| Identificación | [X] | [Y] | [Z] | [W] |
| Carga de Resultados | [X] | [Y] | [Z] | [W] |
| Confirmación | [X] | [Y] | [Z] | [W] |
| Gestión de Conflictos | [X] | [Y] | [Z] | [W] |
| Admin - Parejas | [X] | [Y] | [Z] | [W] |
| Admin - Grupos | [X] | [Y] | [Z] | [W] |
| Admin - Copas | [X] | [Y] | [Z] | [W] |
| Analytics | [X] | [Y] | [Z] | [W] |
| Vista General | [X] | [Y] | [Z] | [W] |
| **TOTAL** | [X] | [Y] | [Z] | [W] |

### Tiempo de Ejecución

| Fase | Duración | % del Total |
|------|----------|-------------|
| Setup y Pre-verificación | [HH:MM:SS] | [X]% |
| Tests Críticos (TC-001 a TC-008) | [HH:MM:SS] | [X]% |
| Tests Alta Prioridad (TC-009 a TC-016) | [HH:MM:SS] | [X]% |
| Tests Media Prioridad (TC-017 a TC-019) | [HH:MM:SS] | [X]% |
| Validaciones de DB | [HH:MM:SS] | [X]% |
| Generación de Informe | [HH:MM:SS] | [X]% |
| **TOTAL** | [HH:MM:SS] | 100% |

---

## 🗂️ Contexto del Ambiente

### Información del Sistema

- **Versión de Vite**: [X.X.X]
- **Versión de Supabase Client**: [X.X.X]
- **Deploy Date**: [DD/MM/YYYY]
- **Commit Hash**: [hash] (si disponible)

### Estado del Torneo

- **Nombre del Torneo**: [Nombre]
- **Estado**: [Pre-inicio / En curso / Finalizado]
- **Cantidad de Parejas**: [X]
- **Cantidad de Grupos**: [X]
- **Cantidad de Copas**: [X]
- **Total de Partidos**: [X]
  - Partidos de Grupo: [Y]
  - Partidos de Copa: [Z]

### Distribución de Estados de Partidos

| Estado | Cantidad | % del Total |
|--------|----------|-------------|
| Pendiente (null) | [X] | [Y]% |
| a_confirmar | [X] | [Y]% |
| confirmado | [X] | [Y]% |
| en_revision | [X] | [Y]% |
| **TOTAL** | [X] | 100% |

### Eventos de Tracking

- **Total de Eventos Registrados**: [X]
- **Eventos tipo 'visita'**: [Y]
- **Eventos tipo 'carga_resultado'**: [Z]
- **Jugadores Únicos Trackeados**: [W]

---

## 📎 Anexos

### Anexo A: Screenshots de Errores

[Si aplica, incluir o referenciar screenshots de cada error encontrado]

1. **TC-XXX - Desvío 1**: [Descripción] - [URL o path del screenshot]
2. **TC-YYY - Desvío 1**: [Descripción] - [URL o path del screenshot]
...

### Anexo B: Logs de Consola

[Logs relevantes capturados durante la ejecución]

```
[Timestamp] TC-XXX: Error al cargar resultado
TypeError: Cannot read property 'id' of undefined
    at cargarResultado.js:145:20
    ...

[Timestamp] TC-YYY: Warning - RLS policy check failed
...
```

### Anexo C: Queries SQL Ejecutadas

[Queries importantes ejecutadas para validaciones]

```sql
-- Verificación de integridad referencial (TC-015)
SELECT p.id FROM parejas p 
LEFT JOIN torneos t ON p.torneo_id = t.id 
WHERE t.id IS NULL;
-- Resultado: 0 filas (OK)

-- Verificación de estados válidos (TC-015)
SELECT DISTINCT estado FROM partidos;
-- Resultado: null, 'a_confirmar', 'confirmado', 'en_revision' (OK)

-- Estado de partidos por grupo (TC-016)
SELECT COUNT(*) FROM partidos WHERE grupo_id IS NOT NULL AND copa_id IS NOT NULL;
-- Resultado: 0 filas (OK - no hay partidos que sean grupo Y copa)
```

### Anexo D: Estado de la Base de Datos

**Pre-Ejecución**:
```
Torneos: 1
Parejas: 12
Grupos: 3
Partidos Totales: 36 (18 de grupo, 0 de copa)
Partidos Pendientes: 10
Partidos Confirmados: 8
Partidos a_confirmar: 0
Partidos en_revision: 0
```

**Post-Ejecución**:
```
Torneos: 1
Parejas: 12
Grupos: 3
Partidos Totales: 36
Partidos Pendientes: 7
Partidos Confirmados: 10
Partidos a_confirmar: 1
Partidos en_revision: 1
Eventos de Tracking: 15 (nuevos durante testing)
```

---

## ✅ Criterios de Éxito - Evaluación Final

| Criterio | Requerido | Obtenido | ✅/❌ |
|----------|-----------|----------|-------|
| Tests CRÍTICOS al 100% | 100% | [X]% | [✅/❌] |
| Tests ALTA al ≥90% | ≥90% | [X]% | [✅/❌] |
| Tests MEDIA al ≥80% | ≥80% | [X]% | [✅/❌] |
| 0 Defectos Bloqueantes | 0 | [X] | [✅/❌] |
| **RESULTADO FINAL** | - | - | [✅ PASS / ❌ FAIL] |

---

## 📝 Notas Finales

### Observaciones Generales

[Cualquier observación general sobre el sistema que no encaja en un test case específico]

### Limitaciones del Testing

[Limitaciones encontradas durante la ejecución: falta de datos, ambiente no ideal, etc.]

### Próximos Pasos Sugeridos

1. [Próximo paso 1 - ej: "Ejecutar regression testing después de fix de bloqueantes"]
2. [Próximo paso 2 - ej: "Considerar tests de carga con 50+ parejas"]
3. [Próximo paso 3 - ej: "Implementar smoke test automatizado en CI/CD"]

---

**Fin del Informe**

---

## 🔄 Historial de Versiones del Informe

| Versión | Fecha | Autor | Cambios |
|---------|-------|-------|---------|
| 1.0 | [DD/MM/YYYY] | [Nombre] | Versión inicial |

---

## 📧 Contacto

**Ejecutado por**: [Nombre del QA / Agente IA]  
**Email**: [email si aplica]  
**Para consultas sobre este informe**: [Información de contacto]
