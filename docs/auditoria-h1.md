---
id: laboratorio-guardia-sigilo-auditoria-h1
titulo: Auditoría del repositorio para H1
tipo: referencia
audiencia: estudiante
acceso: publico
version: 1
---

# Auditoría del repositorio para H1

## Identificación

- Fecha: 4 de agosto de 2026.
- Base inspeccionada: rama `main`, commit `7d4b78c`.
- Alcance: repositorio completo.
- Propósito: determinar si personas y agentes pueden explorar, modificar y validar el proyecto de forma controlada.

## Mapa mínimo

| Elemento | Ubicación | Función |
|---|---|---|
| Entrada web | `index.html`, `src/main.ts` | Montaje de Phaser y marco visual |
| Configuración | `src/game/config.ts` | Resolución, física y escenas |
| Escena | `src/game/scenes/GameScene.ts` | Entrada, física y presentación |
| Simulación | `src/application/simulation/` | Configuración y casos de uso del laboratorio |
| Dominio | `src/domain/` | Reglas puras, cuadrícula y navegación |
| Pruebas | `tests/` | Evidencia automatizada en Node |
| Contratos | `specs/`, `docs/`, `AGENTS.md` | Alcance, arquitectura y reglas de intervención |

## Flujo de ejecución

`index.html` carga `src/main.ts`; éste crea Phaser con `gameConfig`. `GameScene` representa el nivel y delega el cálculo de rutas a aplicación. Aplicación selecciona BFS o A*, implementados como dominio TypeScript sin navegador.

## Comandos

| Propósito | Comando | Resultado esperado |
|---|---|---|
| Desarrollo | `npm run dev` | Servidor local interactivo |
| Tipos | `npm run typecheck` | Código propio sin errores |
| Pruebas | `npm run test:run` | Pruebas de dominio aprobadas |
| Compilación | `npm run build` | Producto en `dist/` |
| Validación | `npm run validate` | Tipos, pruebas y compilación en secuencia |

## Hallazgos

- El archivo de bloqueo fija las dependencias y `.gitignore` excluye resultados generados.
- `AGENTS.md` define límites arquitectónicos, validación y acciones sensibles.
- La lógica de dominio no importa Phaser ni DOM.
- El laboratorio no requiere credenciales, servicios remotos ni recursos externos.
- La compilación incluye Phaser en un paquete grande; es aceptable para el laboratorio, pero debe observarse antes de un despliegue productivo.
- No existe todavía una prueba automatizada en navegador; la ejecución visual continúa siendo una verificación manual.
- `skipLibCheck` evita una incompatibilidad conocida de declaraciones de Phaser 3, sin desactivar el modo estricto del código propio.

## Resultado

H1 queda satisfecho al incorporar permisos recomendados y plantillas de evidencia junto con esta auditoría. Al cerrar H2, `npm run validate` aprobó la comprobación de tipos, 13 pruebas en dos archivos y la compilación de producción.

Toda ampliación debe preservar los límites registrados y finalizar con `npm run validate`.
