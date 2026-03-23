-- SafeRoad Database Setup Script for Supabase
-- Run this in the Supabase SQL Editor

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user',
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    notification_enabled BOOLEAN DEFAULT TRUE,
    alert_radius_km INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create potholes table
CREATE TABLE IF NOT EXISTS potholes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
    size_sqm DECIMAL(6,4),
    depth_cm DECIMAL(4,2),
    confidence DECIMAL(3,2) NOT NULL DEFAULT 0.8,
    image_url TEXT,
    source VARCHAR(50) DEFAULT 'mobile',
    reported_by UUID REFERENCES profiles(id),
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    h3_index VARCHAR(20),
    road_name TEXT,
    city VARCHAR(100) DEFAULT 'Mumbai',
    additional_data JSONB,
    location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ) STORED
);

-- Create spatial index
CREATE INDEX IF NOT EXISTS idx_potholes_location ON potholes USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_potholes_h3 ON potholes(h3_index);
CREATE INDEX IF NOT EXISTS idx_potholes_reported_at ON potholes(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_potholes_city ON potholes(city);
CREATE INDEX IF NOT EXISTS idx_potholes_severity ON potholes(severity);
CREATE INDEX IF NOT EXISTS idx_potholes_resolved ON potholes(resolved);

-- Create claim_validations table
CREATE TABLE IF NOT EXISTS claim_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id VARCHAR(100) NOT NULL UNIQUE,
    insurance_company VARCHAR(100),
    damage_latitude DOUBLE PRECISION NOT NULL,
    damage_longitude DOUBLE PRECISION NOT NULL,
    damage_timestamp TIMESTAMPTZ,
    damage_type VARCHAR(50),
    vehicle_info TEXT,
    validation_result VARCHAR(20),
    nearest_pothole_id UUID REFERENCES potholes(id),
    distance_meters DECIMAL(6,2),
    risk_score DECIMAL(3,2),
    confidence DECIMAL(3,2),
    claim_map_url TEXT,
    pothole_image_url TEXT,
    validated_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pothole_votes table
CREATE TABLE IF NOT EXISTS pothole_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pothole_id UUID REFERENCES potholes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    vote BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pothole_id, user_id)
);

-- Create alert_subscriptions table
CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    name TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    filters JSONB,
    secret_key TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE potholes ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pothole_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Potholes: Anyone can read potholes
CREATE POLICY "Anyone can view potholes" ON potholes
    FOR SELECT USING (true);

-- Potholes: Anyone can insert (for reporting)
CREATE POLICY "Anyone can report potholes" ON potholes
    FOR INSERT WITH CHECK (true);

-- Potholes: Users can update potholes they reported or if admin
CREATE POLICY "Users can update own potholes" ON potholes
    FOR UPDATE USING (auth.uid() = reported_by);

-- Claims: Users with insurance role can read all
CREATE POLICY "Insurance can view claims" ON claim_validations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('insurance', 'admin')
        )
    );

-- Claims: Anyone can create validations
CREATE POLICY "Anyone can create validations" ON claim_validations
    FOR INSERT WITH CHECK (true);

-- Votes: Users can manage their own votes
CREATE POLICY "Users can manage own votes" ON pothole_votes
    FOR ALL USING (auth.uid() = user_id);

-- Subscriptions: Users manage their own subscriptions
CREATE POLICY "Users manage own subscriptions" ON alert_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, phone, email)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'phone', NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for potholes
ALTER PUBLICATION supabase_realtime ADD TABLE potholes;

-- Create H3 index function
CREATE OR REPLACE FUNCTION update_h3_index()
RETURNS TRIGGER AS $$
BEGIN
    NEW.h3_index := h3_cell_from_point(ST_MakePoint(NEW.longitude, NEW.latitude), 9);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update h3_index
DROP TRIGGER IF EXISTS pothole_h3_trigger ON potholes;
CREATE TRIGGER pothole_h3_trigger
    BEFORE INSERT OR UPDATE ON potholes
    FOR EACH ROW EXECUTE FUNCTION update_h3_index();

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create function for nearby pothole search
CREATE OR REPLACE FUNCTION get_nearby_potholes(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 5,
    min_severity SMALLINT DEFAULT 1
)
RETURNS TABLE (
    id UUID,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    severity SMALLINT,
    distance_meters DOUBLE PRECISION,
    road_name TEXT,
    reported_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.latitude,
        p.longitude,
        p.severity,
        ST_Distance(p.location, ST_MakePoint(lng, lat)::geography) as distance_meters,
        p.road_name,
        p.reported_at
    FROM potholes p
    WHERE ST_DWithin(
        p.location,
        ST_MakePoint(lng, lat)::geography,
        radius_km * 1000
    )
    AND p.severity >= min_severity
    AND p.resolved = FALSE
    ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

PRINT '✅ SafeRoad database setup complete!';
