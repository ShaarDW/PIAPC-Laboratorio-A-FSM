---
id: laboratorio-guardia-sigilo-decisiones-tecnicas
titulo: Decisiones técnicas del laboratorio Guardia de Sigilo
tipo: referencia
audiencia: estudiante
acceso: publico
version: 1
---

# Decisiones técnicas

## Stack

- Phaser 3.90.0 con TypeScript como referencia.
- Vite 6.4.3 como servidor y compilador web.
- Vitest 4.1.10 para pruebas en entorno Node.
- TypeScript 5.9.3 con `strict` habilitado.
- npm con archivo de bloqueo.

## Fundamento

Phaser dispone de plantillas TypeScript oficiales mediante `npm create @phaserjs/game@latest`. Vite permite un proyecto web pequeño y Vitest comparte su configuración y ejecuta pruebas sin navegador.

## Compatibilidad y selección

- El entorno de desarrollo disponible utiliza Node.js 22.6.0.
- Vite 8 requiere Node.js 20.19+ o 22.12+ y no resulta compatible con ese entorno.
- Vite 6.4.3 admite Node.js 22.0+.
- Vitest 4 admite Node.js 22 y Vite 6.
- Las versiones se fijan en `package.json` y `package-lock.json`.
- `skipLibCheck` se limita a declaraciones externas porque Phaser 3 referencia `ActiveXObject`, ausente en las bibliotecas DOM actuales; el código propio conserva comprobación estricta.

## Phaser 3

Se selecciona Phaser 3.90.0 por su madurez y estabilidad para la cursada. El contenido académico y el dominio no dependen de APIs exclusivas de esta versión.

## Fuentes consultadas

- Phaser, instalación y plantillas: https://docs.phaser.io/phaser/getting-started/installation
- Vite, guía de inicio: https://vite.dev/guide/
- Vitest, guía de inicio: https://vitest.dev/guide/
- TypeScript, TSConfig: https://www.typescriptlang.org/tsconfig/

Consulta: 4 de agosto de 2026.
