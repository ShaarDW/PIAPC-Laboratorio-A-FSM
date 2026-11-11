---
id: laboratorio-evidencia-validacion-h3
titulo: Evidencia de validación H3
tipo: referencia
audiencia: estudiante
acceso: publico
version: 1
---

# Evidencia de validación H3

- Fecha: 5 de agosto de 2026.
- Entorno: Windows, Node.js 22.6.0, npm 10.8.2.
- Versión evaluada: cambios H3 posteriores a `cf90210`.

| Criterio | Método | Resultado |
|---|---|---|
| Instalación limpia | `npm ci` | 47 paquetes instalados desde lockfile |
| Tipos estrictos | `npm run typecheck` | Sin errores |
| Dominio y aplicación | `npm run test:run` | 39 pruebas aprobadas en 6 archivos |
| Producto web | `npm run build` | 20 módulos compilados en `dist/` |
| Integración completa | `npm run validate` | Tipos, pruebas y build aprobados |
| Servicio de producción | Vite preview y solicitud HTTP local | HTTP 200, 1231 bytes |
| Dependencias conocidas | `npm audit --audit-level=high` | 0 vulnerabilidades informadas |

## Cobertura

- Visión: rango, cono, límite angular, oclusión central, esquina exacta, paso cercano y extremos bloqueados.
- Sonido: radio, vigencia, expiración y valores inválidos.
- Memoria: orden temporal, prioridad, copia de posición y tiempo transcurrido.
- Movimiento: avance parcial, varios puntos, realineación, finalización, dirección y valores inválidos.
- Aplicación: prioridad simultánea y expiración del evento.
- Navegación: éxito, fracaso, extremos inválidos, optimalidad y métricas.

## Riesgo residual

La interacción visual se verifica mediante compilación y arranque HTTP, pero no cuenta aún con automatización de navegador. Los experimentos manuales del documento H3 siguen siendo la comprobación de presentación hasta incorporar pruebas end-to-end.
