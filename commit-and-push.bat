@echo off
echo Añadiendo cambios al stage...
git add .

echo.
echo Haciendo commit...
git commit -m "Fix: Bug cartas borradas reaparecen + mejoras intercambio"

echo.
echo Haciendo pull con rebase...
git pull origin main --rebase

echo.
echo Haciendo push...
git push origin main

echo.
echo Listo! Presiona cualquier tecla para cerrar...
pause
