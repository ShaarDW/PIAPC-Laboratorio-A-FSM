---
id: laboratorio-evidencia-intervencion-h3
titulo: Registro de intervención H3
tipo: referencia
audiencia: estudiante
acceso: publico
version: 1
---

# Registro de intervención H3

- Fecha: 5 de agosto de 2026.
- Estado inicial: `main`, commit `cf90210`.
- Objetivo: incorporar percepción visual y sonora, memoria y seguimiento de caminos sin anticipar la máquina de estados.
- Herramienta: OpenCode.
- Modelo declarado: `openai/gpt-5.6-sol`.

## Decisiones

| Decisión | Motivo | Control humano |
|---|---|---|
| Mantener dominio sin Phaser | Permite pruebas Node y transferencia entre motores | Revisión de importaciones y tipos |
| Separar búsqueda de locomoción | Evita recalcular A* durante cada cuadro | Pruebas del seguidor de caminos |
| Aplicar oclusión conservadora en esquinas | Una pared tocada por la línea bloquea visión | Casos exactos y cercanos a esquina |
| Priorizar visión simultánea sobre sonido | La visión entrega posición directa del objetivo | Prueba de ambos órdenes de llegada |
| Coordinar sensores en aplicación | Phaser no debe decidir reglas ni memoria | Simulación probada sin navegador |

## Correcciones surgidas de revisión

- Tiempo de audición reemplazó tiempo de emisión en memoria.
- Replanificación vuelve primero al centro de la celda actual.
- La orientación utiliza el último tramo consumido y no el desplazamiento neto.
- El trazado visual recorre celdas exactas y distingue cruces cercanos a una esquina.
- Entradas no finitas son rechazadas antes de cálculos o bucles.
- Sonido, visión y memoria salieron de la escena hacia aplicación y dominio.

## Límites pendientes

- No existe todavía una prueba automatizada de navegador.
- La percepción actualiza memoria, pero no elige conducta hasta H4.
- La advertencia de tamaño del paquete Phaser se acepta para el laboratorio y se revisará en integración final.
