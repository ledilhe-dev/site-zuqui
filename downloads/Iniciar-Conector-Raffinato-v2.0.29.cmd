@echo off
setlocal
set "CONNECTOR_EXE=%~dp0Conector-Raffinato-v2.0.29.exe"
if not exist "%CONNECTOR_EXE%" (
  echo Baixando o Conector Raffinato 2.0.29 original...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing 'https://checkdiario.com.br/downloads/Conector-Raffinato-v2.0.29.exe' -OutFile '%CONNECTOR_EXE%'"
)
for /f "tokens=*" %%H in ('powershell.exe -NoProfile -Command "(Get-FileHash -LiteralPath '%CONNECTOR_EXE%' -Algorithm SHA256).Hash"') do set "CONNECTOR_HASH=%%H"
if /I not "%CONNECTOR_HASH%"=="BB6FE8C6D356BC3480931E82577A0D310D36BDB730BCBB22AAF762664A7EB081" (
  echo O arquivo baixado nao corresponde ao Conector Raffinato 2.0.29 validado.
  pause
  exit /b 2
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$target=[IO.Path]::GetFullPath('%CONNECTOR_EXE%'); Get-CimInstance Win32_Process ^| Where-Object { $_.Name -like 'Conector-Raffinato-v*.exe' -and [IO.Path]::GetFullPath([string]$_.ExecutablePath) -ne $target } ^| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 800"
start "" "%CONNECTOR_EXE%"
endlocal
