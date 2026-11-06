import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Server-only client. Never hardcode keys here: configure them as environment variables.
// SUPABASE_SERVICE_ROLE_KEY must NEVER be exposed with a VITE_ prefix.
const supabaseUrl =
  (typeof process !== "undefined" && (process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL)) || "";

const supabaseKey =
  (typeof process !== "undefined" &&
    (process.env?.SUPABASE_SERVICE_ROLE_KEY ||
      process.env?.SUPABASE_PUBLISHABLE_KEY ||
      process.env?.VITE_SUPABASE_PUBLISHABLE_KEY)) ||
  "";

export const createServerSupabaseClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE key environment variables.");
  }
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

let cached: ReturnType<typeof createServerSupabaseClient> | undefined;
export const supabaseServer = new Proxy({} as ReturnType<typeof createServerSupabaseClient>, {
  get: (_t, prop) => (cached ??= createServerSupabaseClient())[prop as keyof typeof cached],
});
