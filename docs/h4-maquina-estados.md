---
id: laboratorio-guardia-sigilo-h4-maquina-estados
titulo: Máquina de estados del guardia
tipo: laboratorio
nivel: obligatorio
audiencia: estudiante
clases: [10]
modalidad: mixta
resultados: [RA7, RA8, RA9, RA11]
prerrequisitos: [laboratorio-guardia-sigilo-h3-percepcion-movimiento]
evaluable: true
acceso: publico
version: 1
---

# Máquina de estados del guardia

## Objetivo

El guardia decide solo entre Patrullar, Investigar, Perseguir, Buscar y Regresar, a partir de lo que percibe. La decisión vive en un núcleo puro (`src/domain/behavior/guardStateMachine.ts`) que no calcula rutas ni mueve al guardia. La aplicación (`src/application/simulation/guardController.ts`) traduce percepción en eventos, pide rutas a A* y mueve al guardia con el seguidor de caminos. Phaser sólo dibuja y lee el teclado.

```text
percepción (H3) ──eventos──▶ FSM (dominio) ──orden navegar──▶ A* (dominio)
                                   ▲                              │
                                   └──llegada o fallo de ruta◀── seguidor de caminos
```

## Criterios observables

1. Con el jugador fuera de alcance, el guardia recorre en ciclo los cuatro puntos de patrulla.
2. Un sonido oído lo lleva a Investigar el lugar del sonido. Al llegar, Busca alrededor durante 4 s y después Regresa al punto de patrulla más cercano.
3. Una visión válida, desde cualquier estado activo, lo lleva a Perseguir. Si deja de ver al jugador, Investiga la última posición conocida.
4. Ante sonido y visión en el mismo instante gana la visión.
5. Un destino inaccesible produce un evento explícito de fallo y una recuperación definida, nunca un guardia quieto sin explicación.
6. Cada transición queda registrada con tiempo, estado anterior y nuevo, evento, guarda, razón perceptual, memoria y destino.

## Fuera de alcance

- Captura del jugador y zona de salida. La FSM no tiene estado Capturado; queda para H6.
- Comparación con árboles de comportamiento, utilidad y GOAP (H5).
- Movimiento en diagonal y costos variables.
- Pruebas automatizadas de navegador. La escena se verifica con compilación y una ejecución en navegador sin interacción del jugador.

## Parámetros

| Parámetro | Valor |
|---|---:|
| Puntos de patrulla | (27,17), (27,4), (21,5), (21,13) |
| Duración de la búsqueda | 4000 ms |
| Radio de la búsqueda | 2 celdas alrededor de la última posición conocida |
| Intervalo de replanificación en persecución | 500 ms |
| Cambio relevante del objetivo | 3 celdas Manhattan o más |
| Espera antes de reintentar sin ruta a patrulla | 1500 ms |

## Eventos

| Evento | Lo genera | Datos |
|---|---|---|
| `player-seen` | Visión válida en el cuadro actual | celda del jugador |
| `player-lost` | Visión válida en el cuadro anterior y no en el actual | |
| `sound-heard` | Primer cuadro en que se oye un sonido nuevo | celda del sonido |
| `route-failed` | A* devolvió un estado distinto de `success` en el cuadro anterior | destino y estado |
| `arrived` | El seguidor de caminos completó la ruta del destino actual | celda de llegada |
| `tick` | Cada cuadro | tiempo |
| `reset` | Reinicio pedido por la persona | |

Todos llevan el tiempo de simulación y la celda actual del guardia. El tiempo se inyecta, así que las pruebas no dependen de cuadros reales.

## Tabla de transiciones

Una transición interna no cambia de estado ni reinicia su tiempo de entrada, pero puede cambiar el destino. «Activo» significa Patrullar, Investigar, Buscar o Regresar.

