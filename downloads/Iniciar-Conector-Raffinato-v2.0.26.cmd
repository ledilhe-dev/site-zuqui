@echo off
setlocal
set "CONNECTOR_EXE=%~dp0Conector-Raffinato-v2.0.26.exe"
if not exist "%CONNECTOR_EXE%" (
  echo Baixando o Conector Raffinato 2.0.26 original...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing 'https://checkdiario.com.br/downloads/Conector-Raffinato-v2.0.26.exe' -OutFile '%CONNECTOR_EXE%'"
)
for /f "tokens=*" %%H in ('powershell.exe -NoProfile -Command "(Get-FileHash -LiteralPath '%CONNECTOR_EXE%' -Algorithm SHA256).Hash"') do set "CONNECTOR_HASH=%%H"
if /I not "%CONNECTOR_HASH%"=="8B53D7B484AA5D8C17D25D1DA3E9B84DADAA2C18B58A76F9A0655C6C11792872" (
  echo O arquivo baixado nao corresponde ao Conector Raffinato 2.0.26 validado.
  pause
  exit /b 2
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$target=[IO.Path]::GetFullPath('%CONNECTOR_EXE%'); Get-CimInstance Win32_Process ^| Where-Object { $_.Name -like 'Conector-Raffinato-v*.exe' -and [IO.Path]::GetFullPath([string]$_.ExecutablePath) -ne $target } ^| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 800"
start "" "%CONNECTOR_EXE%"
endlocal
