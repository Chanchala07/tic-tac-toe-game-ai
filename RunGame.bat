@echo off
echo ==========================================
echo Starting Advanced Tic Tac Toe Game...
echo ==========================================
echo.

REM Start the Express Backend Server in a new window
echo [1/2] Launching Backend Server...
start "Tic Tac Toe Backend" cmd /k "cd backend && npm install && npm run start"

REM Wait for a few seconds to let backend initialize
timeout /t 3 /nobreak > nul

REM Start the React Client in a new window
echo [2/2] Launching Frontend Client...
start "Tic Tac Toe Frontend" cmd /k "cd client && npm install && npm run dev -- --open"

echo.
echo ==========================================
echo ALL SYSTEMS GO!
echo A browser window should automatically open to the game shortly.
echo If not, please open: http://localhost:5173
echo ==========================================
echo.
pause
