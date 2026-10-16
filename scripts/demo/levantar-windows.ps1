<#
levantar-windows.ps1
====================
Levanta Ondina en un Windows 11 con Supabase LOCAL y datos de prueba (demo/QA).
Equivalente Windows de scripts/demo/levantar.sh. Guía: scripts/demo/README.md.

Dos formas de usarlo (PowerShell 7 recomendado; también Windows PowerShell 5.1):
  a) Desde un clon del repo (recomendado): usa ESA carpeta y su rama actual
     (hace 'git pull' si no hay cambios locales):
       powershell -ExecutionPolicy Bypass -File .\scripts\demo\levantar-windows.ps1
  b) Suelto (copiado a cualquier carpeta): clona el repo en -Destino
     (por defecto %USERPROFILE%\ondina-demo) en la rama -Rama (por defecto develop):
       powershell -ExecutionPolicy Bypass -File .\levantar-windows.ps1

  -Rama otra-rama        # clonar/cambiar a otra rama (en modo a, cambia la rama del clon)
  -Destino 'C:\ruta'     # carpeta del clon en modo b
  -SinArrancar           # prepara todo sin levantar Vite
  -SoloReiniciarDatos    # reset de la BD local + resiembra
  -SinPausa              # sin pausa final (uso automático; sale con código 1 si falla)

Con clic derecho -> "Ejecutar con PowerShell" también funciona: ante cualquier error
la ventana muestra el problema en rojo y espera "Presiona Enter para cerrar...".

Registro (log): toda la salida queda en %USERPROFILE%\ondina-demo-ultimo.log
(o, si pasas -Destino, en la carpeta que contenga a -Destino).

Seguridad: todo corre contra Supabase LOCAL (127.0.0.1/localhost); si la API
detectada no es local, el script aborta. Nunca toca datos de producción y nunca
escribe la clave service_role en ningún archivo (sólo pasa como variable de
entorno a scripts/demo/seed-demo.mjs y se elimina del entorno al terminar).
Se conserva el BOM UTF-8 que Windows PowerShell 5.1 necesita para leer acentos.
#>

param(
  [string]$Rama = 'develop',
  [string]$Destino = (Join-Path $HOME 'ondina-demo'),
  [switch]$SoloReiniciarDatos,
  [switch]$SinArrancar,
  [switch]$SinPausa
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$script:Utf8SinBom = New-Object System.Text.UTF8Encoding($false)
$script:Repositorio = 'https://github.com/Cristhian-S1/ondina-erp'
$script:Rama = $Rama
$script:NombreLog = 'ondina-demo-ultimo.log'

# Estado de la ejecución; lo usan el flujo principal y su cierre controlado.
$script:PasoSeccion = 'Inicio'
$script:PasoActual = 'Inicio'
$script:LogIniciado = $false
$script:SupabaseViaNpx = $false
$script:HuboError = $false


# ----------------------------------------------------------------
# Utilidades de mensajes y cierre controlado
# ----------------------------------------------------------------
function Paso {
  param([string]$Titulo)
  $script:PasoSeccion = $Titulo
  $script:PasoActual = $Titulo
  Write-Host ''
  Write-Host "== $Titulo ==" -ForegroundColor Cyan
}
function Ok { param([string]$Mensaje) Write-Host "  [OK] $Mensaje" -ForegroundColor Green }
function Aviso { param([string]$Mensaje) Write-Host "  [..] $Mensaje" -ForegroundColor Yellow }

# Reemplaza a los 'exit' del original: lanza un error terminante con mensaje
# claro; el try/catch del flujo principal lo muestra en rojo y la ventana NO se
# cierra sola. Entre corchetes añade la línea del script que llamó a Fallar.
function Fallar {
  param([string]$Mensaje)
  $donde = ''
  try {
    $pila = @(Get-PSCallStack)
    if ($pila.Count -ge 2) {
      $marco = $pila[1]
      if ($marco.ScriptLineNumber) {
        $fragmento = ''
        try { if ($marco.Position -and $marco.Position.Text) { $fragmento = ' -> ' + $marco.Position.Text.Trim() } } catch {}
        $donde = ' [línea ' + $marco.ScriptLineNumber + ' del script' + $fragmento + ']'
      }
    }
  } catch {}
  throw ('FALLO DEL SCRIPT: ' + $Mensaje + $donde)
}

# Ejecuta un comando nativo dentro de un bloque { }, comprueba $LASTEXITCODE y,
# si falló, lanza un error descriptivo con la salida ya a la vista. Con
# $ErrorActionPreference='Continue' los fallos de git/npm/npx/supabase/docker/
# node son mudos: aquí no.
function Invocar-Paso {
  param(
    [string]$Descripcion,
    [scriptblock]$Comando,
    [switch]$Capturar,   # devuelve la salida en vez de imprimirla
    [switch]$OcultarSecretos,   # imprime la salida sin líneas con claves (no llegan al log)
    [string]$Sugerencia = ''
  )
  $script:PasoActual = $Descripcion
  Write-Host "  > $Descripcion ..." -ForegroundColor Gray
  $global:LASTEXITCODE = 0
  $cronometro = [System.Diagnostics.Stopwatch]::StartNew()
  $salida = $null
  if ($Capturar) {
    $salida = @(& $Comando 2>&1)
  } elseif ($OcultarSecretos) {
    # SEGURIDAD: 'supabase start' imprime anon/service_role/JWT; Start-Transcript
    # guardaría esas líneas en disco, así que se filtran antes de mostrarlas.
    foreach ($linea in @(& $Comando 2>&1)) {
      $texto = [string]$linea
      if ($texto -match '(?i)(key|secret|jwt|service_role|token|password|sb_secret_|sb_publishable_|eyJ[A-Za-z0-9_-]{10,})') {
        Write-Host '    (línea con credenciales locales omitida)' -ForegroundColor DarkGray
      } else {
        Write-Host "    $texto"
      }
    }
  } else {
    & $Comando
  }
  if ($LASTEXITCODE -ne 0) {
    $mensaje = "El comando del paso '$Descripcion' terminó con el código de salida $LASTEXITCODE."
    if ($Sugerencia) { $mensaje = $mensaje + ' ' + $Sugerencia }
    Fallar $mensaje
  }
  if (-not $Capturar) {
    Ok ("$Descripcion (listo en " + [Math]::Round($cronometro.Elapsed.TotalSeconds, 1) + " s)")
  }
  return $salida
}

# Envuelve la CLI de Supabase ('supabase' si está en PATH; si no, 'npx --yes supabase').
function Invocar-Supabase {
  param(
    [string]$Descripcion,
    [scriptblock]$ComandoDirecto,
    [scriptblock]$ComandoNpx,
    [switch]$Capturar,
    [switch]$OcultarSecretos,
    [string]$Sugerencia = ''
  )
  if ($script:SupabaseViaNpx) {
    Invocar-Paso $Descripcion -Capturar:$Capturar -OcultarSecretos:$OcultarSecretos -Comando $ComandoNpx -Sugerencia $Sugerencia
  } else {
    Invocar-Paso $Descripcion -Capturar:$Capturar -OcultarSecretos:$OcultarSecretos -Comando $ComandoDirecto -Sugerencia $Sugerencia
  }
}

function Convertir-RutaCompleta {
  param([string]$Ruta)
  try {
    if ([System.IO.Path]::IsPathRooted($Ruta)) {
      return [System.IO.Path]::GetFullPath($Ruta)
    }
    return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $Ruta))
  } catch {
    return $Ruta
  }
}

