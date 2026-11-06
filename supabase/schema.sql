-- ========================================================
-- Schema SQL for محمصة خصب (Khasab Coffee Roasters) Complete Database
-- Includes RBAC User Roles, Inventory, Realtime Orders, Profit Analytics, Store Settings
-- ========================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (ملفات العملاء والمستخدمين)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  city TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Roles Table (أدوار وصلاحيات المستخدمين RBAC)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer', -- 'admin', 'customer'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Products & Inventory Table (المنتجات والمخزون والتكلفة)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'coffee', 'tools', 'matcha', 'green'
  short TEXT,
  description TEXT,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  image TEXT NOT NULL,
  images JSONB DEFAULT '[]'::jsonb,
  stock_quantity INTEGER DEFAULT 50,
  low_stock_threshold INTEGER DEFAULT 5,
  cost_price_yer NUMERIC DEFAULT 0,
  cost_price_sar NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_coffee BOOLEAN DEFAULT FALSE,
  origin TEXT,
  process TEXT,
  notes JSONB DEFAULT '[]'::jsonb,
  specs JSONB DEFAULT '[]'::jsonb,
  badge TEXT,
  best_seller BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Orders Table (الطلبات، التتبع، الأرباح والحوالات)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city_type TEXT NOT NULL, -- 'aden' or 'other'
  governorate TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  pickup_point TEXT,
  notes TEXT,
  txn_ref TEXT NOT NULL,
  sender_name TEXT,
  receipt_path TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_yer NUMERIC NOT NULL,
  total_sar NUMERIC NOT NULL,
  cost_total_yer NUMERIC DEFAULT 0,
  cost_total_sar NUMERIC DEFAULT 0,
  tracking_note TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Store Settings Table (تخصيص محتوى المتجر والإعلانات)
CREATE TABLE IF NOT EXISTS public.store_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  announcement_text TEXT DEFAULT 'توصيل مجاني عند الطلب بـ +100 ريال، تحميص أسبوعي، أجود أنواع القهوة المختصة',
  announcement_enabled BOOLEAN DEFAULT TRUE,
  logo_url TEXT,
  favicon_url TEXT,
  hero_banners JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTE: run ALL files in supabase/migrations after this file; the hardening migration is mandatory.
-- RLS Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Products Policies: Public read active products, Admins full access
CREATE POLICY "Public Read Products" ON public.products FOR SELECT USING (is_active = true OR auth.role() = 'service_role');
CREATE POLICY "Admin Full Products" ON public.products FOR ALL USING (public.is_admin());

-- User Roles Policies
CREATE POLICY "User Roles Read Self" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "User Roles Full Admin" ON public.user_roles FOR ALL USING (public.is_admin());

-- Profiles Policies
CREATE POLICY "Users Read Self Profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR auth.role() = 'service_role');
CREATE POLICY "Users Update Self Profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Orders Policies
-- Orders are created only via public.place_order() (see migrations/20261106000000_security_hardening.sql)
CREATE POLICY "Users View Own Orders" ON public.orders FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "Admin Full Orders" ON public.orders FOR ALL USING (public.is_admin());

-- Store Settings Policies
CREATE POLICY "Public Read Store Settings" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Admin Full Store Settings" ON public.store_settings FOR ALL USING (public.is_admin());

-- Triggers for User Creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'customer')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage Buckets: receipts & product-images
-- Storage buckets/policies: see migrations/20261106000000_security_hardening.sql
-- (receipts is PRIVATE; uploads limited to authenticated users' own folder; product-images writes are admin-only)
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;

-- Enable Realtime for Orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
