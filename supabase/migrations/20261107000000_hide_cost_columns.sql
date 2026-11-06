-- Apply ONLY AFTER the new frontend (which selects explicit columns) is deployed.
-- The old frontend uses select('*') and breaks when cost columns are not readable.
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (id, slug, name, category, short, description, variants, image, images,
              stock_quantity, low_stock_threshold, is_active, is_coffee, origin, process,
              notes, specs, badge, best_seller, created_at)
  ON public.products TO anon, authenticated;
