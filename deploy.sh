#!/bin/bash

# FixMyDoor Deployment Script
# This script helps prepare and deploy the application

set -e

echo "🚀 FixMyDoor Deployment Script"
echo "================================"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📦 Installing dependencies..."
pnpm install

echo "🗄️  Generating Prisma client..."
npx prisma generate

echo "🏗️  Building application..."
pnpm build

echo "✅ Build completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Push your code to GitHub:"
echo "   git add ."
echo "   git commit -m 'Ready for deployment'"
echo "   git push origin main"
echo ""
echo "2. Deploy to Railway:"
echo "   - Go to https://railway.app"
echo "   - Create new project from GitHub repo"
echo "   - Add environment variables in Railway dashboard"
echo ""
echo "3. Set environment variables in Railway:"
echo "   DATABASE_URL=file:./prisma/prod.db"
echo "   SESSION_SECRET=your-secure-random-secret"
echo "   NODE_ENV=production"
echo ""
echo "4. Test your deployed application"
echo "5. Change the default admin password!"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"