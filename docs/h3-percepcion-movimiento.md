---
id: laboratorio-guardia-sigilo-h3-percepcion-movimiento
titulo: Percepción y movimiento del guardia
tipo: laboratorio
nivel: obligatorio
audiencia: estudiante
clases: [9, 10]
modalidad: mixta
resultados: [RA7, RA8, RA11]
prerrequisitos: [laboratorio-guardia-sigilo-producto]
evaluable: true
acceso: publico
version: 1
---

# Percepción y movimiento del guardia

## Propósito

H3 incorpora sensores, memoria y locomoción sin agregar todavía una arquitectura de decisión. Esta separación permite observar qué sabe el guardia antes de decidir qué debe hacer.

## Parámetros de la demostración

| Parámetro | Valor |
|---|---:|
| Velocidad del guardia | 115 px/s |
| Alcance visual | 220 px |
| Campo visual | 90 grados |
| Radio sonoro | 190 px |
| Duración del sonido | 800 ms |

## Controles

- WASD o flechas: mover al jugador.
- Clic en una celda: calcular una ruta y mover al guardia.
- Espacio: alternar BFS y A*.
- Q: emitir un sonido desde la posición del jugador.
- R: recuperar el estado inicial reproducible.

## Evidencia observable

- El cono azul representa alcance y ángulo visual; cambia a verde durante una detección válida.
- Una pared entre guardia y jugador produce el estado `OCLUIDO`.
- El círculo amarillo representa el alcance del último sonido activo.
- El marcador rojo conserva la última posición conocida por visión o sonido.
- La telemetría informa causa visual, resultado sonoro, fuente de memoria y antigüedad.
- El guardia recorre centros de celdas sin ejecutar nuevamente la búsqueda en cada cuadro.

## Experimentos reproducibles

1. Seleccionar una celda abierta y comprobar que el guardia sigue la ruta mostrada.
2. Situar al jugador delante y cerca del guardia para obtener `VISIBLE`.
3. Interponer una pared sin cambiar rango ni orientación para obtener `OCLUIDO`.
4. Ubicar al jugador fuera del cono pero dentro del radio sonoro y presionar Q.
5. Esperar la expiración del sonido y comprobar que la memoria conserva posición, fuente y tiempo.
6. Presionar R y comprobar que ruta, algoritmo, sonido y memoria vuelven al estado inicial.

## Límite del hito

El guardia sólo sigue destinos indicados por una persona. Ver u oír al jugador actualiza memoria, pero no inicia persecución o investigación. Las transiciones autónomas se incorporan en H4.
