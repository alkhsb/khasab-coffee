import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/lib/supabase";

// Only same-site absolute paths are allowed (blocks open redirects such as "//evil.com" or "@evil.com").
const safePath = (v?: string) =>
  v && /^\/(?![/\\])[A-Za-z0-9\-._~/%?=&#]*$/.test(v) ? v : undefined;

const searchSchema = z.object({
  redirect: z.string().optional().transform(safePath),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول / إنشاء حساب عميل — محمصة خصب" },
      {
        name: "description",
        content: "سجّل دخولك أو أنشئ حساب عميل جديد في محمصة خصب لمتابعة وإكمال طلباتك.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const checkUserRoleAndNavigate = async (user: any) => {
    if (!user) return;
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdmin = roleData?.role === "admin";

      if (redirect) {
        navigate({ to: redirect as any });
      } else if (isAdmin) {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/" });
      }
    } catch (err) {
      console.error("Auth redirect error:", err);
      navigate({ to: (redirect || "/") as any });
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        checkUserRoleAndNavigate(data.session.user);
      }
    });
  }, [navigate, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();

    if (!cleanEmail || !cleanPassword) {
      toast.error("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }

    if (mode === "signup" && cleanPassword.length < 8) {
      toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        // Only customer accounts can be created via public sign up
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: cleanName,
              phone: cleanPhone,
            },
            emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}${redirect || "/"}` : undefined,
          },
        });
        if (error) throw error;

        // Upsert into public.profiles
        if (data.user) {
          try {
            await supabase.from("profiles").upsert({
              id: data.user.id,
              full_name: cleanName,
              phone: cleanPhone,
              updated_at: new Date().toISOString(),
            });
          } catch {
            // ignore profile upsert error if RLS blocks before session
          }
        }

        toast.success("تم إنشاء حساب العميل بنجاح");
        if (data.session) {
          await checkUserRoleAndNavigate(data.user);
        } else {
          toast.info("يرجى تفقّد بريدك الإلكتروني لتأكيد التسجيل");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (error) throw error;
        toast.success("تم تسجيل الدخول بنجاح");
        await checkUserRoleAndNavigate(data.user);
      }
    } catch (err: any) {
      console.error("Auth submit error:", err);
      toast.error(err?.message || "تعذر إتمام العملية");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border bg-card p-7 shadow-lg">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-center text-2xl font-extrabold text-primary">
          {mode === "signin" ? "أهلاً بك في رحاب خصب ☕" : "انضم إلى مجتمع متذوقي خصب ✨"}
        </h1>
        <p className="mt-2 text-center text-xs text-muted-foreground leading-relaxed">
          {redirect
            ? "سجّل دخولك لنكمل معاً تجهيز طلبك ونوصل عبق قهوتك إلى باب منزلك"
            : mode === "signin"
            ? "طاب يومك.. سجّل دخولك لتستمتع بأعذب نكهات القهوة المختصة وتتابع سلتك"
            : "يسعدنا انضمامك إلى عائلة عشاق البن الأصيل لنشاركك شغف وتفاصيل الكوب المثالي"}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-primary">
                  الاسم الكريم *
                </span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl border bg-background px-4 py-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/75"
                  placeholder="يا مرحباً بك.. كيف تحب أن نناديك؟"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-primary">
                  رقم الهاتف للتواصل *
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl border bg-background px-4 py-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/75"
                  placeholder="رقم هاتفك لنبقيك على علم بخروج طازج محاصيلك (77XXXXXXX)"
                />
              </label>
            </>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-primary">
              البريد الإلكتروني *
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border bg-background px-4 py-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/75"
              placeholder="عنوان بريدك لنرسل لك عبق رسائلنا وفواتيرك (name@example.com)"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-primary">
              كلمة المرور الآمنة *
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border bg-background px-4 py-3 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/75"
              placeholder="رمزك السري الخاص لحفظ ركنك ومشترياتك بأمان"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-md disabled:opacity-60 hover:bg-primary/90 transition-transform hover:scale-[1.01]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "signin" ? (
              <span>فنجان قهوتك بانتظارك.. ادخل الآن ☕</span>
            ) : (
              <span>ابدأ رحلتك معنا وسجّل حسابك 🌿</span>
            )}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center text-xs font-bold text-secondary hover:underline transition-colors block"
        >
          {mode === "signin"
            ? "جديد في عالم خصب؟ يسعدنا انضمامك وتسجيل حسابك معنا ✨"
            : "أنت بالفعل من عائلة خصب؟ سجّل دخولك إلى ركنك الخاص هنا ☕"}
        </button>
      </div>
    </div>
  );
}
