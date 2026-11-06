import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Copy, CreditCard, MapPin, Store, Truck, UserCheck, Lock } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import { useCurrency } from "@/lib/currency";
import { formatPrice } from "@/lib/products";
import {
  useLiveStoreSettings,
  defaultBankAccounts,
  defaultPickupAddress,
  defaultWhatsAppNumber,
  defaultAdenDeliveryFee,
  defaultAdenDeliveryFeeSar,
  defaultPickupFee,
  defaultPickupFeeSar,
  defaultOtherDeliveryFee,
  defaultOtherDeliveryFeeSar,
} from "@/lib/settings";
import { BankLogo } from "@/components/bank-logo";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "إتمام الطلب — محمصة خصب" },
      {
        name: "description",
        content: "أكمل طلبك من محمصة خصب: توصيل داخل عدن أو للمحافظات ودفع بالتحويل البنكي.",
      },
    ],
  }),
  component: CheckoutPage,
});

const governorates = [
  "صنعاء",
  "تعز",
  "حضرموت (المكلا/سيئون)",
  "إب",
  "الحديدة",
  "ذمار",
  "مأرب",
  "شبوة",
  "أبين",
  "لحج",
  "المهرة",
  "عمران",
  "صعدة",
  "المحويت",
  "حجة",
  "البيضاء",
  "الضالع",
  "سقطرى",
  "ريمة",
];

