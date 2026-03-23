# SafeRoad Backend

## Setup

1. Create virtual environment:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Environment Variables

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_SERVICE_KEY=your_service_key
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key
IMGBB_API_KEY=your_imgbb_key
DEBUG=true
```

## Endpoints

### Authentication
- POST `/api/v1/auth/send-otp` - Send OTP to phone
- POST `/api/v1/auth/verify-otp` - Verify OTP and get token
- POST `/api/v1/auth/refresh` - Refresh token
- GET `/api/v1/auth/me` - Get current user

### Potholes
- GET `/api/v1/potholes` - List potholes (paginated)
- GET `/api/v1/potholes/nearby` - Get nearby potholes
- GET `/api/v1/potholes/heatmap` - Get heatmap data
- POST `/api/v1/potholes` - Report new pothole
- GET `/api/v1/potholes/{id}` - Get pothole details
- PATCH `/api/v1/potholes/{id}` - Update pothole
- POST `/api/v1/potholes/{id}/vote` - Vote on pothole

### Claims
- POST `/api/v1/claims/validate` - Validate insurance claim
- GET `/api/v1/claims/history` - Get claim history

### Analytics
- GET `/api/v1/analytics/summary` - Get analytics summary
- GET `/api/v1/analytics/trends` - Get trend data
- GET `/api/v1/analytics/severity-distribution` - Get severity distribution
- GET `/api/v1/analytics/top-roads` - Get roads with most potholes
- GET `/api/v1/analytics/realtime-stats` - Get real-time stats

### WebSocket
- WS `/ws/potholes` - Real-time pothole updates
- WS `/ws/alerts/{user_id}` - Personal alerts
- WS `/ws/admin` - Admin dashboard updates