| Origen | Evento | Guarda | Destino | Acciones |
|---|---|---|---|---|
| Activo | `player-seen` | Celda transitable | Perseguir | Memoria ← celda vista. Navegar a esa celda |
| Perseguir | `player-seen` | Cambio de 3 celdas o más, o pasaron 500 ms desde la última ruta | Perseguir (interna) | Memoria ← celda vista. Replanificar |
| Perseguir | `player-seen` | Cambio menor y dentro del intervalo | Sin cambio | Memoria ← celda vista |
| Perseguir | `player-lost` | Hay última posición conocida | Investigar | Navegar a la última posición conocida |
| Perseguir | `player-lost` | Sin memoria | Regresar | Navegar al punto de patrulla más cercano |
| Perseguir | `sound-heard` | Falsa, la visión tiene prioridad | Sin cambio | Registrar evento ignorado |
| Perseguir | `route-failed` | | Perseguir (interna) | Detenerse. Reintentar con la próxima visión pasado el intervalo |
| Patrullar, Buscar, Regresar | `sound-heard` | Celda transitable | Investigar | Memoria ← celda del sonido. Navegar a ella |
| Investigar | `sound-heard` | Celda distinta del destino actual | Investigar (interna) | Memoria ← celda del sonido. Navegar a ella |
| Investigar | `sound-heard` | Misma celda que el destino | Sin cambio | Registrar evento repetido |
| Investigar | `arrived` | Llegada al destino actual | Buscar | Calcular puntos de búsqueda. Vence en 4000 ms. Navegar al primero |
| Investigar | `route-failed` | | Regresar | Razón «destino inaccesible». Navegar al punto de patrulla más cercano |
| Buscar | `arrived` | Llegada al destino actual | Buscar (interna) | Navegar al siguiente punto de búsqueda, en ciclo |
| Buscar | `route-failed` | | Buscar (interna) | Descartar ese punto. Si no quedan, detenerse hasta el vencimiento |
| Buscar | `tick` | Tiempo ≥ vencimiento | Regresar | Navegar al punto de patrulla más cercano |
| Regresar | `arrived` | Llegada al destino actual | Patrullar | Navegar al siguiente punto de patrulla |
| Patrullar | `arrived` | Llegada al destino actual | Patrullar (interna) | Navegar al siguiente punto de patrulla |
| Patrullar, Regresar | `route-failed` | Quedan puntos sin probar | Sin cambio de estado (interna) | Probar el siguiente punto de patrulla |
| Patrullar, Regresar | `route-failed` | Ya fallaron todos | Sin cambio de estado (interna) | Detenerse. Reintentar en 1500 ms |
| Patrullar, Regresar | `tick` | Tiempo ≥ reintento | Sin cambio de estado (interna) | Volver a pedir ruta |
| Cualquiera | `arrived` | Celda distinta del destino actual | Sin cambio | Registrar llegada obsoleta |
| Cualquiera | `reset` | | Patrullar | Borrar memoria, búsqueda y reintentos. Navegar al primer punto de patrulla |

## Políticas

**Eventos simultáneos.** En cada cuadro la aplicación arma la lista en este orden de prioridad: `reset`, `player-seen`, `player-lost`, `sound-heard`, `route-failed`, `arrived`, `tick`. Se procesan en ese orden y, después de la primera transición externa, el resto del cuadro se descarta y queda registrado como descartado. Así, sonido y visión juntos llevan a Perseguir, y una llegada de una ruta vieja no se aplica al estado nuevo.

**Reentrada.** Volver a recibir el evento que define el estado actual es una transición interna. No reinicia el tiempo de entrada ni la búsqueda. Un evento idéntico repetido (mismo sonido, misma celda) no produce ningún cambio.

**Temporizadores.** Sólo existen dos, el vencimiento de la búsqueda y el reintento sin ruta. Se guardan como instantes absolutos y se comparan contra el tiempo del evento, nunca contra el reloj del sistema.

**Rutas activas.** La FSM sólo emite órdenes «navegar a celda» o «detenerse». Cada orden reemplaza la ruta anterior. La aplicación calcula la ruta con A* una vez por orden, no en cada cuadro, y comunica el fallo como `route-failed` en el cuadro siguiente para evitar bucles dentro de un mismo cuadro. Una llegada sólo cuenta si coincide con el destino vigente.

**Reinicio.** `reset` es posible desde cualquier estado, incluso Perseguir. Vuelve a Patrullar con memoria vacía, sin búsqueda pendiente ni reintentos, y con el primer punto de patrulla como destino.

## Invariantes

Se comprueban con `checkGuardInvariants` después de cada evento en las pruebas.

