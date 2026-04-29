@echo off
REM FixMyDoor Deployment Script for Windows
REM This script helps prepare and deploy the application

echo 🚀 FixMyDoor Deployment Script
echo ================================

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the project root directory
    pause
    exit /b 1
)

if not exist "prisma\schema.prisma" (
    echo ❌ Error: Please run this script from the project root directory
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
call pnpm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo 🗄️  Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ❌ Failed to generate Prisma client
    pause
    exit /b 1
)

echo 🏗️  Building application...
call pnpm build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo ✅ Build completed successfully!
echo.
echo 📋 Next steps:
echo 1. Push your code to GitHub:
echo    git add .
echo    git commit -m "Ready for deployment"
echo    git push origin main
echo.
echo 2. Deploy to Railway:
echo    - Go to https://railway.app
echo    - Create new project from GitHub repo
echo    - Add environment variables in Railway dashboard
echo.
echo 3. Set environment variables in Railway:
echo    DATABASE_URL=file:./prisma/prod.db
echo    SESSION_SECRET=your-secure-random-secret
echo    NODE_ENV=production
echo.
echo 4. Test your deployed application
echo 5. Change the default admin password!
echo.
echo 📖 See DEPLOYMENT.md for detailed instructions
echo.
pause