function Test-PuertoAbierto {
  param([int]$Puerto)
  $cliente = New-Object System.Net.Sockets.TcpClient
  try {
    $cliente.Connect('127.0.0.1', $Puerto)
    return $true
  } catch {
    return $false
  } finally {
    try { $cliente.Close() } catch {}
  }
}

function Probar-Url200 {
  param([string]$Url)
  try {
    $respuesta = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
    return ($respuesta -and ($respuesta.StatusCode -eq 200))
  } catch {
    return $false
  }
}

# Espera a que /auth/v1/health responda 200 (tras un start o un db reset).
function Esperar-Auth {
  param([string]$ApiUrl, [int]$Segundos = 40)
  if ([string]::IsNullOrWhiteSpace($ApiUrl)) { return $false }
  $limite = (Get-Date).AddSeconds($Segundos)
  while ((Get-Date) -lt $limite) {
    if (Probar-Url200 -Url (($ApiUrl.TrimEnd('/')) + '/auth/v1/health')) { return $true }
    Start-Sleep -Seconds 2
  }
  return $false
}

# Tras un reset Auth puede quedar con 502 en Kong: reiniciar y reintentar.
function Asegurar-AuthSalud {
  param([string]$ApiUrl)
  if (Esperar-Auth -ApiUrl $ApiUrl -Segundos 40) { Ok 'Auth local responde (/auth/v1/health)'; return }
  Aviso 'Auth sigue sin responder (posible 502 de Kong tras un reset); reiniciando el gateway de Supabase...'
  Invocar-Paso 'docker restart supabase_kong_ondina-erp' -Comando { & docker restart supabase_kong_ondina-erp } -Sugerencia "Si el contenedor no se llama así, ejecuta 'docker ps' para ver el nombre exacto del gateway (Kong) de Supabase y reinícialo a mano."
  if (Esperar-Auth -ApiUrl $ApiUrl -Segundos 60) { Ok 'Auth local responde tras reiniciar Kong'; return }
  Fallar "Auth local no responde (HTTP 502 probable). Cierra y abre Docker Desktop, ejecuta manualmente 'docker restart supabase_kong_ondina-erp' y reejecuta este script."
}

function Mostrar-Prerequisitos {
  Write-Host ''
  Write-Host '==========================================================' -ForegroundColor Cyan
  Write-Host " $script:NombreScript" -ForegroundColor Cyan
  if ($script:UsarRepoDelScript -and -not $script:RamaExplicita) {
    Write-Host " Repo: carpeta de este script (rama actual del clon)" -ForegroundColor Cyan
  } else {
    Write-Host " Repo: https://github.com/Cristhian-S1/ondina-erp (rama $script:Rama)" -ForegroundColor Cyan
  }
  Write-Host ' Todo corre contra Supabase LOCAL; aborta si la API no es 127.0.0.1/localhost.' -ForegroundColor Cyan
  Write-Host '==========================================================' -ForegroundColor Cyan
  Write-Host ''
  Write-Host "Log de esta ejecución: $script:RutaLog" -ForegroundColor Yellow
  Write-Host 'La ventana no se cerrará sola: ante cualquier fallo verás el error en rojo y el' -ForegroundColor Yellow
  Write-Host 'script esperará "Presiona Enter para cerrar..." (evita la pausa con -SinPausa).' -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'PRERREQUISITOS (este script NO instala nada: si falta algo, instálalo y reejecuta):' -ForegroundColor Yellow
  Write-Host '  1) Git for Windows:        winget install --id Git.Git -e --source winget'
  Write-Host '  2) Node.js 22 (NO la LTS más reciente, que ya no es la 22): recomendado nvm-windows'
  Write-Host "     'winget install --id CoreyButler.NVMforWindows -e --source winget', reabre PowerShell, 'nvm install 22.12.0' y 'nvm use 22.12.0'"
  Write-Host '     El frontend exige Node >= 22.12 y < 23 (frontend/package.json -> engines "^22.12.0"; frontend/.nvmrc).'
  Write-Host '  3) Docker Desktop + WSL2:  en PowerShell como Administrador: wsl --install  (y reinicia el equipo),'
  Write-Host "     luego 'winget install --id Docker.DockerDesktop -e --source winget' y abre Docker Desktop hasta ver 'Engine running'."
  Write-Host '  4) Supabase CLI (vía oficial vigente, Scoop):'
  Write-Host '     Set-ExecutionPolicy RemoteSigned -Scope CurrentUser; irm get.scoop.sh | iex'
  Write-Host '     scoop bucket add supabase https://github.com/supabase/scoop-bucket.git'
  Write-Host '     scoop install supabase'
  Write-Host "  5) GitHub CLI (opcional, repo privado): 'winget install --id GitHub.cli -e --source winget' y luego 'gh auth login'."
  Write-Host ''
  Write-Host 'Si PowerShell bloquea el script: Set-ExecutionPolicy -Scope Process Bypass, o lánzalo con' -ForegroundColor Yellow
  Write-Host "'powershell -ExecutionPolicy Bypass -File $script:NombreScript' desde una consola ya abierta." -ForegroundColor Yellow
  Write-Host 'Espacio en disco: el primer supabase start descarga varios GB de imágenes Docker.' -ForegroundColor Yellow
  Write-Host 'Puertos: deben estar libres 54321-54324 (Supabase) y 5173 (Vite).' -ForegroundColor Yellow
  if ($script:UsarRepoDelScript) {
    Write-Host "Repo: se usa la carpeta donde está este script ($script:Direccion)." -ForegroundColor Yellow
  } else {
    Write-Host "Destino del clone: $script:Direccion (cambia con -Destino 'C:\ruta\carpeta')." -ForegroundColor Yellow
  }
}

