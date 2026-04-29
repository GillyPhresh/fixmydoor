# 🚀 FixMyDoor Deployment Guide

## Recommended Hosting: Railway

Railway is the best choice for this full-stack Node.js + SQLite application because:
- ✅ Native Node.js support
- ✅ SQLite works perfectly (persistent file storage)
- ✅ Easy GitHub integration
- ✅ Automatic HTTPS
- ✅ Good free tier ($5/month after trial)
- ✅ Handles full-stack apps seamlessly

## Alternative Options

- **Render**: Good free tier, but slower cold starts
- **Fly.io**: Excellent performance, but more complex setup
- **Vercel**: Great for frontend, but SQLite tricky
- **DigitalOcean App Platform**: Reliable, but more expensive

---

## Step 1: Prepare Your Code

### 1.1 Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit: FixMyDoor booking system"

# Create GitHub repository and push
# (Replace with your GitHub username/repo)
git remote add origin https://github.com/yourusername/fixmydoor.git
git push -u origin main
```

### 1.2 Environment Variables

Create a `.env` file in your project root with:

```env
DATABASE_URL="file:./prisma/prod.db"
SESSION_SECRET="your-super-secure-random-session-secret-here"
NODE_ENV="production"
```

**⚠️ Important**: Generate a secure SESSION_SECRET:
```bash
# On Linux/Mac
openssl rand -base64 32

# Or use an online generator for a 32-character random string
```

---

## Step 2: Deploy to Railway

### 2.1 Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Verify your email

### 2.2 Deploy Your App

1. Click **"New Project"**
2. Choose **"Deploy from GitHub repo"**
3. Connect your GitHub account
4. Select your `fixmydoor` repository
5. Click **"Deploy"**

Railway will automatically:
- ✅ Detect it's a Node.js app
- ✅ Install dependencies
- ✅ Run the build process
- ✅ Start the server
- ✅ Provide a live URL

### 2.3 Configure Environment Variables

1. In your Railway project dashboard, go to **"Variables"**
2. Add these variables:
   - `DATABASE_URL`: `file:./prisma/prod.db`
   - `SESSION_SECRET`: Your secure random string
   - `NODE_ENV`: `production`

### 2.4 Database Setup

Railway will automatically run your build process, which includes:
- ✅ Prisma client generation
- ✅ Database migration
- ✅ Admin user creation

### 2.5 Custom Domain (Optional)

1. Go to **"Settings"** → **"Domains"**
2. Add your custom domain
3. Configure DNS records as instructed

---

## Step 3: Post-Deployment Setup

### 3.1 Test Your Application

1. Visit your Railway URL (e.g., `https://fixmydoor.up.railway.app`)
2. Test the booking form
3. Test admin login: `/admin`
   - Username: `admin`
   - Password: `admin123`

### 3.2 Change Default Admin Password

**⚠️ CRITICAL**: Change the default password immediately!

1. Connect to your database:
   ```bash
   # In Railway dashboard → "Data" → "Connect"
   npx prisma studio --browser none --port 5555
   ```

2. Or update via code - modify `server/auth.ts` to change the default password

### 3.3 Monitor Your App

- **Logs**: Railway dashboard → "Logs"
- **Metrics**: Railway dashboard → "Metrics"
- **Database**: Railway dashboard → "Data"

---

## Step 4: Production Checklist

- ✅ **HTTPS**: Enabled automatically by Railway
- ✅ **Environment Variables**: Configured
- ✅ **Database**: SQLite with persistent storage
- ✅ **Sessions**: Secure with HTTPS
- ✅ **Admin Password**: Changed from default
- ✅ **Domain**: Custom domain configured (optional)
- ✅ **Backups**: Railway provides automatic backups

---

## Troubleshooting

### Build Fails
```bash
# Check Railway logs
# Common issues:
# - Missing environment variables
# - Prisma client generation issues
# - Node.js version compatibility
```

### Database Issues
```bash
# Reset database (⚠️ destroys data)
# Railway dashboard → "Data" → "Reset Database"
```

### Admin Login Not Working
- Check SESSION_SECRET is set
- Verify admin user was created (check logs)
- Try resetting the database

---

## Cost Estimate

- **Railway Free Tier**: $5/month after 512MB RAM trial
- **Custom Domain**: Free on Railway
- **Database**: Included (SQLite file-based)
- **Bandwidth**: Generous free tier

---

## Alternative: Docker Deployment

If you prefer Docker deployment:

### Build & Push Docker Image
```bash
# Build image
docker build -t fixmydoor .

# Tag for your registry
docker tag fixmydoor your-registry/fixmydoor:latest

# Push to registry
docker push your-registry/fixmydoor:latest
```

### Deploy to Docker Host
```bash
# Run with environment variables
docker run -p 3000:3000 \
  -e DATABASE_URL="file:./prisma/prod.db" \
  -e SESSION_SECRET="your-secret" \
  -e NODE_ENV="production" \
  your-registry/fixmydoor:latest
```

---

## 🎉 You're Live!

Your FixMyDoor booking system is now live and accessible worldwide! Share your Railway URL with customers to start receiving bookings.

**Next Steps:**
1. Update your business website to link to the booking form
2. Set up email notifications (future enhancement)
3. Add Google Analytics or similar tracking
4. Consider adding payment integration for deposits