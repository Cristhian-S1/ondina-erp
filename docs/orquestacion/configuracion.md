# Configurar Orca para Ondina

## Seleccionar el ejecutable
Leer primero la skill orca-cli y resolver el ejecutable una vez:
- Usar ORCA_CLI_COMMAND si el entorno lo proporciona.
- En una sesión de desarrollo Orca con ORCA_DEV_REPO_ROOT, usar orca-dev.
- En Linux fuera de un terminal administrado por Orca, usar orca-ide.
- En los demás entornos administrados, usar orca.

En Linux, el orca del sistema puede ser el lector de pantalla GNOME. No sustituir silenciosamente el ejecutable seleccionado por otro.
Los ejemplos siguientes usan **orca-ide**, que fue el ejecutable resuelto en esta revisión; ajustar los ejemplos al ejecutable elegido en otra sesión.

## Cargar la guía de la versión y comprobar el runtime
```bash
orca-ide skills get orca-cli --json
orca-ide skills get orchestration --json
orca-ide status --json
```
Si la aplicación está detenida y la ejecución está autorizada, iniciar con orca-ide open --json y volver a comprobar status. Si la conexión falla por runtime_access_denied, corregir el acceso del sandbox; no reiniciar la aplicación por ese error.
No crear Runs ni workers mientras el runtime sea inaccesible. Si el binario no admite un comando, consultar --help o la guía; no inventar flags.

## Terminal del coordinador
Iniciar Claude Code en un terminal administrado por Orca dentro del workspace coordinador. Así el runtime conoce al caller y su inbox. Si se coordina desde fuera, seguir la guía para los selectores de Run y terminal emitidos por Orca; no fabricar una identidad con el nombre del rol.

## Repositorio y perfiles
Descubrir repositorios mediante orca-ide repo list --json. Si Ondina no está registrada, usar repo add --path con la ruta real. No copiar IDs del ejemplo: conservar el id completo que devuelva el runtime.
Comprobar repo show y la referencia de trabajo. Para esta propuesta, los worktrees de implementación nacen de origin/develop; si se configura repo set-base-ref, registrar ese cambio y el repo exacto.
Copiar perfiles.example.json a perfiles.local.json en esta carpeta, elegir los modelos por rol y revisar el límite de concurrencia. El archivo local está ignorado por Git.
La elección del modelo y habilitación de una ejecución corresponde al usuario. No sustituir null por un modelo supuesto ni habilitar una flota por haber leído la sección.

## Preparar worktrees y setup
No compartir el checkout de develop entre workers que escriben. Asignar worktree y ramas propias a cada rol, manteniendo el repo/base correctos y la propiedad de archivos.
Consultar antes la referencia de placement si la operación necesita worktrees nuevos o servidores remotos:
```bash
orca-ide skills get orchestration --reference references/placement-and-remote.md --json
orca-ide skills get orchestration --reference references/coordinator-loop.md --json
```
En el caso OpenCode con override de modelo, crear primero el worktree y usar luego el selector existente al despachar. Una creación sin --agent puede dejar un shell inicial; inspeccionar terminal list y cerrar solo un shell confirmado como no utilizado.
Respetar la política de setup del repo; npm ci y los entornos de desarrollo se preparan en el worker correspondiente. No copiar claves privilegiadas a Git ni ejecutar migraciones contra producción durante el setup.

## Ejemplo del ciclo supervisado
Este bloque muestra la forma de los comandos. Sustituir los placeholders con valores comprobados antes de ejecutarlos; no se ejecuta al leer el documento.
```text
orca-ide orchestration run-create --objective "<objetivo autorizado>" --json
orca-ide orchestration worker-start --spec "<spec con ID Beads y aceptación>" --worktree "<selector existente>" --agent opencode --model "<modelo elegido y disponible>" --json
orca-ide orchestration check --wait --types "worker_done,escalation,question" --timeout-ms 45000 --json
```
Usar --run cuando la guía requiera referenciar el Run fuera de su terminal coordinador. Enviar la primera ola independiente antes de esperar; limitarla a los slots aprobados.

## Recepciones, preguntas y cierre
Leer cada receipt: la salida 0 de worker-start acredita readiness; failedStage, residualResources y outcome_unknown requieren seguir la referencia de recuperación, sin relanzar a ciegas.
Procesar las preguntas mediante reply y validar worker_done contra el Dispatch activo y su outcome. Después de un cierre aceptado, reutilizar, retener por petición del usuario o liberar el worker mediante worker-release.
Procesar la entrega completa antes de su ack. Un timeout no prueba muerte; inspeccionar worker-list y seguir su nextAction antes de decidir stop, abandon o retry.
La guía de orchestration manda sobre este resumen y contiene los comandos vigentes.