function Verificar-EspacioDisco {
  param([string]$Ruta)
  $letras = New-Object System.Collections.Generic.List[string]
  $coincidenciaUnidad = [regex]::Match($Ruta, '^([A-Za-z]):')
  if ($coincidenciaUnidad.Success) { $letras.Add($coincidenciaUnidad.Groups[1].Value) }
  if ($env:SystemDrive) { $letras.Add($env:SystemDrive.TrimEnd(':')) }
  foreach ($letra in ($letras | Select-Object -Unique)) {
    $disco = Get-PSDrive -Name $letra -ErrorAction SilentlyContinue
    if ($disco) {
      $libresGb = [Math]::Round($disco.Free / 1GB, 1)
      if ($disco.Free -lt 10GB) {
        Aviso "Poco espacio en ${letra}: ($libresGb GB libres; el primer supabase start descarga varios GB de imágenes Docker)"
      } else {
        Ok "Espacio en ${letra}: ($libresGb GB libres)"
      }
    }
  }
}

function Verificar-RutaDestino {
  param([string]$Ruta)
  # ':' sólo vale como letra de unidad (posición 1, estilo 'C:\carpeta\repo')
  $posicionDosPuntos = $Ruta.IndexOf(':')
  if ($posicionDosPuntos -ge 0 -and $posicionDosPuntos -ne 1) {
    Fallar "La ruta '$Ruta' contiene ':' en una posición no válida (sólo vale como letra de unidad). Elige otra con -Destino 'C:\ruta\carpeta'."
  }
  if ($Ruta -match '[<>|?*"]') {
    Fallar "La ruta '$Ruta' contiene caracteres no válidos en Windows (<>|?* o comillas). Elige otra con -Destino 'C:\ruta\carpeta'."
  }
  $segmentos = @($Ruta -split '[\\/]' | Where-Object { $_ -ne '' })
  foreach ($segmento in $segmentos) {
    if ($segmento -ne $segmento.Trim()) {
      Fallar "La ruta '$Ruta' tiene espacios al inicio o al final de '$segmento'. Quita esos espacios (rompen rutas Windows)."
    }
    if ($segmento.EndsWith('.')) {
      Fallar "La ruta '$Ruta' termina en punto ('.') en '$segmento': Windows lo recorta y rompe la ruta. Usa otro nombre."
    }
  }
  if ($Ruta -match '[^\x20-\x7E]') {
    Aviso "La ruta '$Ruta' contiene caracteres fuera del ASCII (acentos, ñ, emoji...). Suele funcionar, pero si npm/Vite dan problemas raros prueba una ruta sin acentos (p. ej. C:\dev\ondina)."
  }
  if ($Ruta.Length -gt 200) {
    Aviso "La ruta '$Ruta' es muy larga ($($Ruta.Length) caracteres): node_modules añade muchos niveles; si fallan las rutas, acórtala."
  }
  Ok "Ruta de destino válida: $Ruta"
}

