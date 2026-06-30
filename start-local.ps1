# Sobe backend (uvicorn :8000) e frontend (next dev :3000) em janelas próprias,
# destacadas da sessão do Claude — sobrevivem entre turnos. Rode: powershell -File start-local.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Start-Process -FilePath "$root\backend\.venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload", "--reload-dir", "app" `
    -WorkingDirectory "$root\backend" -WindowStyle Normal

Start-Process -FilePath "node" `
    -ArgumentList "node_modules\next\dist\bin\next", "dev" `
    -WorkingDirectory "$root\frontend" -WindowStyle Normal

Write-Host "Backend  -> http://127.0.0.1:8000"
Write-Host "Frontend -> http://localhost:3000  (aguarde ~10s o primeiro compile)"
