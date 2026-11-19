-- ==============================================================================
-- ContactFormSite / Smart Poster: Supabase Database Schema
-- Includes:
-- 1. profiles table (stores user tier: 'basic'|'free'|'pro'|'studio'|'agency'|'unlimited' & subscription status)
-- 2. Trigger on auth.users to automatically provision profile upon Google login
-- 3. brands table (stores cloud-synced campaign/product profiles)
-- 4. campaign_logs table (stores blast submission records)
-- 5. Row Level Security (RLS) policies for complete multi-tenant security
-- ==============================================================================

-- 1. Enable UUID Extension (standard in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Public Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('free', 'basic', 'pro', 'studio', 'agency', 'unlimited')),
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    full_name TEXT,
    avatar_url TEXT,
    billing_interval TEXT DEFAULT 'monthly',
    subscription_status TEXT DEFAULT 'inactive',
    dodo_subscription_id TEXT,
    dodo_customer_id TEXT,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent migration for existing databases
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly',
    ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
    ADD COLUMN IF NOT EXISTS dodo_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS dodo_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));
    END IF;
    -- Upgrade tier check constraint to support 'free', 'basic', 'pro', 'studio', 'agency', and 'unlimited'
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
    ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_tier_check CHECK (tier IN ('free', 'basic', 'pro', 'studio', 'agency', 'unlimited'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_dodo_subscription_id
    ON public.profiles (dodo_subscription_id);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
CREATE POLICY "Service role full access on profiles"
ON public.profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Automatic Profile Creation Trigger on Sign-up (Google OAuth / Gmail)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, tier, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
        'basic',
        'user'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Brands Table for Cloud Sync (Scoped per user_id + soft delete tombstone)
CREATE TABLE IF NOT EXISTS public.brands (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    PRIMARY KEY (user_id, id)
);

-- Idempotent migration for existing databases using single-column id PK
DO $$
DECLARE
    pk_cols INTEGER;
BEGIN
    SELECT COUNT(*) INTO pk_cols
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = 'public.brands'::regclass AND i.indisprimary;

    IF pk_cols = 1 THEN
        ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_pkey;
        ALTER TABLE public.brands ADD PRIMARY KEY (user_id, id);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.brands
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_brands_user_updated
    ON public.brands (user_id, updated_at DESC);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own brands" ON public.brands;
CREATE POLICY "Users manage own brands"
ON public.brands FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on brands" ON public.brands;
CREATE POLICY "Service role full access on brands"
ON public.brands FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Campaign Logs Table for Cloud Sync (Master Audit + Error Logs)
CREATE TABLE IF NOT EXISTS public.campaign_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_log_id TEXT,
    brand_id TEXT,
    module TEXT DEFAULT 'outreach',
    target_url TEXT NOT NULL,
    domain TEXT DEFAULT '',
    campaign_name TEXT DEFAULT '',
    content_snippet TEXT DEFAULT '',
    status TEXT NOT NULL,
    status_code INTEGER,
    error TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaign_logs
    ADD COLUMN IF NOT EXISTS client_log_id TEXT,
    ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'outreach',
    ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS campaign_name TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS content_snippet TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS status_code INTEGER,
    ADD COLUMN IF NOT EXISTS error TEXT;

DROP INDEX IF EXISTS public.idx_campaign_logs_user_client_id;
CREATE UNIQUE INDEX idx_campaign_logs_user_client_id
    ON public.campaign_logs (user_id, client_log_id);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_user_created
    ON public.campaign_logs (user_id, created_at DESC);

ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own campaign logs" ON public.campaign_logs;
CREATE POLICY "Users manage own campaign logs"
ON public.campaign_logs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on campaign_logs" ON public.campaign_logs;
CREATE POLICY "Service role full access on campaign_logs"
ON public.campaign_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. Dynamic Prompt Templates Table
CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    system_instruction TEXT NOT NULL,
    temperature NUMERIC DEFAULT 0.7,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access on ai_prompt_templates" ON public.ai_prompt_templates;
CREATE POLICY "Public read access on ai_prompt_templates"
ON public.ai_prompt_templates FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role full access on ai_prompt_templates" ON public.ai_prompt_templates;
CREATE POLICY "Service role full access on ai_prompt_templates"
ON public.ai_prompt_templates FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 7. Master Directory Database (Managed by Admin, readable by all users)
CREATE TABLE IF NOT EXISTS public.directories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    category TEXT NOT NULL DEFAULT 'general',
    domain_rating INTEGER DEFAULT 70,
    description TEXT DEFAULT '',
    pricing_type TEXT NOT NULL DEFAULT 'free',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.directories ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.directories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access on active directories" ON public.directories;
CREATE POLICY "Public read access on active directories"
ON public.directories FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role full access on directories" ON public.directories;
CREATE POLICY "Service role full access on directories"
ON public.directories FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 8. Extension Releases / Versions (Managed by Admin, readable by all users)
CREATE TABLE IF NOT EXISTS public.extension_releases (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT DEFAULT '',
    download_url TEXT NOT NULL,
    file_size TEXT DEFAULT '~520 KB',
    is_latest BOOLEAN NOT NULL DEFAULT false,
    released_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.extension_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access on extension_releases" ON public.extension_releases;
CREATE POLICY "Public read access on extension_releases"
ON public.extension_releases FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role full access on extension_releases" ON public.extension_releases;
CREATE POLICY "Service role full access on extension_releases"
ON public.extension_releases FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 9. New Features & Bug Fixes Changelog (Managed by Admin, readable by all users)
CREATE TABLE IF NOT EXISTS public.changelog_entries (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'feature' CHECK (category IN ('feature', 'improvement', 'fix')),
    description TEXT NOT NULL,
    published_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access on changelog_entries" ON public.changelog_entries;
CREATE POLICY "Public read access on changelog_entries"
ON public.changelog_entries FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role full access on changelog_entries" ON public.changelog_entries;
CREATE POLICY "Service role full access on changelog_entries"
ON public.changelog_entries FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 10. User Workspace Preferences (Directory bookmarks, custom directories, research alerts config)
CREATE TABLE IF NOT EXISTS public.user_workspace_prefs (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    bookmarked_directory_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_directories JSONB NOT NULL DEFAULT '[]'::jsonb,
    research_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_workspace_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own workspace prefs" ON public.user_workspace_prefs;
CREATE POLICY "Users manage own workspace prefs"
ON public.user_workspace_prefs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on user_workspace_prefs" ON public.user_workspace_prefs;
CREATE POLICY "Service role full access on user_workspace_prefs"
ON public.user_workspace_prefs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 11. Completed / Submitted URLs (Scoped per user_id)
CREATE TABLE IF NOT EXISTS public.completed_urls (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id TEXT DEFAULT 'brand-default',
    brand_name TEXT DEFAULT 'Brand',
    url TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'outreach',
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_completed_urls_user
    ON public.completed_urls (user_id, completed_at DESC);

ALTER TABLE public.completed_urls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own completed urls" ON public.completed_urls;
CREATE POLICY "Users manage own completed urls"
ON public.completed_urls FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on completed_urls" ON public.completed_urls;
CREATE POLICY "Service role full access on completed_urls"
ON public.completed_urls FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 12. Consolidated User Settings & Global Suppression
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;
CREATE POLICY "Users manage own settings"
ON public.user_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on user_settings" ON public.user_settings;
CREATE POLICY "Service role full access on user_settings"
ON public.user_settings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 13. Optional Brand Media Assets Storage Bucket (brand-assets)
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('brand-assets', 'brand-assets', true)
    ON CONFLICT (id) DO NOTHING;

    DROP POLICY IF EXISTS "Public read brand assets" ON storage.objects;
    CREATE POLICY "Public read brand assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'brand-assets');

    DROP POLICY IF EXISTS "Users upload own brand assets" ON storage.objects;
    CREATE POLICY "Users upload own brand assets"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'brand-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

    DROP POLICY IF EXISTS "Users update own brand assets" ON storage.objects;
    CREATE POLICY "Users update own brand assets"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'brand-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

    DROP POLICY IF EXISTS "Users delete own brand assets" ON storage.objects;
    CREATE POLICY "Users delete own brand assets"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'brand-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

