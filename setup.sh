#!/bin/bash

# Dead Links Must Die - Setup Script
# This script installs all dependencies and sets up the environment

set -e  # Exit on error

echo "🔗 Dead Links Must Die - Setup"
echo "================================"
echo ""

# Check Node.js version
echo "📋 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18.x or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to 18.x or higher."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Install Playwright browsers
echo "🌐 Installing Playwright browsers..."
npx playwright install chromium --with-deps
echo "✅ Playwright browsers installed"
echo ""

# Run a quick test
echo "🧪 Running quick test..."
npm run test:unit 2>&1 | tail -5
echo ""

echo "================================"
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "  1. Start the server:  npm start"
echo "  2. Run tests:         npm test"
echo "  3. Run specific test: npm run test:unit"
echo ""
echo "📖 Documentation:"
echo "  - QUICKSTART.md - Getting started guide"
echo "  - TESTING.md    - Test documentation"
echo "  - SAAS-PLAN.md  - SaaS architecture"
echo ""
