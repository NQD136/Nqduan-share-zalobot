@echo off
setlocal

if not exist "node_modules" (
    echo "No required modules found, starting module installation process..."
    npm install
) else (
    echo "Starting Bot Zalo Nqduan  - V1.5.0 Developed by Nqduan"
)

npm run bot

endlocal
