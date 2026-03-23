# SafeRoad - Deployment Guide

This guide will help you deploy SafeRoad to free hosting platforms.

## Prerequisites
- GitHub account
- Railway account (for backend)
- Vercel account (for insurance portal)
- Supabase account (for database)
- Expo account (for mobile app)

## Step 1: Push to GitHub

```bash
cd safaroad
git init
git add .
git commit -m "Initial SafeRoad commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/safaroad.git
git push -u origin main
```

## Step 2: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your:
   - Project URL
   - `anon` public key
   - `service_role` secret key

3. Open SQL Editor in Supabase dashboard
4. Run the contents of `backend/supabase-setup.sql`

5. Enable Phone OTP:
   - Go to Authentication > Providers
   - Enable "Phone" provider
   - Configure SMS provider (Twilio, Vonage, or MessageBird)

## Step 3: Deploy Backend to Railway

### Option A: Railway Dashboard (Recommended)

1. Go to [railway.app](https://railway.app)
2. Click "New Project" > "Deploy from GitHub"
3. Select your SafeRoad repository
4. Add environment variables:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_anon_key
   SUPABASE_SERVICE_KEY=your_service_key
   SECRET_KEY=generate_a_random_string
   DEBUG=false
   ```
5. Railway will auto-detect and deploy

### Option B: Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway add
railway env set SUPABASE_URL=xxx
railway env set SUPABASE_KEY=xxx
railway env set SUPABASE_SERVICE_KEY=xxx
railway up
```

Your backend will be live at: `https://your-project.railway.app`

## Step 4: Deploy Insurance Portal to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" > "Project"
3. Import your GitHub repository
4. Set root directory to `insurance`
5. Add environment variable:
   ```
   VITE_API_URL=https://your-railway-backend.railway.app/api/v1
   ```
6. Click "Deploy"

Your portal will be live at: `https://safaroad-insurance.vercel.app`

## Step 5: Configure Mobile App

1. Update `app.json` with your API URL:
```json
{
  "extra": {
    "apiUrl": "https://your-railway-backend.railway.app/api/v1",
    "wsUrl": "wss://your-railway-backend.railway.app"
  }
}
```

2. Deploy to Expo:
```bash
cd mobile
eas login
eas build --platform android
eas build --platform ios
```

## Step 6: Update .env Files

### Backend `.env`
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJxxx
SUPABASE_SERVICE_KEY=eyJxxx
SECRET_KEY=your-generated-secret
DEBUG=false
```

### Insurance Portal `.env`
```
VITE_API_URL=https://your-railway-app.railway.app/api/v1
```

## Free Tier Limits

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Railway | 500 hours/month | Sleeps after 5 min inactivity |
| Supabase | 500MB DB, 1GB transfer | Unlimited projects |
| Vercel | 100GB bandwidth | Unlimited deployments |
| Expo | Unlimited builds | EAS Build has free tier |

## Domain Configuration

After deployment, update your domains:

- **Backend API**: Update in mobile app `extra.apiUrl`
- **Insurance Portal**: Already configured in Vercel
- **WebSocket**: Update in mobile app `extra.wsUrl`

## Troubleshooting

### Backend not starting?
- Check Railway logs: `railway logs`
- Verify environment variables are set
- Check Supabase connection

### Mobile app not connecting?
- Verify API URL in app.json
- Check CORS settings in FastAPI
- Test API endpoint in browser

### Insurance portal not loading data?
- Verify VITE_API_URL environment variable
- Check if backend is running
- Test API endpoint directly

## Production Checklist

- [ ] Enable HTTPS on all endpoints
- [ ] Set DEBUG=false
- [ ] Configure rate limiting
- [ ] Set up monitoring (Datadog, Sentry)
- [ ] Configure backup for Supabase
- [ ] Set up custom domains

## Support

For issues, open an issue on GitHub or contact support.
