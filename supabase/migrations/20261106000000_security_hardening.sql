-- ========================================================
-- Security hardening (pentest remediation) - 2026-11-06
-- ========================================================

-- --------------------------------------------------------
-- 1) Table privileges: least privilege. RLS stays enabled, but
--    anon must not hold DML/TRUNCATE on anything.
-- --------------------------------------------------------
REVOKE ALL ON public.categories, public.orders, public.products,
              public.profiles, public.store_settings, public.user_roles FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.categories, public.orders, public.products,
              public.profiles, public.store_settings, public.user_roles FROM authenticated;

GRANT SELECT ON public.categories, public.store_settings TO anon;

-- Orders are created ONLY through public.place_order(); no direct INSERT.
REVOKE INSERT ON public.orders FROM authenticated;
DROP POLICY IF EXISTS "Users Create Orders" ON public.orders;

-- Hide wholesale cost prices from the public API (column-level grants).
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (id, slug, name, category, short, description, variants, image, images,
              stock_quantity, low_stock_threshold, is_active, is_coffee, origin, process,
              notes, specs, badge, best_seller, created_at)
  ON public.products TO anon, authenticated;

-- Profiles: allow a user to create/update only their own row.
DROP POLICY IF EXISTS "Users Update Self Profile" ON public.profiles;
CREATE POLICY "Users Update Self Profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users Insert Self Profile" ON public.profiles;
CREATE POLICY "Users Insert Self Profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- --------------------------------------------------------
-- 2) Functions: fixed search_path + restricted EXECUTE
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
END;
$$;
-- is_admin() is referenced by RLS policies, so roles must keep EXECUTE (it only returns a boolean for the caller).
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (new.id, left(new.raw_user_meta_data->>'full_name', 100), left(new.raw_user_meta_data->>'phone', 30))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'customer')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_order_cancellation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  item JSONB;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
      UPDATE public.products SET stock_quantity = stock_quantity + (item->>'qty')::INT
      WHERE slug = item->>'slug';
    END LOOP;
  ELSIF NEW.status IS DISTINCT FROM 'cancelled' AND OLD.status = 'cancelled' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
      UPDATE public.products SET stock_quantity = stock_quantity - (item->>'qty')::INT
      WHERE slug = item->>'slug';
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_order_cancellation() FROM PUBLIC, anon, authenticated;

