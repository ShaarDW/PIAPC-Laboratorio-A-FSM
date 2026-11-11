---
id: laboratorio-guardia-sigilo-producto
titulo: Especificación del producto Guardia de Sigilo
tipo: laboratorio
nivel: obligatorio
audiencia: estudiante
clases: [4, 5, 7, 8, 9, 10, 12, 13]
modalidad: mixta
resultados: [RA3, RA4, RA5, RA6, RA7, RA8, RA9, RA10, RA11]
prerrequisitos: []
evaluable: true
acceso: publico
version: 1
---

# Especificación del producto

## Problema

Se necesita un entorno pequeño y observable para implementar, comparar y validar comportamientos de IA en videojuegos sin depender de arte externo ni sistemas de producción complejos.

## Objetivo

Crear una escena 2D cenital de sigilo donde una persona pueda provocar y comprender transiciones de comportamiento de un guardia.

## Alcance

### Escenario

- Mapa rectangular con cuadrícula lógica.
- Paredes y pasillos estáticos.
- Jugador y un guardia.
- Puntos de patrulla configurables.
- Zona de captura o salida.
- Representación mediante formas y colores generados por código.

### Jugador

- Movimiento con teclado.
- Colisión con paredes.
- Capacidad de generar un evento sonoro controlado.
- Reinicio inmediato del escenario.

### Guardia

- Cono de visión con distancia, ángulo y oclusión.
- Percepción sonora por radio.
- Última posición conocida y tiempo desde la última percepción.
- Navegación en cuadrícula con A*.
- Seguimiento de puntos de la ruta.
- Estados mínimos: Patrullar, Investigar, Perseguir, Buscar y Regresar.
- Captura al alcanzar una distancia configurable del jugador.

### Observabilidad

- Estado actual y anterior.
- Último evento que produjo una transición.
- Ruta actual y nodos explorados cuando corresponda.
- Cono de visión y radio sonoro.
- Última posición conocida.
- Registro estructurado de transiciones.
- Pausa y avance controlado para demostraciones.

## Fuera de alcance

- Arte, animaciones o audio de producción.
- Combate, inventario o narrativa ramificada.
- Multijugador.
- Generación procedural de niveles.
- Modelos generativos durante la ejecución.
- Servidor, base de datos o autenticación.
- Implementación obligatoria de behavior trees, Utility AI o GOAP.

## Requisitos funcionales

### RF-01 Movimiento

El jugador debe desplazarse sin atravesar obstáculos.

### RF-02 Patrulla

El guardia debe recorrer cíclicamente los puntos de patrulla mediante rutas válidas.

### RF-03 Visión

El guardia sólo debe ver al jugador si está dentro de distancia y ángulo y no existe una pared que bloquee la línea.

### RF-04 Sonido

Un sonido dentro del radio debe registrar su posición y activar Investigación si no existe una prioridad mayor.

### RF-05 Persecución

Al ver al jugador, el guardia debe actualizar la última posición conocida y perseguirlo.

### RF-06 Pérdida de percepción

Al perder al jugador, el guardia debe alcanzar la última posición conocida, buscar durante un tiempo limitado y regresar a patrulla.

### RF-07 Navegación

A* debe devolver estado, ruta, costo y métricas básicas. Un destino inaccesible debe producir un fracaso explícito.

### RF-08 Telemetría

Las decisiones relevantes deben poder observarse sin leer el código.

### RF-09 Reproducibilidad

El escenario, posiciones iniciales y tiempos deben poder reiniciarse al mismo estado.

## Requisitos no funcionales

- TypeScript en modo estricto.
- Núcleo de dominio independiente de Phaser y del DOM.
- Pruebas de dominio ejecutables en Node.
- Sin efectos laterales al importar módulos de dominio.
- Sin recursos externos necesarios para ejecutar el escenario base.
- Comandos únicos para desarrollo, pruebas, tipos, compilación y validación completa.
- Errores observables y sin fallos silenciosos.

## Invariantes

- Un guardia capturado o deshabilitado no continúa navegando.
- La última posición conocida cambia sólo ante una percepción válida.
- Una ruta nunca contiene celdas bloqueadas.
- El estado informado coincide con el comportamiento ejecutado.
- Regresar a patrulla conduce a un punto válido.
- El jugador y el guardia permanecen dentro del mapa.

## Casos límite

- Inicio igual a destino.
- Destino inaccesible.
- Jugador detrás de una pared dentro del cono.
- Sonido y visión en el mismo instante.
- Pérdida de visión durante una ruta.
- Cambio de objetivo con una ruta activa.
- Punto de patrulla bloqueado.
- Reinicio mientras el guardia persigue.

## Criterios de aceptación globales

1. `npm run validate` finaliza correctamente.
2. El escenario se ejecuta sin recursos descargados por separado.
3. Las transiciones pueden reproducirse mediante una secuencia documentada.
4. Navegación y máquina de estados tienen pruebas automatizadas.
5. La telemetría permite explicar por qué ocurrió cada transición.
6. La compilación de producción no contiene errores de tipos.