# ----------------------------------------------------------------
# Verificaciones de prerrequisitos (mensajes accionables en español;
# si algo falta, se aborta por el cierre controlado explicando qué hacer)
# ----------------------------------------------------------------
function Hacer-Verificaciones {
  Paso 'VERIFICACIONES DE PRERREQUISITOS'

  # --- Versión de PowerShell (5.1 / 7+) ---
  $versionPs = $PSVersionTable.PSVersion
  if ($versionPs.Major -lt 5) {
    Fallar "PowerShell $versionPs es demasiado antiguo: se necesita Windows PowerShell 5.1 o PowerShell 7+. Instala PowerShell 7 con 'winget install --id Microsoft.PowerShell -e --source winget' y vuelve a lanzar el script con 'pwsh -File $script:NombreScript'."
  }
  if ($versionPs.Major -eq 5) {
    Aviso "PowerShell 5.1 ($versionPs): funciona, pero PowerShell 7+ es más fiable ('winget install --id Microsoft.PowerShell -e --source winget')."
  } else {
    Ok "PowerShell $versionPs"
  }

  # --- ExecutionPolicy (por si en otra ventana aparece 'running scripts is disabled') ---
  $politica = $null
  try { $politica = Get-ExecutionPolicy } catch {}
  if (@('Restricted', 'AllSigned', 'Undefined') -contains $politica) {
    Aviso "La política de ejecución es '$politica': esta sesión pudo abrirla, pero en una ventana nueva puede fallar con 'running scripts is disabled'. Lánzalo con: powershell -ExecutionPolicy Bypass -File $script:NombreScript  (o dentro de PowerShell: Set-ExecutionPolicy -Scope Process Bypass)."
  } else {
    Ok "Política de ejecución: $politica"
  }

  # --- Ruta -Destino con caracteres problemáticos ---
  Verificar-RutaDestino -Ruta $script:Direccion

  # --- Git ---
  $gitCmd = Get-Command git -ErrorAction SilentlyContinue
  if (-not $gitCmd) { Fallar "Git no está instalado o no está en PATH. Instala Git for Windows con 'winget install --id Git.Git -e --source winget', cierra y reabre PowerShell y reejecuta." }
  $gitVersion = (@((Invocar-Paso 'git --version' -Capturar -Comando { & git --version } -Sugerencia "Git está en PATH pero falló; reinstala Git for Windows con 'winget install --id Git.Git -e --source winget'.")) -join ' ').Trim()
  Ok ('Git instalado: ' + $gitVersion)

  # --- Node.js (mínimo de frontend/.nvmrc si existe; si no, >= 22.12) ---
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCmd) { Fallar "Node.js no está instalado o no está en PATH. Instala Node 22 con nvm-windows ('winget install --id CoreyButler.NVMforWindows -e --source winget' y luego 'nvm install 22.12.0' + 'nvm use 22.12.0'), cierra y reabre PowerShell y reejecuta." }
  $nodeVersion = (@((Invocar-Paso 'node --version' -Capturar -Comando { & node --version } -Sugerencia "Node está en PATH pero falló; reinstala Node 22 con nvm-windows ('nvm install 22.12.0', 'nvm use 22.12.0').")) -join ' ').Trim()
  $rutaNvmrc = Join-Path (Join-Path $script:Direccion 'frontend') '.nvmrc'
  # Mínimo por defecto: engines del frontend ('^22.12.0')
  $minMayor = 22; $minMenor = 12; $minParche = 0
  if (Test-Path -LiteralPath $rutaNvmrc -PathType Leaf) {
    $contenidoNvmrc = ((Get-Content -LiteralPath $rutaNvmrc -ErrorAction SilentlyContinue) -join ' ').Trim()
    $limpiaNvmrc = $contenidoNvmrc.TrimStart('v')
    $partesNvmrc = @($limpiaNvmrc -split '\.')
    try {
      if ($partesNvmrc.Count -ge 1) { $minMayor = [int]$partesNvmrc[0] }
      if ($partesNvmrc.Count -ge 2) { $minMenor = [int]$partesNvmrc[1] }
      if ($partesNvmrc.Count -ge 3) { $minParche = [int]$partesNvmrc[2] }
    } catch {
      Aviso "No se pudo interpretar frontend/.nvmrc ('$contenidoNvmrc'); se usa el mínimo 22.12.0 del frontend."
      $minMayor = 22; $minMenor = 12; $minParche = 0
    }
    # '.nvmrc' a secas ('22') no da un mínimo útil: se usa 22.12.0.
    if ($minMayor -ne 22 -or ($minMenor -eq 0 -and $minParche -eq 0)) {
      Aviso "frontend/.nvmrc ('$contenidoNvmrc') no da un mínimo >= 22.12 y < 23; se usa el 22.12.0 del frontend (engines '^22.12.0')."
      $minMayor = 22; $minMenor = 12; $minParche = 0
    }
    Ok "frontend/.nvmrc pide Node >= $minMayor.$minMenor.$minParche"
  }
  $nodeCumple = $false
  if ($nodeVersion -match '^v(\d+)\.(\d+)(?:\.(\d+))?') {
    $nvMayor = [int]$Matches[1]
    $nvMenor = [int]$Matches[2]
    $nvParche = 0
    if ($Matches[3]) { $nvParche = [int]$Matches[3] }
    $nodeCumple = ($nvMayor -eq 22 -and ($nvMenor -gt $minMenor -or ($nvMenor -eq $minMenor -and $nvParche -ge $minParche)))
  }
  if (-not $nodeCumple) {
    Fallar "Node $nodeVersion no es válido: el frontend exige Node >= $minMayor.$minMenor.$minParche y < 23 (frontend/package.json -> engines '^22.12.0'; frontend/.nvmrc). Usa nvm-windows ('nvm install 22.12.0' y 'nvm use 22.12.0') o instala una 22.x de Node y reejecuta."
  }
  Ok "Node $nodeVersion (cumple >= $minMayor.$minMenor.$minParche y < 23)"

  # --- npm ---
  $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCmd) { Fallar "npm no está disponible. Instala Node 22 con nvm-windows ('winget install --id CoreyButler.NVMforWindows -e --source winget' y luego 'nvm install 22.12.0' + 'nvm use 22.12.0'), cierra y reabre PowerShell y reejecuta." }
  $npmVersion = (@((Invocar-Paso 'npm --version' -Capturar -Comando { & npm.cmd --version } -Sugerencia "npm está en PATH pero falló; reinstala Node 22 con nvm-windows (npm viene con Node).")) -join ' ').Trim()
  Ok "npm $npmVersion disponible"

  # --- Supabase CLI (instalada, o 'npx supabase' como alternativa) ---
  $sbCmd = Get-Command supabase -ErrorAction SilentlyContinue
  if ($sbCmd) {
    $sbVersion = (@((Invocar-Paso 'supabase --version' -Capturar -Comando { & supabase --version } -Sugerencia "La CLI está en PATH pero falló; reinstálala con Scoop ('scoop install supabase') o deja que el script use 'npx supabase'.")) -join ' ').Trim()
    Ok ('Supabase CLI instalada: ' + $sbVersion)
  } else {
    $npxCmd = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $npxCmd) { Fallar "Supabase CLI no está instalada. Vía oficial vigente (Scoop): 'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser', 'irm get.scoop.sh | iex', 'scoop bucket add supabase https://github.com/supabase/scoop-bucket.git' y 'scoop install supabase'. Cierra y reabre PowerShell y reejecuta." }
    Aviso "No está la CLI 'supabase' en PATH; se usará 'npx supabase' (la primera vez descarga el paquete, tardará un poco)."
    $script:SupabaseViaNpx = $true
    Invocar-Paso 'npx supabase --version' -Comando { & npx.cmd --yes supabase --version } -Sugerencia "Si npx no puede descargar el paquete 'supabase', instala la CLI con Scoop (instrucciones al inicio)."
  }

  # --- Docker Desktop: instalado Y en ejecución ---
  $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $dockerCmd) { Fallar "Docker no está instalado. Instala Docker Desktop con 'winget install --id Docker.DockerDesktop -e --source winget'; antes ejecuta 'wsl --install' en PowerShell de Administrador y reinicia el equipo; después ABRE Docker Desktop y espera a que muestre 'Engine running'." }
  $dockerVersion = (@((Invocar-Paso 'docker --version' -Capturar -Comando { & docker --version } -Sugerencia "El cliente está en PATH pero falló; reinstala Docker Desktop con 'winget install --id Docker.DockerDesktop -e --source winget'.")) -join ' ').Trim()
  # 'docker info' con el daemon apagado tarda unos segundos en imprimir un
  # aviso de conexión; se redirige a cmd para que no ensucie la consola.
  Invocar-Paso 'docker info (daemon de Docker)' -Comando { cmd /c "docker info >nul 2>&1" | Out-Null } -Sugerencia "Docker está instalado ($dockerVersion) pero el daemon no responde: abre Docker Desktop y espera a que muestre 'Engine running'; si no inicia, revisa WSL2 ('wsl --status'; 'wsl --install' en PowerShell de Administrador + reiniciar el equipo)."
  Ok "Docker daemon corriendo ($dockerVersion)"

  # --- GitHub CLI (opcional) ---
  $ghCmd = Get-Command gh -ErrorAction SilentlyContinue
  if ($ghCmd) { Ok 'GitHub CLI disponible (opcional)' }
  else { Aviso "GitHub CLI no instalada (opcional). Si el repo es privado conviene: 'winget install --id GitHub.cli -e --source winget' y luego 'gh auth login'." }

  # --- Puertos 54321/54322/5173: libres u ocupados por la misma instancia ---
  $supabaseActiva = $false
  if (Test-PuertoAbierto -Puerto 54321) {
    if (Probar-Url200 -Url 'http://127.0.0.1:54321/auth/v1/health') {
      $supabaseActiva = $true
      Ok 'Puerto 54321 ocupado por Supabase local (misma instancia): se reutilizará'
    } else {
      Aviso "Puerto 54321 ocupado por un proceso que NO responde como Supabase; si 'supabase start' falla, revisa con 'netstat -ano | findstr 54321' qué lo usa."
    }
  }
  if (Test-PuertoAbierto -Puerto 54322) {
    if ($supabaseActiva) {
      Ok 'Puerto 54322 ocupado por la misma instancia local de Supabase (Postgres)'
    } else {
      Aviso "Puerto 54322 ocupado por otro proceso (54321 no es Supabase local); 'supabase start' puede fallar; revisa con 'netstat -ano | findstr 54322' qué lo usa."
    }
  }
  foreach ($p in @(54323, 54324)) {
    if (Test-PuertoAbierto -Puerto $p) { Aviso "Puerto $p ocupado (normal si Supabase ya está corriendo; si no, revisa con 'netstat -ano | findstr $p' qué lo usa)" }
  }
  if (Test-PuertoAbierto -Puerto 5173) { Aviso 'Puerto 5173 ocupado (si ya corre un Vite está bien; Vite elegirá otro puerto)' }

  # --- Espacio en disco ---
  Verificar-EspacioDisco -Ruta $script:Direccion
}

