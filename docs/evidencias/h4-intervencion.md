---
id: laboratorio-evidencia-intervencion-h4
titulo: Registro de intervención H4
tipo: referencia
audiencia: estudiante
acceso: publico
version: 1
---

# Registro de intervención H4

- Fecha 11 de noviembre de 2026.
- Objetivo verificar A* e incorporar la FSM de cinco estados sin mezclar percepción, decisión, búsqueda y locomoción, con pruebas de secuencias y dos trazas.
- Estado inicial `main`, commit `ae98e1a`. Rama de trabajo `h4-fsm-laboratorio`.
- Herramienta Claude (Anthropic), en la app de Claude con acceso a terminal. Modelo configurado `claude-opus-5-5`.

## Pasos

| Orden | Entrada relevante | Acción o herramienta | Resultado observable | Decisión humana |
|---:|---|---|---|---|
| 1 | Consigna del laboratorio | Lectura de AGENTS, especificaciones, arquitectura, hitos, código y pruebas | Fuentes registradas | Aceptado tras revisar el código |
| 2 | Línea base | `npm ci` y `npm run validate` | 39 pruebas aprobadas | Aceptado tras revisar el código |
| 3 | Comparar BFS y A* | Script temporal sobre `LAB_MAP`, luego borrado | Tabla en `h4-validacion.md` | Aceptado tras revisar el código |
| 4 | Verificar A* | `tests/navigation/astarVerification.test.ts` | 14 pruebas aprobadas. A* no se modificó | Aceptado tras revisar el código |
| 5 | Comprobar que las pruebas detectan fallas | Dos mutaciones de A* y dos de la FSM | Todas detectadas. Código restaurado | Aceptado tras revisar el código|
| 6 | Diseñar la FSM | `docs/h4-maquina-estados.md` antes del código | Tabla, políticas e invariantes | Aceptado tras revisar el código |
| 7 | Implementar | Dominio, aplicación y escena en ese orden, con tipos y pruebas tras cada paso | 76 pruebas aprobadas | Aceptado tras revisar el código |
| 8 | Ejecutar en el producto | Build, `vite preview` y Chromium automatizado | Telemetría sin errores de página | Aceptado tras revisar el código |

## Correcciones surgidas de la revisión

- Al descartar un punto de búsqueda en la posición 0 se salteaba el siguiente. Se corrigió antes de probar.
- En Perseguir, después de un fallo de ruta, se replanificaba en el cuadro siguiente sin respetar el intervalo. Se corrigió antes de probar.
- La ruta de la telemetría podía asociarse a un registro equivocado si en un cuadro había dos órdenes. Ahora se asocia al registro cuya orden se aplicó.
- El guion de un escenario elegía una celda sobre una pared. Se corrigió el guion, no la FSM.
- En el navegador el HUD tapaba al guardia y al jugador, y la página seguía diciendo H3 y mostraba el clic de destino. Se corrigieron profundidades y textos.

## Revisión humana pendiente

Antes de entregar, la persona responsable debe leer el diff completo (`git diff main`) y completar la columna de decisiones. En particular conviene revisar la tabla de transiciones contra `guardStateMachine.ts`, la política de eventos simultáneos en `handleGuardFrame` y el límite documentado de Regresar.

## Cierre

- Archivos nuevos `src/domain/behavior/guardStateMachine.ts`, `src/application/simulation/guardController.ts`, `src/application/simulation/guardSetup.ts`, `tests/behavior/guardStateMachine.test.ts`, `tests/behavior/guardScenarios.test.ts`, `tests/navigation/astarVerification.test.ts`, `docs/h4-maquina-estados.md` y las evidencias H4.
- Archivos modificados `src/game/scenes/GameScene.ts`, `src/application/simulation/labLevel.ts` (puntos de patrulla), `index.html`, `README.md`, `docs/hitos.md`.
- Validación `npm run validate` con 76 pruebas aprobadas en 9 archivos.
- Riesgos pendientes, el límite de Regresar, el corte de persecución en el borde del cono y la falta de prueba de navegador dentro de la validación.
- Sin commit ni publicación. Quedan a decisión de la persona responsable.