function CheckoutPage() {
  const { items, total, totalSar, clear } = useCart();
  const { currency, setCurrency } = useCurrency();
  const { settings } = useLiveStoreSettings();
  const navigate = useNavigate();

  const accounts = settings.bank_accounts?.length > 0 ? settings.bank_accounts : defaultBankAccounts;
  const pickupAddress = settings.pickup_address || defaultPickupAddress;
  const whatsappNumber = settings.whatsapp_number || defaultWhatsAppNumber;

  const adenDeliveryFee =
    currency === "SAR"
      ? settings.aden_delivery_fee_sar || defaultAdenDeliveryFeeSar
      : settings.aden_delivery_fee || defaultAdenDeliveryFee;

  const pickupDeliveryFee =
    currency === "SAR"
      ? settings.pickup_delivery_fee_sar || defaultPickupFeeSar
      : settings.pickup_delivery_fee || defaultPickupFee;

  const otherDeliveryFee =
    currency === "SAR"
      ? settings.other_delivery_fee_sar || defaultOtherDeliveryFeeSar
      : settings.other_delivery_fee || defaultOtherDeliveryFee;

  // Auth State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Region and Shipping method
  const [region, setRegion] = useState<"aden" | "other">("aden");
  const [adenMethod, setAdenMethod] = useState<"home" | "pickup">("home");
  const [governorate, setGovernorate] = useState(governorates[0]!);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", txn: "", sender: "", notes: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        setForm((f) => ({
          ...f,
          name: data.user.user_metadata?.full_name || f.name,
          phone: data.user.user_metadata?.phone || f.phone,
        }));
      }
      setAuthLoading(false);
    });
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const copy = async (n: string) => {
    await navigator.clipboard.writeText(n);
    toast.success("تم نسخ رقم الحساب");
  };

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("تم تحديد موقعك التلقائي بنجاح");
      },
      () => toast.error("تعذر تحديد الموقع، فعّل صلاحية الموقع في جهازك"),
    );
  };

  const onFile = (file?: File) => {
    if (!file) return;
    const okTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!okTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error("الملف غير مدعوم أو أكبر من 5 ميجابايت (صورة أو PDF)");
      return;
    }
    setReceiptFile(file);
    setReceipt(URL.createObjectURL(file));
    toast.success("تم إرفاق صورة السند بنجاح");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("يجب تسجيل الدخول أولاً لإكمال الطلب");
      navigate({ to: "/auth", search: { redirect: "/checkout" } });
      return;
    }

    if (!form.name || !form.phone || !form.txn) {
      toast.error("يرجى تعبئة الاسم ورقم الهاتف ورقم العملية");
      return;
    }

    setSubmitting(true);
    const rnd = crypto.getRandomValues(new Uint32Array(1))[0] % 10000000;
    let code = "KH-" + String(rnd).padStart(7, "0");
    try {
      let receiptPath: string | null = null;
      if (receiptFile) {
        try {
          const extMap: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" };
          const ext = extMap[receiptFile.type] || "jpg";
          const path = `${user.id}/${code}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("receipts")
            .upload(path, receiptFile, { contentType: receiptFile.type, upsert: false });
          if (!upErr) receiptPath = path;
        } catch (e) {
          console.warn("Receipt upload notice:", e);
        }
      }

      const shippingMethodText =
        region === "aden"
          ? adenMethod === "home"
            ? "توصيل للمنزل - عدن"
            : `استلام من نقطة (${pickupAddress})`
          : `توصيل محافظة (${governorate})`;

      const orderPayload: Record<string, any> = {
        code,
        customer_name: form.name,
        phone: form.phone,
        city_type: region,
        governorate: region === "other" ? governorate : "عدن",
        delivery_method: shippingMethodText,
        lat: region === "aden" && adenMethod === "home" ? (coords?.lat ?? null) : null,
        lng: region === "aden" && adenMethod === "home" ? (coords?.lng ?? null) : null,
        pickup_point: region === "aden" && adenMethod === "pickup" ? pickupAddress : null,
        notes: form.notes || null,
        txn_ref: form.txn,
        sender_name: form.sender || null,
        receipt_path: receiptPath,
        items: items.map((i) => ({
          slug: i.slug,
          name: i.name,
          qty: i.qty,
          options: i.options ?? null,
        })),
      };

      const { data: rpcData, error } = await supabase.rpc("place_order", { payload: orderPayload });

      if (error) {
        console.error("Supabase RPC error details:", error);
        throw new Error(error.message || error.details || "تعذر إدخال بيانات الطلب أو الكمية غير متوفرة");
      }

      // Sync customer profile in DB
      if (user?.id) {
        try {
          await supabase.from("profiles").upsert({
            id: user.id,
            full_name: form.name,
            phone: form.phone,
            updated_at: new Date().toISOString(),
          });
        } catch {}
      }

      const serverCode = (rpcData as any)?.code;
      if (typeof serverCode === "string") code = serverCode;
      setOrderId(code);
      clear();
      toast.success("تم إرسال طلبك بنجاح!");
    } catch (err: any) {
      console.error("Order submit caught error:", err);
      toast.error(err?.message || "تعذر إرسال الطلب، يرجى المحاولة مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  if (orderId) {
    const cleanWaNumber = whatsappNumber.replace(/[^0-9]/g, "") || "967777000000";
    const msg = encodeURIComponent(`مرحباً محمصة خصب، طلبي رقم ${orderId} وقد أرسلت إشعار التحويل.`);
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-secondary text-secondary-foreground shadow-lg"
        >
          <Check className="h-10 w-10" />
        </motion.div>
        <h1 className="mt-6 text-2xl font-extrabold text-primary sm:text-3xl">تم استلام طلبك بنجاح</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          طلبك قيد التحقق من الحوالة، وسنتواصل معك فوراً لتأكيد وتجهيز طلبك.
        </p>
        <div className="mt-6 rounded-3xl border bg-card p-6 shadow-xs">
          <div className="text-xs text-muted-foreground">رقم الطلب الخاص بك</div>
          <div className="mt-1 font-mono text-3xl font-black tracking-widest text-primary">{orderId}</div>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={`https://wa.me/${cleanWaNumber}?text=${msg}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700"
          >
            تواصل عبر الواتساب لتسريع الطلب
          </a>
          <Link
            to="/products"
            search={{}}
            className="rounded-full border border-primary/20 px-6 py-3.5 text-sm font-bold text-primary hover:bg-muted"
          >
            متابعة التسوق
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="text-muted-foreground">لا توجد منتجات في السلة حالياً</p>
        <Link
          to="/products"
          search={{}}
          className="mt-5 inline-block rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-md"
        >
          تصفح المتجر الآن
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Mandatory Auth Banner if user not signed in */}
      {!authLoading && !user && (
        <div className="mb-6 rounded-3xl border border-secondary/40 bg-secondary/10 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-start">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-primary">تسجيل الدخول إجباري لإتمام الطلب</div>
              <div className="text-xs text-muted-foreground">
                يرجى تسجيل الدخول أو إنشاء حساب جديد في منصة خصب لمتابعة وإكمال طلبك
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/checkout" } })}
            className="shrink-0 rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90"
          >
            تسجيل الدخول / إنشاء حساب
          </button>
        </div>
      )}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-extrabold text-primary sm:text-3xl">إتمام الطلب</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-2xl bg-muted p-1 border">
                <button
                  type="button"
                  onClick={() => setCurrency("YER")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                    currency === "YER"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ريال يمني (YER)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("SAR")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                    currency === "SAR"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ريال سعودي (SAR)
                </button>
              </div>
              {user && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  <UserCheck className="h-3.5 w-3.5" /> حساب مسجل
                </span>
              )}
            </div>
          </div>

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="mb-4 text-base font-bold text-primary">1. بيانات العميل</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="الاسم الكامل" value={form.name} onChange={set("name")} placeholder="يا مرحباً بك.. كيف تحب أن نناديك؟" required />
              <Field
                label="رقم الهاتف للتواصل"
                value={form.phone}
                onChange={set("phone")}
                placeholder="رقم هاتفك لنبقيك على علم بخروج طلبك (77XXXXXXX)"
                type="tel"
                required
              />
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="mb-4 text-base font-bold text-primary">2. خيارات الشحن والاستلام الجغرافي</h2>

            {/* Region Selection */}
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1.5">
              <button
                type="button"
                onClick={() => setRegion("aden")}
                className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                  region === "aden" ? "bg-background text-primary shadow-xs" : "text-muted-foreground"
                }`}
              >
                داخل مدينة عدن
              </button>
              <button
                type="button"
                onClick={() => setRegion("other")}
                className={`rounded-xl py-2.5 text-xs font-bold transition-all ${
                  region === "other" ? "bg-background text-primary shadow-xs" : "text-muted-foreground"
                }`}
              >
                خارج مدينة عدن (بقية المحافظات)
              </button>
            </div>

            {/* Aden Options */}
            {region === "aden" && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAdenMethod("home")}
                    className={`flex items-start gap-3 rounded-2xl border p-4 text-start transition-all ${
                      adenMethod === "home" ? "border-secondary bg-secondary/10 shadow-xs" : "bg-background"
                    }`}
                  >
                    <MapPin className="h-5 w-5 shrink-0 text-secondary mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-primary">توصيل للمنزل - عدن</div>
                      <div className="text-xs text-muted-foreground">إجباري تحديد إحداثيات الموقع (GPS)</div>
                      <div className="mt-2 inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-300/40">
                        التوصيل: {adenDeliveryFee}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdenMethod("pickup")}
                    className={`flex items-start gap-3 rounded-2xl border p-4 text-start transition-all ${
                      adenMethod === "pickup" ? "border-secondary bg-secondary/10 shadow-xs" : "bg-background"
                    }`}
                  >
                    <Store className="h-5 w-5 shrink-0 text-secondary mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-primary">استلام من نقطة الاستلام</div>
                      <div className="text-xs text-muted-foreground">الحجاز الجديد محل أضواء</div>
                      <div className="mt-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-300/40">
                        التوصيل: {pickupDeliveryFee}
                      </div>
                    </div>
                  </button>
                </div>

                {adenMethod === "home" ? (
                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      onClick={locate}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90"
                    >
                      <MapPin className="h-4 w-4" /> تحديد موقعي الجغرافي تلقائياً (GPS)
                    </button>

                    <div className="overflow-hidden rounded-2xl border bg-sand">
                      {coords ? (
                        <iframe
                          title="موقع التوصيل"
                          className="h-56 w-full"
                          loading="lazy"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.01}%2C${coords.lat - 0.01}%2C${coords.lng + 0.01}%2C${coords.lat + 0.01}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`}
                        />
                      ) : (
                        <div className="grid h-40 place-items-center text-xs text-muted-foreground text-center p-4">
                          اضغط "تحديد موقعي الجغرافي" لعرض موقعك على الخريطة وسحب الدبوس
                        </div>
                      )}
                    </div>

                    <textarea
                      value={form.notes}
                      onChange={set("notes")}
                      placeholder="ملاحظات العنوان بالتفصيل (المديرية، الحي، الشارع، أقرب معلم)"
                      className="min-h-20 w-full rounded-2xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-secondary/30 bg-secondary/15 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-secondary">نقطة الاستلام المحجوزة لك:</div>
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                        استلام مجاني
                      </span>
                    </div>
                    <div className="mt-1 font-extrabold text-sm text-primary">{pickupAddress}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      يمكنك استلام طلبك من الفرع يومياً خلال ساعات العمل الرسمية فور تأكيد الحوالة.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Other Governorates Options */}
            {region === "other" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between">
                  <div className="text-xs font-bold text-amber-900">رسوم شحن المحافظات التقديرية:</div>
                  <span className="rounded-full bg-amber-600 px-2.5 py-1 text-xs font-extrabold text-white">
                    {otherDeliveryFee}
                  </span>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-muted-foreground">اختر المحافظة</span>
                  <select
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring font-bold"
                  >
                    {governorates.map((g) => (
                      <option key={g} value={g}>
                        محافظة {g}
                      </option>
                    ))}
                  </select>
                </label>

                <textarea
                  value={form.notes}
                  onChange={set("notes")}
                  placeholder="اكتب العنوان بالتفصيل واسم شركة النقل المفضلة إن وجدت (مثلاً: البراق، راحة، الرويشان)"
                  className="min-h-20 w-full rounded-2xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </section>

          <section className="rounded-3xl border bg-card p-5">
            <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-primary">
              <CreditCard className="h-4 w-4 text-secondary" /> 3. الدفع بالتحويل البنكي
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              حوّل إجمالي المبلغ على أحد الحسابات أو المحافظ الرسمية التالية ثم عبّئ بيانات الحوالة.
            </p>

            {/* Amount to transfer banner */}
            <div className="mb-4 rounded-2xl bg-secondary/15 border border-secondary/30 p-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-secondary">المبلغ الإجمالي المطلوب تحويله:</div>
                <div className="text-lg font-black text-primary mt-0.5">
                  {currency === "YER" ? formatPrice(total) : `${totalSar} ريال سعودي`}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground bg-background/80 px-3 py-1.5 rounded-xl border font-bold">
                {currency === "YER" ? `ما يعادل: ${totalSar} ر.س` : `ما يعادل: ${formatPrice(total)}`}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {accounts.map((a, idx) => (
                <div
                  key={idx}
                  className="group relative flex flex-col justify-between rounded-2xl border bg-background p-4 transition-all hover:border-secondary hover:shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <BankLogo bankName={a.bank} logoType={a.logo_type} customLogoUrl={a.custom_logo_url} className="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-extrabold text-primary leading-tight">{a.bank}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.holder}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
                    <span className="font-mono text-sm font-black text-primary tracking-wider" dir="ltr">
                      {a.number}
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(a.number)}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-3 py-1 text-[11px] font-bold text-secondary hover:bg-secondary/25 transition-colors"
                    >
                      <Copy className="h-3 w-3" /> نسخ
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="رقم العملية / الحوالة *" value={form.txn} onChange={set("txn")} placeholder="مثال: 88123456" required />
              <Field label="اسم المودع / المحوّل" value={form.sender} onChange={set("sender")} placeholder="الاسم كما في الحوالة" />
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileRef.current?.click()}
              className="mt-4 grid cursor-pointer place-items-center rounded-2xl border border-dashed bg-background p-6 text-center hover:border-secondary transition-colors"
            >
              {receipt ? (
                <img src={receipt} alt="سند التحويل" className="max-h-48 rounded-xl object-contain" />
              ) : (
                <>
                  <Truck className="mb-2 h-6 w-6 text-secondary" />
                  <div className="text-sm font-bold">ارفع صورة السند أو إشعار التحويل</div>
                  <div className="text-xs text-muted-foreground">اسحب الصورة هنا أو اضغط للاختيار من جهازك</div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-3xl border bg-card p-5 lg:sticky lg:top-32">
          <h2 className="mb-4 text-base font-bold text-primary">ملخص الطلب</h2>
          <div className="space-y-3">
            {items.map((i) => (
              <div key={i.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {i.name} <span className="text-muted-foreground">({i.options ?? ""}) ×{i.qty}</span>
                </span>
                <span className="shrink-0 font-semibold">
                  {currency === "YER" ? formatPrice(i.price * i.qty) : `${(i.priceSar * i.qty).toLocaleString()} ريال سعودي`}
                </span>
              </div>
            ))}
          </div>

          {/* Shipping Summary Line */}
          <div className="mt-4 border-t pt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>خيار التوصيل:</span>
              <span className="font-bold text-primary">
                {region === "aden"
                  ? adenMethod === "home"
                    ? "توصيل للمنزل (عدن)"
                    : "استلام من الفرع"
                  : `شحن محافظة (${governorate})`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">رسوم التوصيل:</span>
              <span
                className={`font-bold ${
                  region === "aden" && adenMethod === "pickup" ? "text-emerald-600" : "text-amber-800"
                }`}
              >
                {region === "aden"
                  ? adenMethod === "home"
                    ? adenDeliveryFee
                    : "مجاناً (0 ر.ي)"
                  : otherDeliveryFee}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4 text-lg font-extrabold text-primary">
            <span>إجمالي المنتجات</span>
            <span>{currency === "YER" ? formatPrice(total) : `${totalSar} ريال سعودي`}</span>
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
            * رسوم التوصيل/الشحن تُدفع لمندوب التوصيل أو شركة النقل عند استلام الطلب.
          </p>

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-md disabled:opacity-60 hover:bg-primary/90"
          >
            {submitting ? "جارِ إرسال الطلب…" : "تأكيد وإرسال الطلب"}
          </motion.button>
        </aside>
      </form>
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        {...props}
        className="w-full rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