# ----------------------------------------------------------------
# Leer API_URL / ANON_KEY / SERVICE_ROLE_KEY de 'supabase status -o env'
# ----------------------------------------------------------------
# SEGURIDAD: la salida de 'supabase status -o env' incluye SUPABASE_SERVICE_ROLE_KEY;
# se captura en modo silencioso y NUNCA se imprime ni se escribe a disco (la
# service_role sólo pasará en memoria, por variable de entorno, al seed).
function Leer-ClavesSupabase {
  param([string]$Carpeta)
  Push-Location $Carpeta
  try {
    $salida = @((Invocar-Supabase 'supabase status -o env' -Capturar -ComandoDirecto { & supabase status -o env 2>&1 } -ComandoNpx { & npx.cmd --yes supabase status -o env 2>&1 }))
  } catch {
    # Si falla el status se devuelve $null: Arrancar-Supabase decidirá si arrancar.
    return $null
  } finally {
    Pop-Location
  }
  $claves = @{}
  foreach ($linea in $salida) {
    if ($linea -match '^([A-Z0-9_]+)="(.*)"$') { $claves[$Matches[1]] = $Matches[2] }
  }
  if (-not $claves.ContainsKey('API_URL')) {
    # Formato JSON de la CLI (versiones nuevas)
    $lineasJson = @($salida | Where-Object { $_ -match '^\{' })
    if ($lineasJson.Count -gt 0) {
      try {
        $json = ($lineasJson -join "`n") | ConvertFrom-Json
        $claves['API_URL'] = [string]$json.API_URL
        $claves['ANON_KEY'] = [string]$json.ANON_KEY
        $claves['SERVICE_ROLE_KEY'] = [string]$json.SERVICE_ROLE_KEY
      } catch {}
    }
  }
  if ($claves.ContainsKey('API_URL') -and $claves.ContainsKey('ANON_KEY') -and $claves.ContainsKey('SERVICE_ROLE_KEY')) {
    Ok 'Claves de Supabase leídas (SERVICE_ROLE_KEY sólo en memoria: no se imprime ni se guarda)'
    return @{ ApiUrl = $claves['API_URL']; AnonKey = $claves['ANON_KEY']; ServiceKey = $claves['SERVICE_ROLE_KEY'] }
  }
  return $null
}

# SEGURIDAD: sólo Supabase local; aborta ante cualquier otra URL.
function Validar-ClavesLocales {
  param($Claves)
  if ($Claves.ApiUrl -notmatch '^https?://(127\.0\.0\.1|localhost|\[::1\])(:\d+)?/?$') {
    Fallar "SEGURIDAD: la API de Supabase no es local ($($Claves.ApiUrl)). Este script sólo funciona contra Supabase LOCAL (127.0.0.1/localhost); nunca contra producción. Abortando."
  }
}

# ----------------------------------------------------------------
# Clonar o actualizar el repositorio en la rama elegida (-Rama, por defecto develop)
# ----------------------------------------------------------------
function Info-Clonando {
  param([string]$CarpetaDestino)
  Write-Host "  Clonando $script:Repositorio (rama $script:Rama) en $CarpetaDestino ..." -ForegroundColor Yellow
  Invocar-Paso 'git clone' -Comando { & git clone --branch $script:Rama $script:Repositorio $CarpetaDestino } -Sugerencia "Si el repositorio es privado: (a) instala GitHub CLI con 'winget install --id GitHub.cli -e --source winget', ejecuta 'gh auth login' y reejecuta este script, o (b) configura credenciales de Git (Git Credential Manager pedirá tu usuario/token de acceso personal en GitHub)."
  $commit = (@((Invocar-Paso 'git log -1 --oneline' -Capturar -Comando { & git log -1 --oneline })) -join '')
  Ok "Repositorio clonado en $CarpetaDestino ($($commit.Trim()))"
}

function Actualizar-RepoDelScript {
  param([string]$RepoDir)
  if ($script:RamaExplicita) {
    # -Rama explícito: cambiar el clon a esa rama y actualizarla.
    Obtener-Repo -CarpetaDestino $RepoDir
    return
  }
  Push-Location $RepoDir
  try {
    $actual = (@((Invocar-Paso 'git branch --show-current' -Capturar -Comando { & git branch --show-current })) -join '').Trim()
    if ($actual) { $script:Rama = $actual }
    $cambios = (@((Invocar-Paso 'git status --porcelain' -Capturar -Comando { & git status --porcelain --untracked-files=no })) -join '').Trim()
    if ($cambios) {
      Aviso "Hay cambios locales sin commitear en $RepoDir; no se hace git pull (se usa la carpeta tal cual)."
    } elseif ($actual) {
      Invocar-Paso 'git pull --ff-only' -Comando { & git pull --ff-only } -Sugerencia "Revisa la conexión o tus credenciales; si la rama no sigue a una remota, usa -Rama develop."
    } else {
      Aviso 'La carpeta no está en ninguna rama (HEAD separado); se usa tal cual, sin git pull.'
    }
    $commit = (@((Invocar-Paso 'git log -1 --oneline' -Capturar -Comando { & git log -1 --oneline })) -join '').Trim()
    Ok "Repo del script listo en la rama $script:Rama ($commit)"
  } finally {
    Pop-Location
  }
}