-- Admin-only access to cost prices (hidden from public API columns).
CREATE OR REPLACE FUNCTION public.admin_product_costs()
RETURNS TABLE (slug TEXT, cost_price_yer NUMERIC, cost_price_sar NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT p.slug, p.cost_price_yer, p.cost_price_sar FROM public.products p;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_product_costs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_product_costs() TO authenticated;

-- --------------------------------------------------------
-- 3) place_order: authenticated only, server-side pricing & validation,
--    atomic stock handling, per-user rate limit.
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_order(payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  uid UUID := auth.uid();
  item JSONB;
  var JSONB;
  prod RECORD;
  v_slug TEXT;
  v_qty INT;
  v_opt TEXT;
  v_label TEXT;
  v_yer NUMERIC;
  v_sar NUMERIC;
  tot_yer NUMERIC := 0;
  tot_sar NUMERIC := 0;
  cost_yer NUMERIC := 0;
  cost_sar NUMERIC := 0;
  clean_items JSONB := '[]'::jsonb;
  v_code TEXT;
  v_new_id UUID;
  v_name TEXT;
  v_phone TEXT;
  v_city TEXT;
  v_gov TEXT;
  v_method TEXT;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_receipt TEXT;
  n_items INT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لإتمام الطلب' USING ERRCODE = '42501';
  END IF;
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'بيانات الطلب غير صالحة';
  END IF;
  IF pg_column_size(payload) > 65536 THEN
    RAISE EXCEPTION 'حجم الطلب كبير جداً';
  END IF;

  -- Rate limit: max 10 orders per user per hour
  IF (SELECT count(*) FROM public.orders WHERE user_id = uid AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'تم تجاوز الحد المسموح من الطلبات، حاول لاحقاً' USING ERRCODE = '54000';
  END IF;

  -- Field validation
  v_name   := btrim(coalesce(payload->>'customer_name', ''));
  v_phone  := btrim(coalesce(payload->>'phone', ''));
  v_city   := coalesce(payload->>'city_type', '');
  v_gov    := btrim(coalesce(payload->>'governorate', ''));
  v_method := btrim(coalesce(payload->>'delivery_method', ''));
  IF char_length(v_name) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'الاسم غير صالح'; END IF;
  IF v_phone !~ '^[0-9+() -]{6,20}$' THEN RAISE EXCEPTION 'رقم الهاتف غير صالح'; END IF;
  IF v_city NOT IN ('aden', 'other') THEN RAISE EXCEPTION 'نوع المدينة غير صالح'; END IF;
  IF char_length(v_gov) NOT BETWEEN 1 AND 100 OR char_length(v_method) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'بيانات التوصيل غير صالحة';
  END IF;
  IF char_length(coalesce(payload->>'txn_ref', '')) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'رقم العملية غير صالح'; END IF;
  IF char_length(coalesce(payload->>'sender_name', '')) > 100
     OR char_length(coalesce(payload->>'notes', '')) > 1000
     OR char_length(coalesce(payload->>'pickup_point', '')) > 200 THEN
    RAISE EXCEPTION 'أحد الحقول طويل جداً';
  END IF;

  v_lat := NULLIF(payload->>'lat', '')::DOUBLE PRECISION;
  v_lng := NULLIF(payload->>'lng', '')::DOUBLE PRECISION;
  IF v_lat IS NOT NULL AND v_lat NOT BETWEEN -90 AND 90 THEN RAISE EXCEPTION 'إحداثيات غير صالحة'; END IF;
  IF v_lng IS NOT NULL AND v_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'إحداثيات غير صالحة'; END IF;

  v_receipt := NULLIF(payload->>'receipt_path', '');
  IF v_receipt IS NOT NULL AND (v_receipt !~ '^[A-Za-z0-9._/-]{1,200}$' OR v_receipt LIKE '%..%') THEN
    RAISE EXCEPTION 'مسار السند غير صالح';
  END IF;

  -- Items
  IF jsonb_typeof(payload->'items') <> 'array' THEN RAISE EXCEPTION 'قائمة المنتجات غير صالحة'; END IF;
  n_items := jsonb_array_length(payload->'items');
  IF n_items < 1 OR n_items > 30 THEN RAISE EXCEPTION 'عدد المنتجات غير صالح'; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    IF jsonb_typeof(item) <> 'object' THEN RAISE EXCEPTION 'منتج غير صالح'; END IF;
    v_slug := item->>'slug';
    IF coalesce(item->>'qty', '') !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'كمية غير صالحة'; END IF;
    v_qty := (item->>'qty')::INT;
    IF v_qty < 1 OR v_qty > 100 THEN RAISE EXCEPTION 'كمية غير صالحة'; END IF;

    SELECT id, name, variants, stock_quantity, cost_price_yer, cost_price_sar
      INTO prod
      FROM public.products
     WHERE slug = v_slug AND is_active = true
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'المنتج غير موجود: %', left(coalesce(v_slug, ''), 60);
    END IF;
    IF coalesce(prod.stock_quantity, 0) < v_qty THEN
      RAISE EXCEPTION 'الكمية المطلوبة غير متوفرة في المخزون للمنتج: %', prod.name;
    END IF;

    -- options is either "<grind> • <variant label>" or "<variant label>"
    v_opt := coalesce(item->>'options', '');
    v_label := btrim((regexp_split_to_array(v_opt, ' • '))[array_length(regexp_split_to_array(v_opt, ' • '), 1)]);
    var := NULL;
    IF jsonb_typeof(prod.variants) = 'array' THEN
      SELECT e INTO var FROM jsonb_array_elements(prod.variants) e WHERE e->>'label' = v_label LIMIT 1;
    END IF;
    IF var IS NULL THEN RAISE EXCEPTION 'خيار المنتج غير صالح: %', prod.name; END IF;

    v_yer := (var->>'yer')::NUMERIC;
    v_sar := (var->>'sar')::NUMERIC;

    UPDATE public.products SET stock_quantity = stock_quantity - v_qty WHERE id = prod.id;

    tot_yer  := tot_yer  + v_yer * v_qty;
    tot_sar  := tot_sar  + v_sar * v_qty;
    cost_yer := cost_yer + coalesce(prod.cost_price_yer, 0) * v_qty;
    cost_sar := cost_sar + coalesce(prod.cost_price_sar, 0) * v_qty;

    clean_items := clean_items || jsonb_build_object(
      'slug', v_slug, 'name', prod.name, 'qty', v_qty,
      'price_yer', v_yer, 'price_sar', v_sar, 'options', nullif(left(v_opt, 200), '')
    );
  END LOOP;

  -- Order code: accept a well-formed client code, otherwise generate one
  v_code := payload->>'code';
  IF v_code IS NULL OR v_code !~ '^KH-[0-9]{6,10}$'
     OR EXISTS (SELECT 1 FROM public.orders WHERE code = v_code) THEN
    v_code := 'KH-' || lpad(floor(random() * 10000000)::INT::TEXT, 7, '0');
    WHILE EXISTS (SELECT 1 FROM public.orders WHERE code = v_code) LOOP
      v_code := 'KH-' || lpad(floor(random() * 10000000)::INT::TEXT, 7, '0');
    END LOOP;
  END IF;

  INSERT INTO public.orders (
    code, user_id, customer_name, phone, city_type, governorate, delivery_method,
    lat, lng, pickup_point, notes, txn_ref, sender_name, receipt_path, items,
    total_yer, total_sar, cost_total_yer, cost_total_sar, status
  ) VALUES (
    v_code, uid, v_name, v_phone, v_city, v_gov, v_method,
    v_lat, v_lng, NULLIF(payload->>'pickup_point', ''), NULLIF(payload->>'notes', ''),
    btrim(payload->>'txn_ref'), NULLIF(btrim(coalesce(payload->>'sender_name', '')), ''), v_receipt, clean_items,
    tot_yer, tot_sar, cost_yer, cost_sar, 'pending'
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_new_id, 'code', v_code,
                            'total_yer', tot_yer, 'total_sar', tot_sar);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.place_order(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB) TO authenticated;

-- --------------------------------------------------------
-- 4) Storage: private receipts, admin-only product image writes,
--    size and MIME limits (upload-flood / malicious-file protection)
-- --------------------------------------------------------
UPDATE storage.buckets
   SET public = false, file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
 WHERE id = 'receipts';
UPDATE storage.buckets
   SET public = true, file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
 WHERE id = 'product-images';

DROP POLICY IF EXISTS "Public Receipts Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Receipts Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Product Images Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Product Images Access" ON storage.objects;

-- Customers may upload only into their own folder: <auth.uid()>/<file>
CREATE POLICY "receipts upload own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "admin manage receipts" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'receipts' AND public.is_admin())
  WITH CHECK (bucket_id = 'receipts' AND public.is_admin());

CREATE POLICY "admin manage product images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
-- (public bucket => images are served by URL without a SELECT policy, and cannot be listed anonymously)
