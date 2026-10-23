@echo off
setlocal
pushd "%~dp0"
node ambiente.cjs preparar
if errorlevel 1 goto falha
node verificar.cjs
if errorlevel 1 goto falha
node ambiente.cjs iniciar
if errorlevel 1 goto falha
echo.
echo Abra http://localhost:5678 e siga TESTAR-AQUI.md.
popd
pause
exit /b 0
:falha
echo.
echo Confira as instrucoes em TESTAR-AQUI.md.
popd
pause
exit /b 1
