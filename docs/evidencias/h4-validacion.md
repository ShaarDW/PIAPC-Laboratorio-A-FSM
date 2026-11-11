---
id: laboratorio-evidencia-validacion-h4
titulo: Evidencia de validación H4
tipo: referencia
audiencia: estudiante
acceso: publico
version: 1
---

# Evidencia de validación H4

- Fecha 11 de noviembre de 2026.
- Entorno Linux, Node.js 22.23.4, npm 10.9.9, Chromium de Playwright para la corrida en navegador.
- Versión rama `h4-fsm-laboratorio` a partir de `main`, commit `ae98e1a`.

## Registro de comandos

| Orden | Comando | Resultado |
|---:|---|---|
| 1 | `npm ci` | Instalación desde el archivo de bloqueo, sin cambios en dependencias |
| 2 | `npm run validate` (línea base) | Tipos sin errores, 39 pruebas aprobadas en 6 archivos, compilación de 20 módulos |
| 3 | `npm audit --audit-level=high` | 5 vulnerabilidades (3 altas) en Vite y launch-editor, dependencias de desarrollo. Ya existían y no se tocaron porque la consigna no permite cambiar dependencias |
| 4 | Comparación BFS y A* sobre `LAB_MAP` (tabla de abajo) | 5 casos, mismo costo en todos |
| 5 | `npx vitest run tests/navigation/astarVerification.test.ts` | 14 pruebas aprobadas |
| 6 | Mutación del desempate de A* y de la heurística (×3) | Las pruebas fallaron en ambos casos, como se esperaba. Código restaurado |
| 7 | `npx vitest run tests/behavior` | 23 pruebas aprobadas |
| 8 | Mutación de la prioridad (sonido antes que visión) y del vencimiento de Buscar | 2 y 3 pruebas fallaron, como se esperaba. Código restaurado |
| 9 | `TRACE_DIR=docs/evidencias npx vitest run tests/behavior/guardScenarios.test.ts` | Genera `h4-traza-normal.json` y `h4-traza-limite.json` |
| 10 | `npx vite preview` y corrida automatizada en Chromium | Sin errores de página. Telemetría guardada en `h4-telemetria-navegador.json` |
| 11 | `npm run validate` (final) | Tipos sin errores, 76 pruebas aprobadas en 9 archivos, compilación de 23 módulos |

## Línea base BFS y A*

Mismo mapa, inicio y objetivo para los dos algoritmos.

| Caso | Inicio → objetivo | Costo BFS | Costo A* | Expandidos BFS | Expandidos A* | Frontera máx. BFS | Frontera máx. A* |
|---|---|---:|---:|---:|---:|---:|---:|
| Guardia a jugador | (27,17) → (2,2) | 40 | 40 | 435 | 41 | 26 | 73 |
| Guardia a sala central | (27,17) → (12,8) | 34 | 34 | 373 | 153 | 26 | 36 |
| Esquina a esquina | (1,1) → (28,18) | 44 | 44 | 439 | 45 | 23 | 43 |
| Pasillo inferior | (2,17) → (27,17) | 25 | 25 | 297 | 26 | 17 | 52 |
| Dentro de la sala | (5,5) → (9,9) | 8 | 8 | 38 | 9 | 8 | 13 |

En estos cinco casos A* expandió menos nodos, pero tuvo una frontera máxima mayor en todos. No se concluye que A* siempre expanda menos. Con un objetivo inaccesible ambos expanden toda la región alcanzable (prueba «enclosed goal», 44 y 44 nodos).

## Verificación de A*

| Criterio | Prueba | Resultado |
|---|---|---|
| Inicio igual a objetivo | Ruta de una celda, costo 0, 1 expandido | Aprobado |
| Extremos inválidos | Inicio fuera, en pared y fraccionario. Objetivo fuera y en pared. Ambos inválidos informan primero el inicio | Aprobado |
| Destino inaccesible | Estado `unreachable`, ruta vacía, costo nulo | Aprobado |
| Ruta que evita bloqueadas | Tres rutas del mapa del laboratorio, celdas transitables y contiguas | Aprobado |
| Mismo costo óptimo que BFS | 400 mapas aleatorios con semilla fija (mulberry32), mismo estado y costo | Aprobado |
| Desvío y desempate reproducible | Menor heurística primero y después orden de inserción. Ruta exacta esperada y resultados idénticos en ejecuciones repetidas | Aprobado |

El proyecto usa costo uniforme, así que BFS sirve de oráculo. La distancia Manhattan es admisible y consistente para movimiento cardinal con costo 1, por eso A* conserva el costo óptimo.

## Cobertura de la FSM

| Caso | Prueba | Resultado |
|---|---|---|
| Patrullar →(sonido) Investigar →(llegada) Buscar | Eventos inyectados | Aprobado |
| Buscar →(tiempo) Regresar →(llegada) Patrullar | Incluye un tick 1 ms antes del vencimiento sin transición | Aprobado |
| Cualquier estado activo →(visión) Perseguir | Los cuatro estados activos | Aprobado |
| Perseguir →(pérdida con memoria) Investigar | Destino igual a la última posición vista | Aprobado |
| Guarda falsa | Sonido durante Perseguir, visión sobre pared, persecución sin memoria | Aprobado |
| Sonido y visión simultáneos | Gana la visión y el sonido queda como descartado | Aprobado en dominio, en escenario y en navegador |
| Destino inaccesible | Investigar → Regresar, punto de patrulla bloqueado, todos bloqueados con reintento, punto de búsqueda descartado | Aprobado |
| Evento repetido | Sonido repetido y llegada repetida sin cambios | Aprobado |
| Reinicio durante persecución | Patrullar con memoria vacía | Aprobado en dominio, en escenario y en navegador |
| Invariantes | Siete invariantes comprobados después de cada evento y de cada cuadro | Aprobado |
| Reproducibilidad | El mismo guion produce la misma traza | Aprobado |

## Trazas

- `h4-traza-normal.json` recorre Patrullar, Investigar un sonido, Buscar, Regresar, Patrullar, Perseguir y perder al jugador.
- `h4-traza-limite.json` recorre un punto de patrulla bloqueado, sonido y visión simultáneos y un reinicio durante la persecución.
- `h4-telemetria-navegador.json` es la telemetría de la escena real en Chromium, con persecución, replanificación cada 500 ms, sonido ignorado y reinicio durante la persecución.

Cada registro tiene tiempo, estado anterior y nuevo, evento, tipo, guarda, razón, memoria, destino, celda del guardia, resultado de la visión y la ruta calculada.

## Límites

- No hay prueba automatizada de navegador dentro de `npm run validate`. La corrida en Chromium se hizo con un guion externo y no forma parte del repositorio.
- Los cuadros del navegador no tienen duración fija, así que la telemetría del navegador no se repite exacta. Las trazas reproducibles son las de las pruebas.
- La advertencia de tamaño del paquete de Phaser sigue igual que en H3.