function Obtener-Repo {
  param([string]$CarpetaDestino)
  if (Test-Path -LiteralPath (Join-Path $CarpetaDestino '.git')) {
    Ok "El repo ya existe en $CarpetaDestino; actualizando la rama $script:Rama ..."
    Push-Location $CarpetaDestino
    try {
      Invocar-Paso 'git fetch origin' -Comando { & git fetch origin } -Sugerencia "Revisa la conexión o tus credenciales (repo privado: 'gh auth login' o un token de Git)."
      $ramasLocales = @((Invocar-Paso 'git branch --list' -Capturar -Comando { & git branch --list $script:Rama }))
      if (-not (($ramasLocales -join '').Trim())) {
        Invocar-Paso "git switch -c $script:Rama (rama nueva)" -Comando { & git switch -c $script:Rama --track ("origin/" + $script:Rama) }
      } else {
        Invocar-Paso "git switch $script:Rama" -Comando { & git switch $script:Rama }
      }
      Invocar-Paso 'git pull --ff-only' -Comando { & git pull --ff-only origin $script:Rama } -Sugerencia "Si tienes cambios locales sin guardar, usa 'git stash' en $CarpetaDestino y reejecuta."
      $commit = (@((Invocar-Paso 'git log -1 --oneline' -Capturar -Comando { & git log -1 --oneline })) -join '')
      Ok "Rama $script:Rama actualizada ($($commit.Trim()))"
    } finally {
      Pop-Location
    }
  } else {
    if (Test-Path -LiteralPath $CarpetaDestino) { Fallar "La carpeta $CarpetaDestino existe pero no es un repositorio Git. Elige otra con -Destino 'C:\ruta\carpeta' o borra esa carpeta y reejecuta." }
    Info-Clonando $CarpetaDestino
  }
}

# ----------------------------------------------------------------
# Supabase local: start + claves
# ----------------------------------------------------------------
function Arrancar-Supabase {
  param([string]$RepoDir)
  $claves = Leer-ClavesSupabase -Carpeta $RepoDir
  if ($claves -and (Esperar-Auth -ApiUrl $claves.ApiUrl -Segundos 8)) {
    Ok "Supabase ya está corriendo en $($claves.ApiUrl)"
    return $claves
  }
  Write-Host "  Iniciando Supabase local ('supabase start'; la primera vez descarga varios GB de imágenes Docker y puede tardar 10-20 min)..." -ForegroundColor Yellow
  Push-Location $RepoDir
  try {
    Invocar-Supabase 'supabase start' -OcultarSecretos -ComandoDirecto { & supabase start } -ComandoNpx { & npx.cmd --yes supabase start } -Sugerencia "Causas comunes: Docker Desktop no está ABIERTO (ábrelo y espera 'Engine running'), los puertos 54321-54324 están ocupados, o falta espacio en disco."
  } finally {
    Pop-Location
  }
  $claves = Leer-ClavesSupabase -Carpeta $RepoDir
  if (-not $claves) { Fallar "No se pudo leer 'supabase status -o env' tras el arranque. Ejecuta manualmente 'supabase status' en $RepoDir y revisa." }
  return $claves
}

# ----------------------------------------------------------------
# Archivos: frontend\.env.local y ubicación de la siembra versionada
# ----------------------------------------------------------------
function Escribir-EnvLocal {
  param([string]$RepoDir, [string]$ApiUrl, [string]$AnonKey)
  $ruta = Join-Path $RepoDir 'frontend\.env.local'
  $texto = "# Generado por scripts/demo/levantar-windows.ps1 (Supabase LOCAL)" + "`r`n" + "VITE_SUPABASE_URL=$ApiUrl" + "`r`n" + "VITE_SUPABASE_ANON_KEY=$AnonKey" + "`r`n"
  [System.IO.File]::WriteAllText($ruta, $texto, $script:Utf8SinBom)
  Ok "Escrito $ruta (sólo VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY; NUNCA la service_role)"
}

function Ubicar-Seed {
  param([string]$RepoDir)
  $seedPath = Join-Path $RepoDir 'scripts\demo\seed-demo.mjs'
  if (-not (Test-Path -LiteralPath $seedPath)) {
    Fallar "No existe $seedPath. La rama '$script:Rama' no incluye el kit de demo (scripts/demo); usa -Rama develop o actualiza la carpeta con 'git pull'."
  }
  Ok "Siembra versionada: $seedPath"
  return $seedPath
}

# ----------------------------------------------------------------
# Ejecutar la siembra con las claves por variables de entorno
# ----------------------------------------------------------------
function Ejecutar-Seed {
  param([string]$RepoDir, [string]$SeedPath, [string]$ApiUrl, [string]$AnonKey, [string]$ServiceKey)
  $env:SUPABASE_URL = $ApiUrl
  $env:SUPABASE_ANON_KEY = $AnonKey
  $env:SUPABASE_SERVICE_ROLE_KEY = $ServiceKey
  try {
    Push-Location (Join-Path $RepoDir 'frontend')
    try {
      Invocar-Paso 'node scripts/demo/seed-demo.mjs (siembra de datos)' -Comando { & node $SeedPath } -Sugerencia "Si Auth no responde (HTTP 502), ejecuta 'docker restart supabase_kong_ondina-erp' y reejecuta este script."
    } finally {
      Pop-Location
    }
  } finally {
    # SEGURIDAD: las claves (service_role incluida) se sacan del entorno
    # aunque el seed falle; nunca quedan a disco ni en la sesión del usuario.
    Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:SUPABASE_ANON_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
  }
  Ok 'Siembra completada (o datos ya existentes, sin duplicar)'
}

function Instalar-Dependencias {
  param([string]$RepoDir)
  $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCmd) { Fallar "npm no está disponible. Instala Node 22 con nvm-windows ('nvm install 22.12.0' y 'nvm use 22.12.0'), cierra y reabre PowerShell y reejecuta." }
  Write-Host "  Instalando dependencias del frontend ('npm ci'; puede tardar varios minutos)..." -ForegroundColor Yellow
  Push-Location (Join-Path $RepoDir 'frontend')
  try {
    Invocar-Paso 'npm ci' -Comando { & npm.cmd ci } -Sugerencia "Revisa la versión de Node (>= 22.12 y < 23) y tu conexión; si persiste, borra $RepoDir\frontend\node_modules y reejecuta."
  } finally {
    Pop-Location
  }
  Ok 'Dependencias instaladas (npm ci)'
}

