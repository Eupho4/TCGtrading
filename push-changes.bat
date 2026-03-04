@echo off
echo Haciendo pull de cambios remotos...
git pull origin main --rebase

echo.
echo Haciendo push de cambios locales...
git push origin main

echo.
echo Listo! Presiona cualquier tecla para cerrar...
pause
