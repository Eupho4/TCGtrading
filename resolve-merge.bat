@echo off
echo Abortando merge incompleto...
git merge --abort

echo.
echo Haciendo pull con rebase...
git pull origin main --rebase

echo.
echo Haciendo push de cambios locales...
git push origin main

echo.
echo Listo! Presiona cualquier tecla para cerrar...
pause