# ----------------------------------------------------------------
# Resumen final (cuentas, datos, reset, verificaciones, teléfono)
# ----------------------------------------------------------------
function Mostrar-Resumen {
  Write-Host ''
  Write-Host '== TODO LISTO ==' -ForegroundColor Green
  Write-Host ''
  Write-Host 'Cuentas de prueba (contraseña para todas: ux-local-2026, o la de $env:DEMO_PASSWORD si la definiste):' -ForegroundColor Yellow
  Write-Host '  ux-vendedor@example.invalid      Vendedor (Sucursal A): Registrar venta, Clientes, Carga, Gastos, Mi comisión, Ranking'
  Write-Host '  ux-bodega@example.invalid        Bodega (Sucursal A): Despachos, Devoluciones, Stock'
  Write-Host '  ux-produccion@example.invalid    Producción (Sucursal A): las 5 secciones de Producción'
  Write-Host '  ux-admin@example.invalid         Administrador (Sucursal A): todo lo anterior + Administración'
  Write-Host '  ux-admin-global@example.invalid  Administrador sin sucursal: selector de sucursal (Sintética A/B)'
  Write-Host ''
  Write-Host 'Datos sembrados (Sucursal Sintética A): 1 despacho de bodega al vendedor (carga de los 6 productos),'
  Write-Host '5 clientes, 3 ventas y 2 gastos; 4 registros de producción, 1 merma y 1 incidencia.'
  Write-Host ''
  Write-Host 'Reiniciar datos de cero:' -ForegroundColor Yellow
  Write-Host "  $script:NombreScript -SoloReiniciarDatos    (o manual: supabase db reset --local y node scripts/demo/seed-demo.mjs)"
  Write-Host ''
  Write-Host 'Verificaciones del frontend (dentro de la carpeta frontend):' -ForegroundColor Yellow
  Write-Host '  npm run lint ; npm run build ; npm run size ; npm run test ; npm run test:integration'
  Write-Host ''
  Write-Host 'Probar desde un teléfono en la misma red WiFi:' -ForegroundColor Yellow
  Write-Host '  1) Edita frontend\.env.local: cambia VITE_SUPABASE_URL de http://127.0.0.1:54321 a http://<TU_IP_LAN>:54321'
  Write-Host '  2) cd frontend ; npm run dev -- --host'
  Write-Host '  3) En el teléfono abre http://<TU_IP_LAN>:5173'
  try {
    $ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -ExpandProperty IPAddress)
    if ($ips.Count -gt 0) { Write-Host "  IP(s) candidatas en esta máquina: $($ips -join ', ')  (si difieren, usa 'ipconfig')" }
  } catch {}
  Write-Host '  4) Si el teléfono no abre la página, crea la regla de firewall (PowerShell de Administrador):'
  Write-Host "     New-NetFirewallRule -DisplayName 'Vite dev 5173' -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow"
  Write-Host ''
  Write-Host 'URLs locales: app http://localhost:5173 | Studio http://localhost:54323 | Mailpit http://localhost:54324' -ForegroundColor Yellow
  Write-Host 'Para actualizar la rama más adelante: reejecuta este script (hace fetch + pull) o "git pull" en la carpeta del repo.'
  Write-Host 'Seguridad: sólo Supabase LOCAL; el script aborta si la API no es 127.0.0.1/localhost. Nunca uses estos datos en producción.'
  Write-Host ''
}

# ----------------------------------------------------------------
# Registro (Start-Transcript) y pausa final
# ----------------------------------------------------------------
function Iniciar-Log {
  $motivoUltimo = ''
  $candidatas = @($script:RutaLog, (Join-Path $HOME $script:NombreLog)) | Select-Object -Unique
  foreach ($candidata in $candidatas) {
    try {
      Start-Transcript -Path $candidata -Force -ErrorAction Stop | Out-Null
      $script:RutaLog = $candidata
      $script:LogIniciado = $true
      Ok "Log iniciado: $script:RutaLog"
      return
    } catch {
      $motivoUltimo = $_.Exception.Message
    }
  }
  Aviso "No se pudo iniciar el registro en disco (Start-Transcript): $motivoUltimo. El script continúa sin log, pero igualmente muestra los errores en pantalla."
}

function Limpiar-ClavesDeEntorno {
  # SEGURIDAD: ninguna clave de Supabase queda en el entorno tras esta llamada.
  foreach ($nombre in @('SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY')) {
    try { Remove-Item ("Env:" + $nombre) -ErrorAction SilentlyContinue } catch {}
  }
}

function Pausa-Final {
  if ($SinPausa) { return }
  Write-Host ''
  try { [void](Read-Host 'Presiona Enter para cerrar...') } catch {}
}

# ----------------------------------------------------------------
# Ruta completa y camino del log ANTES del flujo principal
# ----------------------------------------------------------------
# Si el script vive dentro de un clon (scripts\demo\ de un repo con supabase\config.toml)
# y no se pasó -Destino, se usa ese clon en lugar de clonar otro.
$script:RamaExplicita = $PSBoundParameters.ContainsKey('Rama')
$script:NombreScript = '.\' + (Split-Path -Leaf $PSCommandPath)
$script:UsarRepoDelScript = $false
if (-not $PSBoundParameters.ContainsKey('Destino') -and $PSScriptRoot) {
  try {
    $repoDelScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..') -ErrorAction Stop).Path
    if ((Test-Path -LiteralPath (Join-Path $repoDelScript '.git')) -and (Test-Path -LiteralPath (Join-Path $repoDelScript 'supabase\config.toml'))) {
      $script:UsarRepoDelScript = $true
      $Destino = $repoDelScript
      $script:NombreScript = '.\scripts\demo\' + (Split-Path -Leaf $PSCommandPath)
    }
  } catch {}
}
$script:Direccion = Convertir-RutaCompleta -Ruta $Destino
$script:RutaLog = Join-Path $HOME $script:NombreLog
if ($PSBoundParameters.ContainsKey('Destino')) {
  try {
    $carpetaPadre = Split-Path -Parent $script:Direccion
    if ($carpetaPadre -and (Test-Path -LiteralPath $carpetaPadre -PathType Container)) {
      $script:RutaLog = Join-Path $carpetaPadre $script:NombreLog
    }
  } catch {}
}

