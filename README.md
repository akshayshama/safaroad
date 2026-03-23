# SafeRoad

Real-time pothole tracking SaaS platform for insurance companies.

## Project Structure

```
safaroad/
├── backend/          # FastAPI backend
├── mobile/          # React Native mobile app
└── insurance/       # Insurance company portal
```

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Configure .env with your Supabase credentials
uvicorn app.main:app --reload
```

### Mobile App
```bash
cd mobile
npm install
npx expo start
```

### Insurance Portal
```bash
cd insurance
npm install
npm run dev
```

## Tech Stack

- **Backend**: FastAPI, Supabase, Redis, WebSockets
- **Mobile**: React Native, Expo, TensorFlow Lite
- **Dashboard**: React, TailwindCSS, Recharts, MapLibre

## License

MIT
