# Git Setup Script for Enterprise Help Center
# Run this script from C:\CWC2.0

Write-Host "🚀 Setting up Git repository for Enterprise Help Center..." -ForegroundColor Green
Write-Host ""

# Check if git is installed
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git is not installed. Please install Git first." -ForegroundColor Red
    exit 1
}

# Initialize git if not already initialized
if (!(Test-Path .git)) {
    Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git initialized" -ForegroundColor Green
}
else {
    Write-Host "✅ Git repository already initialized" -ForegroundColor Green
}

# Check git status
Write-Host ""
Write-Host "📊 Checking repository status..." -ForegroundColor Yellow
git status --short

# Add all files
Write-Host ""
Write-Host "➕ Adding all files to Git..." -ForegroundColor Yellow
git add .

# Show what will be committed
Write-Host ""
Write-Host "📝 Files to be committed:" -ForegroundColor Yellow
git status --short

# Prompt for commit
Write-Host ""
$commit = Read-Host "Do you want to create the initial commit? (y/n)"

if ($commit -eq "y" -or $commit -eq "Y") {
    Write-Host ""
    Write-Host "💾 Creating initial commit..." -ForegroundColor Yellow
    
    git commit -m "Initial commit: Enterprise Help Center

- Backend: Express + TypeScript + Prisma
- Frontend: React + TypeScript + Vite
- Features: IT Support, HR Services, Group Finance
- Dynamic forms with custom fields
- File upload support
- Rate limiting and authentication
- Multi-service desk support"

    Write-Host "✅ Initial commit created!" -ForegroundColor Green
    
    # Show commit log
    Write-Host ""
    Write-Host "📜 Commit history:" -ForegroundColor Yellow
    git log --oneline -1
    
    Write-Host ""
    Write-Host "🎯 Next steps:" -ForegroundColor Cyan
    Write-Host "1. Create a new repository on GitHub: https://github.com/new" -ForegroundColor White
    Write-Host "2. Copy the repository URL (e.g., https://github.com/username/repo.git)" -ForegroundColor White
    Write-Host "3. Run these commands:" -ForegroundColor White
    Write-Host ""
    Write-Host "   git remote add origin https://github.com/username/repo.git" -ForegroundColor Yellow
    Write-Host "   git branch -M main" -ForegroundColor Yellow
    Write-Host "   git push -u origin main" -ForegroundColor Yellow
    Write-Host ""
    
}
else {
    Write-Host "⏭️  Skipping commit. You can commit later with:" -ForegroundColor Yellow
    Write-Host "   git commit -m 'Your commit message'" -ForegroundColor White
}

Write-Host ""
Write-Host "✨ Setup complete!" -ForegroundColor Green