# ----------------------------------------------------------------
# Flujo principal: NADA se cierra sin explicar. Todo fallo termina en el
# catch (mensaje en rojo + paso + línea + sugerencia) y el finally detiene
# el log y espera "Presiona Enter para cerrar..." (salvo con -SinPausa).
# ----------------------------------------------------------------
try {
  Iniciar-Log
  Mostrar-Prerequisitos
  Hacer-Verificaciones

  if ([string]::IsNullOrWhiteSpace($script:Direccion)) {
    Fallar "La ruta -Destino está vacía o no es válida. Pásala así: -Destino 'C:\ruta\carpeta'."
  }
  if ($script:Direccion -match '^[A-Za-z]:\\?$') {
    Fallar "-Destino apunta a la raíz de una unidad ('$script:Direccion'). Clona en una subcarpeta: -Destino 'C:\ruta\repo'."
  }

  if ($SoloReiniciarDatos) {
    if (-not (Test-Path -LiteralPath (Join-Path $script:Direccion 'supabase\config.toml'))) { Fallar "No hay un repo con 'supabase\config.toml' en $script:Direccion. Ejecuta primero el modo completo (sin -SoloReiniciarDatos)." }
    if (-not (Test-Path -LiteralPath (Join-Path $script:Direccion 'frontend\node_modules\@supabase'))) { Fallar "El frontend no tiene dependencias instaladas en $script:Direccion\frontend\node_modules. Ejecuta primero el modo completo." }
    Paso 'MODO -SoloReiniciarDatos: reset + siembra'
    $claves = Leer-ClavesSupabase -Carpeta $script:Direccion
    if (-not $claves) {
      Aviso 'Supabase local no está corriendo; arrancando...'
      $claves = Arrancar-Supabase -RepoDir $script:Direccion
    }
    Validar-ClavesLocales -Claves $claves
    Write-Host '  Reiniciando la base de datos local (supabase db reset --local; borra los datos locales)...' -ForegroundColor Yellow
    Push-Location $script:Direccion
    try {
      Invocar-Supabase 'supabase db reset --local' -ComandoDirecto { & supabase db reset --local --yes } -ComandoNpx { & npx.cmd --yes supabase db reset --local --yes } -Sugerencia "Asegúrate de que Docker Desktop esté abierto y de que no haya otro proyecto Supabase corriendo con los mismos puertos."
    } finally {
      Pop-Location
    }
    Asegurar-AuthSalud -ApiUrl $claves.ApiUrl
    $seedPath = Ubicar-Seed -RepoDir $script:Direccion
    Ejecutar-Seed -RepoDir $script:Direccion -SeedPath $seedPath -ApiUrl $claves.ApiUrl -AnonKey $claves.AnonKey -ServiceKey $claves.ServiceKey
    Mostrar-Resumen
  } else {
    Paso 'PASO 1/5: Clonar o actualizar el repositorio'
    if ($script:UsarRepoDelScript) { Actualizar-RepoDelScript -RepoDir $script:Direccion } else { Obtener-Repo -CarpetaDestino $script:Direccion }

    Paso 'PASO 2/5: Supabase local'
    $claves = Arrancar-Supabase -RepoDir $script:Direccion
    Validar-ClavesLocales -Claves $claves
    Asegurar-AuthSalud -ApiUrl $claves.ApiUrl

    Paso 'PASO 3/5: Variables de entorno del frontend (.env.local)'
    Escribir-EnvLocal -RepoDir $script:Direccion -ApiUrl $claves.ApiUrl -AnonKey $claves.AnonKey

    Paso 'PASO 4/5: Dependencias del frontend (npm ci)'
    Instalar-Dependencias -RepoDir $script:Direccion

    Paso 'PASO 5/5: Siembra de datos de prueba'
    $seedPath = Ubicar-Seed -RepoDir $script:Direccion
    Ejecutar-Seed -RepoDir $script:Direccion -SeedPath $seedPath -ApiUrl $claves.ApiUrl -AnonKey $claves.AnonKey -ServiceKey $claves.ServiceKey

    Mostrar-Resumen

    if (-not $SinArrancar) {
      Write-Host 'Arrancando Vite (npm run dev). Pulsa Ctrl+C para detenerlo.' -ForegroundColor Cyan
      Write-Host 'App: http://localhost:5173' -ForegroundColor Cyan
      Push-Location (Join-Path $script:Direccion 'frontend')
      try {
        Invocar-Paso 'npm run dev (Vite)' -Comando { & npm.cmd run dev } -Sugerencia "Si Vite se detiene solo, revisa el mensaje de arriba; para detenerlo tú pulsa Ctrl+C."
      } finally {
        Pop-Location
      }
    }
  }
  Ok 'Script terminado correctamente'
} catch {
  $script:HuboError = $true
  $err = $_
  Write-Host ''
  Write-Host '==============================================================' -ForegroundColor Red
  Write-Host '  EL SCRIPT SE DETUVO POR UN ERROR (la ventana se mantiene abierta)' -ForegroundColor Red
  Write-Host '==============================================================' -ForegroundColor Red
  Write-Host ''
  Write-Host "Paso: $script:PasoSeccion" -ForegroundColor Red
  if ($script:PasoActual -ne $script:PasoSeccion) { Write-Host "Comando: $script:PasoActual" -ForegroundColor Red }
  if ($err -and $err.Exception) { Write-Host "Mensaje del error: $($err.Exception.Message)" -ForegroundColor Red }
  if ($err -and $err.Exception.Message -and (-not $err.Exception.Message.StartsWith('FALLO DEL SCRIPT'))) {
    # Para errores propios (Fallar) la línea ya viene en el mensaje; para los
    # demás se muestra dónde ocurrió y la línea del script que lo produjo.
    $lineaScriptInfo = ''
    try {
      if ($err.InvocationInfo -and $err.InvocationInfo.ScriptLineNumber) {
        $lineaScriptInfo = 'línea ' + $err.InvocationInfo.ScriptLineNumber + ' del script'
        $textoLinea = $err.InvocationInfo.Line
        if ($textoLinea) { $lineaScriptInfo = $lineaScriptInfo + ' -> ' + $textoLinea.Trim() }
      }
    } catch {}
    if ($lineaScriptInfo) { Write-Host "Lugar exacto:  $lineaScriptInfo" -ForegroundColor Yellow }
  }
  try {
    if ($err -and $err.ScriptStackTrace) {
      Write-Host 'Origen del error (pila):' -ForegroundColor Yellow
      $lineasPila = @($err.ScriptStackTrace -split '\r?\n' | Where-Object { $_ -ne '' })
      $tomadas = 0
      foreach ($lineaPila in $lineasPila) {
        if ($tomadas -ge 6) { break }
        Write-Host ('    ' + $lineaPila.Trim())
        $tomadas = $tomadas + 1
      }
    }
  } catch {}
  Write-Host ''
  Write-Host 'QUÉ PUEDES HACER:' -ForegroundColor Yellow
  Write-Host '  1) Lee el mensaje de arriba: casi siempre dice qué falta o qué comando falló.'
  if ($script:LogIniciado) {
    Write-Host "  2) Revisa el log completo en: $script:RutaLog"
  } else {
    Write-Host '  2) El log no pudo iniciarse; tomando una captura de esta ventana sirve igual.'
  }
  Write-Host '  3) Corrige lo señalado (instalar algo, abrir Docker, liberar un puerto...), entra en la consola y reejecuta:'
  Write-Host "     powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  Write-Host '  4) Si nada de eso lo resuelve, comparte el mensaje de error y el log con el responsable.'
} finally {
  Limpiar-ClavesDeEntorno
  if ($script:LogIniciado) {
    try { Stop-Transcript -ErrorAction SilentlyContinue | Out-Null } catch {}
    Write-Host ''
    Write-Host "Log completo de esta ejecución: $script:RutaLog" -ForegroundColor Yellow
  }
  # En uso automático (-SinPausa) sí hace falta distinguir el resultado: sale
  # con código 1 si hubo error. En modo interactivo la pausa es la señal.
  if ($SinPausa -and $script:HuboError) { exit 1 }
  Pausa-Final
}
