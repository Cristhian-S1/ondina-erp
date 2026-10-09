# Beads en Ondina

Versión verificada: bd 1.0.4, Dolt embebido, prefix `OND`.

Los issues viven en `.beads/embeddeddolt/`. Git versiona configuración y hooks, no la base, los metadatos por máquina ni los exports pasivos. La sincronización de issues usa `refs/dolt/data` en `git+ssh://git@github.com/Cristhian-S1/ondina-erp.git`, separada de las ramas de código.

## Entorno existente

```bash
bash scripts/bootstrap-beads.sh
bd prime
bd stats
bd ready
bd show OND-8ox
```

El script comprueba la base existente mediante `bd stats`; no la reinicializa. Instala los hooks y configura `core.hooksPath=.beads/hooks` relativo al repositorio. Si no existe base local, usa `bd bootstrap --yes` para recuperar el remoto. Para usar los comandos se necesita bd en PATH; no hace falta un servidor Dolt externo en modo embedded.

## Clon nuevo y sincronización

La primera publicación de la base sigue pendiente de autorización explícita: el repositorio es público y la base contiene descripciones, comentarios, identidad de autores y memorias históricas. Hasta publicarla, un clon nuevo no puede recuperar estos issues solo con Git. No interpretar “No remote configured — skipping” como sincronización exitosa.

Después de publicar la base y verificar `refs/dolt/data`, los colaboradores pueden ejecutar el script anterior y:

```bash
bd dolt pull
bd update <id> --claim
bd close <id> --reason="Resultado verificado"
bd dolt push
```

`git push` de código no sustituye `bd dolt push`. `export.auto: true` mantiene un JSONL local; `export.git-add: false` evita añadirlo al índice; `import.auto: false` evita revivir estados de exports de ramas antiguas. Para recuperar un JSONL elegido conscientemente existe `bd import <archivo>`; conserva primero una copia de la base.

No usar `bd init --force` como reparación. Los comandos `bd statistics`, `bd doctor` y `bd dolt test` no son adecuados para esta instalación: el primero no existe; los dos últimos no admiten el modo embebido. `bd config validate` exige `federation.remote`, y `bd config drift` intenta usar una CLI Dolt externa; estos resultados no prueban corrupción de la base local. Comprueba `bd stats`, `bd ready`, `bd orphans`, `bd dolt remote list` y `bd hooks list`.

## Evidencia de recuperación

El 2026-10-09 se exportaron 28 issues y se importaron en una base nueva aislada en `/tmp/ondina-beads-recuperacion`: se conservaron las cantidades por estado y las dependencias, sin issues huérfanos. Esa prueba no valida todavía la sincronización con GitHub ni las memorias/historial Dolt completos.

Copias recuperables de esta sesión: `/tmp/ondina-beads-antes-2026-10-09.tar.gz` y `/tmp/ondina-issues-recuperacion.jsonl`. `/tmp` es temporal; mueve los respaldos a un destino privado duradero si necesitas conservarlos.

[Documentación oficial de sincronización](https://github.com/gastownhall/beads/blob/main/docs/getting-started/sync-setup.md).
