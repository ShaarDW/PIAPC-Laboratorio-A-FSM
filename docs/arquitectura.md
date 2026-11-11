---
id: laboratorio-guardia-sigilo-arquitectura
titulo: Arquitectura del laboratorio Guardia de Sigilo
tipo: referencia
audiencia: estudiante
acceso: publico
version: 3
---

# Arquitectura propuesta

## Principio

El dominio no depende de Phaser. Phaser traduce entradas y presenta resultados.

```text
Phaser / navegador
      ↓ adaptadores
aplicación y simulación
      ↓
dominio puro TypeScript
```

## Estructura objetivo

```text
guardia-sigilo/
├── AGENTS.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── public/
├── specs/
├── docs/
├── src/
│   ├── domain/
│   │   ├── navigation/
│   │   ├── perception/
│   │   ├── behavior/
│   │   ├── telemetry/
│   │   └── model/
│   ├── application/
│   │   └── simulation/
│   ├── game/
│   │   ├── scenes/
│   │   ├── adapters/
│   │   └── presentation/
│   └── main.ts
└── tests/
    ├── navigation/
    ├── perception/
    └── behavior/
```

## Reglas de dependencia

- `domain/` no importa Phaser, DOM ni APIs de navegador.
- `application/` coordina casos de uso y depende del dominio.
- `game/` depende de Phaser, aplicación y dominio.
- Presentación no decide comportamiento.
- Tiempo, aleatoriedad y entrada se inyectan o modelan explícitamente.
- Las pruebas de dominio no crean un juego Phaser.

## Contratos principales

### Navegación

La cuadrícula forma un grafo implícito de cuatro vecinos transitables. BFS utiliza una cola y sirve como referencia no informada. A* utiliza costo unitario y distancia Manhattan, admisible para este movimiento cardinal.

Entrada: mapa, inicio y objetivo.

Salida: algoritmo, estado, `path`, `totalCost`, `expandedNodes`, `maximumFrontier` y secuencia `explored`. Los estados de fracaso distinguen inicio inválido, objetivo inválido y objetivo inaccesible.

Un nodo se considera expandido al retirarlo de la frontera, incluido el objetivo. `maximumFrontier` registra la mayor cantidad de nodos pendientes en cualquier paso.

Implementación: `src/domain/navigation/`. La selección para la demostración ocurre en `src/application/simulation/navigationDemo.ts` y Phaser sólo representa el resultado.

### Percepción

Entrada visual: mapa, tamaño de celda, posición, dirección, objetivo, alcance y campo visual. La oclusión recorre todas las celdas atravesadas por la línea y adopta un criterio conservador al tocar esquinas.

Entrada sonora: posición del oyente y evento con origen, radio, instante y duración.

Salida: resultado y causa observable; no modifica directamente el estado de conducta. `src/domain/perception/memory.ts` conserva sólo observaciones finitas provistas por sensores validados y prioriza visión ante eventos simultáneos. `src/application/simulation/perceptionSimulation.ts` coordina sensores, vigencia del sonido y memoria; Phaser sólo adapta tiempo, entrada y representación.

### Movimiento

Entrada: posición, puntos de paso, índice siguiente y distancia máxima de avance.

Salida: nueva posición, índice siguiente, finalización y dirección del último tramo consumido. `src/domain/navigation/pathFollower.ts` puede consumir varios puntos en una actualización y no depende de Phaser ni del tiempo de cuadro.

### Comportamiento

Entrada: estado actual, observaciones, memoria de trabajo y tiempo.

Salida: transición y acción deseada.

### Telemetría

Eventos estructurados con tiempo, estado anterior, evento, estado nuevo y causa.

## Comandos objetivo

```text
npm run dev
npm run build
npm run typecheck
npm run test
npm run test:run
npm run validate
```

`validate` debe ejecutar tipos, pruebas y compilación sin requerir interacción.
