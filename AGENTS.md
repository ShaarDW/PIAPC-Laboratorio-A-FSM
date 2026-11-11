# Instrucciones para agentes

## Antes de cambiar codigo

1. Lea `specs/01-producto.md` y `docs/arquitectura.md`.
2. Consulte `docs/permisos-recomendados.md` antes de ejecutar herramientas.
3. Inspeccione los archivos relacionados antes de proponer cambios.
4. Declare cualquier ambiguedad que afecte los criterios de aceptacion.

## Limites arquitectonicos

- `src/domain/` no puede importar Phaser, DOM ni APIs del navegador.
- `src/application/` coordina el dominio y no representa la escena.
- `src/game/` adapta Phaser y no decide reglas de comportamiento.
- Evite recursos externos: la escena base se dibuja por codigo.
- No agregue dependencias sin justificar la necesidad.

## Validacion

Ejecute `npm run validate` antes de declarar una tarea terminada. Una respuesta del modelo no constituye evidencia de funcionamiento.

## Seguridad

- No lea ni escriba secretos.
- No publique, despliegue, haga commit ni elimine archivos sin autorizacion.
- Detengase ante cambios concurrentes que entren en conflicto con la tarea.
