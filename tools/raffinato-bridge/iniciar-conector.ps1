$ErrorActionPreference = 'Stop'
$BridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonExe = Join-Path $BridgeDir '.venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $PythonExe)) {
  Write-Host 'Preparando o conector Raffinato pela primeira vez...'
  python -m venv (Join-Path $BridgeDir '.venv')
  & $PythonExe -m pip install --upgrade pip
  & $PythonExe -m pip install -r (Join-Path $BridgeDir 'requirements.txt')
}

$ConfigFile = Join-Path $BridgeDir 'credentials.local.json'
if (-not (Test-Path -LiteralPath $ConfigFile)) {
  $ChecklistDir = Split-Path -Parent (Split-Path -Parent $BridgeDir)
  $DesktopDir = Split-Path -Parent $ChecklistDir
  $LegacyConfig = Join-Path $DesktopDir 'FACULDADE\PROJETOS TESTES\credentials.json'
  if (Test-Path -LiteralPath $LegacyConfig) {
    Copy-Item -LiteralPath $LegacyConfig -Destination $ConfigFile
    Write-Host 'Credenciais da ferramenta anterior importadas com sucesso.' -ForegroundColor Green
  } else {
    Copy-Item -LiteralPath (Join-Path $BridgeDir 'credentials.example.json') -Destination $ConfigFile
    Write-Host "Preencha as credenciais em: $ConfigFile" -ForegroundColor Yellow
    exit 1
  }
}

& $PythonExe (Join-Path $BridgeDir 'raffinato_bridge.py')
