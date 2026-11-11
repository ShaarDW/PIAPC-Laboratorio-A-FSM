---
id: laboratorio-guardia-sigilo-permisos
titulo: Permisos recomendados para agentes
tipo: referencia
audiencia: estudiante
acceso: publico
version: 1
---

# Permisos recomendados para agentes

La autonomía aumenta sólo cuando la tarea, el entorno y la validación están delimitados.

| Acción | Decisión inicial | Alcance o condición |
|---|---|---|
| Leer y buscar | Permitir | Todo el repositorio, excepto archivos ignorados |
| Editar código y documentación | Permitir | Archivos relacionados con una especificación aprobada |
| Ejecutar tipos, pruebas y compilación | Permitir | Scripts declarados en `package.json` |
| Iniciar servidor local | Permitir | Sin exponerlo a la red pública |
| Instalar o actualizar dependencias | Preguntar | Requiere justificación y revisión del archivo de bloqueo |
| Acceder a internet | Preguntar | Sólo documentación o dependencias identificadas |
| Eliminar o mover archivos | Preguntar | Debe demostrar referencias y efecto sobre el producto |
| Leer secretos o datos personales | Denegar | El laboratorio no los necesita |
| Cambiar configuración de Git | Denegar | No es parte de una tarea de producto |
| Crear commit o publicar | Preguntar | Requiere validación y autorización humana explícita |
| Desplegar | Denegar | Fuera del alcance del laboratorio base |

## Condiciones para detenerse

- La especificación admite interpretaciones con efectos distintos.
- Aparecen cambios concurrentes que interfieren con la tarea.
- Una validación falla por una causa no comprendida.
- La acción requiere credenciales, publicación o pérdida de información.
- El cambio cruza un límite arquitectónico sin decisión documentada.

## Recuperación

Trabajar sobre una rama o copia aislada, conservar cambios pequeños y revisar diferencias antes de integrar. No ocultar fallos, omitir pruebas ni revertir trabajo ajeno.

## Instalación aprobada

`npm ci` ejecuta scripts de instalación fijados por el archivo de bloqueo, incluido el binario de esbuild. Debe utilizarse sólo después de revisar cambios en `package.json` y `package-lock.json`. `--ignore-scripts` no sirve para la ejecución normal de Vite porque impediría preparar esbuild.