1. El estado es uno de los cinco definidos, y el estado anterior sólo es nulo antes de la primera transición.
2. Si hay destino, es una celda transitable.
3. En Investigar, Perseguir y Buscar existe una última posición conocida.
4. En Perseguir, la última posición conocida proviene de la visión.
5. El vencimiento de búsqueda existe si y sólo si el estado es Buscar.
6. En Patrullar y Regresar, el destino es un punto de patrulla o no hay destino porque se espera un reintento.
7. La última posición conocida sólo cambia con `player-seen` o `sound-heard`.

## Telemetría

Cada registro tiene `timeMs`, `from`, `to`, `event`, `kind` (`external`, `internal`, `ignored`, `discarded`), `guard`, `reason`, `lastKnown`, `memorySource`, `destination` y `command`. La aplicación agrega la ruta calculada (estado, costo, nodos expandidos). La escena muestra el último registro en pantalla, lo escribe en la consola y lo deja en `window.__guardTelemetry` para inspeccionarlo.

## Controles de la escena en H4

- WASD o flechas para mover al jugador.
- Q para emitir un sonido.
- Espacio para alternar el algoritmo de las rutas del guardia entre A* y BFS.
- P para pausar y N para avanzar 100 ms mientras está pausado.
- R para reiniciar.

El clic para elegir destinos de H3 se quitó, porque ahora el destino lo decide la FSM.

## Archivos

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Dominio | `src/domain/behavior/guardStateMachine.ts` | Estados, eventos, guardas, prioridades, invariantes y registros. No calcula rutas ni mueve |
| Aplicación | `src/application/simulation/guardController.ts` | Percepción → eventos, órdenes → A*, ruta → seguidor de caminos |
| Aplicación | `src/application/simulation/guardSetup.ts` | Parámetros compartidos por la escena y las pruebas |
| Juego | `src/game/scenes/GameScene.ts` | Teclado, reloj de simulación, pausa, dibujo y telemetría visible |
| Pruebas | `tests/behavior/guardStateMachine.test.ts` | Secuencias y límites con eventos inyectados |
| Pruebas | `tests/behavior/guardScenarios.test.ts` | Escenarios completos sobre el mapa y generación de trazas |
| Pruebas | `tests/navigation/astarVerification.test.ts` | Verificación de A* y comparación con BFS como oráculo |

## Revisión de diseño

**Por qué una FSM.** Para un juego de sigilo, la persona tiene que poder leer qué piensa el guardia y anticipar su reacción. Cinco estados con nombres claros, un color por estado y una transición registrada por cada cambio hacen que el comportamiento se entienda jugando. Las reglas son pocas y tienen prioridades fijas (la visión gana al sonido), y eso se expresa directamente en la tabla. Un árbol de comportamiento o un sistema de utilidad agregarían flexibilidad que este guardia no necesita, y serían más difíciles de mostrar en pantalla.

**Qué evidencia justificaría migrar.** Si aparecieran varios guardias que se coordinan, o conductas que se combinan (por ejemplo, investigar mientras se pide refuerzo), la tabla crecería por la combinación de estados. Si al agregar un estado nuevo hubiera que tocar las transiciones de casi todos los demás, convendría pasar a una HFSM con un superestado Alerta, o a un árbol de comportamiento. La señal concreta sería que la tabla supere unas 40 filas o que se repitan las mismas guardas en varios estados.

**Límite no resuelto.** Al terminar la búsqueda, Regresar elige el punto de patrulla más cercano por distancia Manhattan, no por longitud real de la ruta. En la traza normal, desde (25,13) eligió (21,13), que está a 4 celdas en línea recta pero detrás de una pared, y la ruta costó 34 pasos (9,5 s). Resolverlo dentro de la FSM la obligaría a calcular rutas, y eso mezclaría decisión con búsqueda. La solución que respeta las capas sería que la aplicación consulte el costo de A* a cada punto y le pase a la FSM el mejor como dato del evento.

**Comportamiento observado en el navegador.** Cuando el jugador queda justo en el borde del cono, la persecución puede cortarse por un cuadro (Perseguir → Investigar → Perseguir). No rompe ningún invariante, porque Investigar va a la última posición vista, pero se ve como una duda del guardia. Un margen de pérdida (por ejemplo, considerar perdido al jugador recién después de 300 ms sin verlo) lo suavizaría; queda como mejora.

**Memoria tras volver a patrullar.** La última posición conocida se conserva al regresar a Patrullar y sólo se borra con el reinicio. Así la telemetría sigue mostrando qué fue lo último que percibió el guardia.
