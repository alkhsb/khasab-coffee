import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

import logo from "@/assets/khasab-logo.jpg.asset.json";
import server from "@/assets/p025001.jpg.asset.json";
import tools from "@/assets/p025009.jpg.asset.json";
import filters from "@/assets/p025020.jpg.asset.json";
import drippers from "@/assets/p025028.jpg.asset.json";
import kit from "@/assets/p025037.jpg.asset.json";
import vacuum from "@/assets/p025045.jpg.asset.json";
import beans from "@/assets/p025101.jpg.asset.json";

export const brandLogo = logo.url;
export const toolsBanner = tools.url;
export const brandName = "محمصة خصب";

export const heroBanners = [
  { image: beans.url, title: "محاصيل بن مختصة", desc: "محاصيل محمّصة طازجة أسبوعياً من أجود المزارع العالمية" },
  { image: kit.url, title: "طقم تقطير القهوة 2in1", desc: "قمع + سيرفر لتجربة تقطير مثالية باحترافية" },
  { image: tools.url, title: "مو بس محصولك.. عدّتك علينا", desc: "جميع أدوات ومستلزمات الباريستا في مكان واحد" },
  { image: drippers.url, title: "أقماع تقطير زجاجية", desc: "تصميم مضلع احترافي بمقاسات 01 و 02" },
];

export type CategoryId = "coffee" | "tools" | "matcha" | "green";

export const categories: { id: CategoryId; name: string; desc: string; image: string }[] = [
  { id: "coffee", name: "محاصيل القهوة المختصة", desc: "محاصيل مختارة محمّصة طازجة أسبوعياً", image: beans.url },
  { id: "tools", name: "أدوات وإكسسوارات الباريستا", desc: "أقماع وسيرفرات وفلاتر وأدوات احترافية", image: tools.url },
  { id: "matcha", name: "ماتشا", desc: "قريباً — أجود أنواع الماتشا الفاخرة", image: kit.url },
  { id: "green", name: "محاصيل البن الخضراء", desc: "قريباً — محاصيل البن الأخضر الخام", image: filters.url },
];

export type Variant = { label: string; yer: number; sar: number };

export type Product = {
  id?: string;
  slug: string;
  name: string;
  category: CategoryId;
  variants: Variant[];
  image: string;
  images?: string[];
  short: string;
  description: string;
  stockQuantity?: number;
  lowStockThreshold?: number;
  costPriceYer?: number;
  costPriceSar?: number;
  isActive?: boolean;
  isCoffee?: boolean;
  origin?: string;
  altitude?: string;
  process?: string;
  notes?: string[];
  specs?: { label: string; value: string }[];
  badge?: string;
  bestSeller?: boolean;
};

export const products: Product[] = [
  {
    slug: "colombia-pantera",
    name: "كولمبيا بانتيرا",
    category: "coffee",
    variants: [
      { label: "100g", yer: 9000, sar: 22 },
      { label: "200g", yer: 16000, sar: 39 },
    ],
    image: beans.url,
    images: [beans.url],
    short: "شوكولاتة وسكر بني وحمضيات | معالجة مغسولة",
    description: "محصول كولمبي استثنائي بمعالجة مغسولة، متوازن وسهل التحضير بجميع طرق التقطير والإسبريسو.",
    stockQuantity: 45,
    lowStockThreshold: 5,
    costPriceYer: 5500,
    costPriceSar: 13,
    isActive: true,
    isCoffee: true,
    origin: "كولومبيا",
    process: "مغسولة",
    notes: ["شوكولاتة", "سكر بني", "حمضيات"],
    bestSeller: true,
  },
  {
    slug: "ethiopia-nancebo",
    name: "إثيوبيا نانسيبو",
    category: "coffee",
    variants: [
      { label: "100g", yer: 9000, sar: 22 },
      { label: "200g", yer: 16000, sar: 39 },
    ],
    image: beans.url,
    images: [beans.url],
    short: "تفاح أخضر وبابايا وعسل | معالجة مجففة",
    description: "محصول إثيوبي فاخر بمعالجة مجففة يمنح حلاوة عالية ونكهات فواكه واضحة وقواماً حريرياً.",
    stockQuantity: 30,
    lowStockThreshold: 5,
    costPriceYer: 5500,
    costPriceSar: 13,
    isActive: true,
    isCoffee: true,
    origin: "إثيوبيا",
    process: "مجففة",
    notes: ["تفاح أخضر", "بابايا", "عسل"],
    bestSeller: true,
  },
  {
    slug: "uganda-ruwenzori",
    name: "أوغندا روينزوري",
    category: "coffee",
    variants: [
      { label: "100g", yer: 9000, sar: 22 },
      { label: "200g", yer: 16000, sar: 39 },
    ],
    image: beans.url,
    images: [beans.url],
    short: "فواكه مجففة وكراميل وشوكولاتة داكنة",
    description: "محصول أوغندي غني بقوام كثيف وإيحاءات عميقة، مثالي لمشروبات الإسبريسو والحليب والترشيح.",
    stockQuantity: 4,
    lowStockThreshold: 5,
    costPriceYer: 5500,
    costPriceSar: 13,
    isActive: true,
    isCoffee: true,
    origin: "أوغندا",
    process: "مجففة",
    notes: ["فواكه مجففة", "كراميل", "شوكولاتة داكنة"],
    bestSeller: true,
  },
  {
    slug: "yemeni-haif",
    name: "يمني هيف",
    category: "coffee",
    variants: [{ label: "100g", yer: 13000, sar: 31 }],
    image: beans.url,
    images: [beans.url],
    short: "كرز وزهور وحلاوة عالية",
    description: "محصول يمني استثنائي أصيل من مرتفعات هيف، حلاوة عميقة وبقاء طويل للنكهة في الفم.",
    stockQuantity: 18,
    lowStockThreshold: 5,
    costPriceYer: 8000,
    costPriceSar: 19,
    isActive: true,
    isCoffee: true,
    origin: "اليمن",
    process: "مجففة",
    notes: ["كرز", "زهور", "حلو"],
    badge: "الأكثر طلباً",
    bestSeller: true,
  },
  {
    slug: "hand-vacuum",
    name: "مكنسة الشفط اليدوية",
    category: "tools",
    variants: [{ label: "قطعة", yer: 7000, sar: 17 }],
    image: vacuum.url,
    images: [vacuum.url],
    short: "لتنظيف بقايا البن والغبار على طاولة الباريستا",
    description: "مكنسة شفط يدوية عملية وسريعة لإزالة بقايا البن والغبار والمحافظة على نظافة ركن القهوة.",
    stockQuantity: 25,
    lowStockThreshold: 5,
    costPriceYer: 3800,
    costPriceSar: 9,
    isActive: true,
    bestSeller: true,
  },
  {
    slug: "v60-dripper",
    name: "أقماع تقطير القهوة",
    category: "tools",
    variants: [
      { label: "مقاس 01", yer: 5700, sar: 14 },
      { label: "مقاس 02", yer: 7000, sar: 17 },
    ],
    image: drippers.url,
    images: [drippers.url],
    short: "قمع زجاجي احترافي بتصميم مضلع",
    description: "أقماع تقطير بتصميم مضلع متناسق يمنح انسياب ماء مثالي، متوفرة بمقاسي 01 و 02.",
    stockQuantity: 0,
    lowStockThreshold: 5,
    costPriceYer: 3200,
    costPriceSar: 8,
    isActive: true,
    specs: [{ label: "المقاسات المتاحة", value: "مقاس 01 / مقاس 02" }],
  },
  {
    slug: "double-mixer-server",
    name: "سيرفر بخلاط مزدوج",
    category: "tools",
    variants: [{ label: "قطعة", yer: 8500, sar: 21 }],
    image: server.url,
    images: [server.url],
    short: "سيرفر زجاجي بخلاط مزدوج",
    description: "سيرفر زجاجي عالي الجودة ومقاوم للحرارة مزود بخلاط مزدوج لضمان تجانس القهوة.",
    stockQuantity: 15,
    lowStockThreshold: 5,
    costPriceYer: 4500,
    costPriceSar: 11,
    isActive: true,
  },
  {
    slug: "paper-filters",
    name: "فلاتر الترشيح",
    category: "tools",
    variants: [{ label: "40 حبة", yer: 4500, sar: 11 }],
    image: filters.url,
    images: [filters.url],
    short: "عبوة 40 حبة ورق عالي النقاء",
    description: "فلاتر ترشيح ورقية فائقة النقاء لا تؤثر على طعم القهوة، عبوة 40 حبة.",
    stockQuantity: 60,
    lowStockThreshold: 10,
    costPriceYer: 2200,
    costPriceSar: 5,
    isActive: true,
  },
  {
    slug: "drip-server",
    name: "سيرفر تقطير القهوة",
    category: "tools",
    variants: [
      { label: "مقاس 01", yer: 6000, sar: 15 },
      { label: "مقاس 02", yer: 7000, sar: 17 },
    ],
    image: server.url,
    images: [server.url],
    short: "زجاج بوروسيليكات مقاوم للحرارة",
    description: "سيرفر تقطير أنيق بتدرج قياس واضح، متوفر بمقاسي 01 و 02.",
    stockQuantity: 20,
    lowStockThreshold: 5,
    costPriceYer: 3500,
    costPriceSar: 8,
    isActive: true,
    specs: [{ label: "المقاسات المتاحة", value: "مقاس 01 / مقاس 02" }],
  },
  {
    slug: "pourover-kit-2in1",
    name: "طقم تقطير القهوة",
    category: "tools",
    variants: [{ label: "قمع 01 + سيرفر 02", yer: 12000, sar: 29 }],
    image: kit.url,
    images: [kit.url],
    short: "قمع 01 + سيرفر 02",
    description: "طقم تقطير متكامل يجمع القمع والسيرفر، جاهز لتحضير كوب القهوة المثالي.",
    stockQuantity: 12,
    lowStockThreshold: 5,
    costPriceYer: 6500,
    costPriceSar: 15,
    isActive: true,
    badge: "طقم متكامل",
    bestSeller: true,
  },
];

export const mapDbProduct = (row: any): Product => {
  let variants = row.variants;
  if (typeof variants === "string") {
    try {
      variants = JSON.parse(variants);
    } catch {
      variants = [];
    }
  }
  const safeVariants = Array.isArray(variants) && variants.length > 0 ? variants : [{ label: "قطعة", yer: 9000, sar: 22 }];

  let images = row.images;
  if (typeof images === "string") {
    try {
      images = JSON.parse(images);
    } catch {
      images = [];
    }
  }
  const safeImages = Array.isArray(images) && images.length > 0 ? images : [row.image || beans.url];

  return {
    id: row.id,
    slug: row.slug || "product-" + Math.random().toString(36).slice(2, 7),
    name: row.name || "محصول قهوة",
    category: (row.category as CategoryId) || "coffee",
    variants: safeVariants,
    image: row.image || safeImages[0] || beans.url,
    images: safeImages,
    short: row.short || "",
    description: row.description || "",
    stockQuantity: row.stock_quantity ?? 50,
    lowStockThreshold: row.low_stock_threshold ?? 5,
    costPriceYer: row.cost_price_yer ?? 0,
    costPriceSar: row.cost_price_sar ?? 0,
    isActive: row.is_active ?? true,
    isCoffee: row.is_coffee ?? (row.category === "coffee"),
    origin: row.origin,
    process: row.process,
    notes: Array.isArray(row.notes) ? row.notes : [],
    specs: Array.isArray(row.specs) ? row.specs : [],
    badge: row.badge,
    bestSeller: row.best_seller ?? false,
  };
};

// Cost prices are NOT readable through the public API (column privileges); admins fetch them via RPC.
const PUBLIC_PRODUCT_COLUMNS =
  "id,slug,name,category,short,description,variants,image,images,stock_quantity,low_stock_threshold,is_active,is_coffee,origin,process,notes,specs,badge,best_seller,created_at";

export const fetchAdminProductsFromSupabase = async (): Promise<Product[]> => {
  const list = await fetchProductsFromSupabase();
  try {
    const { data } = await (supabase as any).rpc("admin_product_costs");
    const costs = new Map((data ?? []).map((c: any) => [c.slug, c]));
    return list.map((p) => {
      const c: any = costs.get(p.slug);
      return c ? { ...p, costPriceYer: Number(c.cost_price_yer) || 0, costPriceSar: Number(c.cost_price_sar) || 0 } : p;
    });
  } catch {
    return list;
  }
};

export const fetchProductsFromSupabase = async (): Promise<Product[]> => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select(PUBLIC_PRODUCT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Fetch products error from Supabase:", error);
      return [];
    }
    if (!data) return [];
    return data.map(mapDbProduct);
  } catch (err) {
    console.error("Error in fetchProductsFromSupabase:", err);
    return [];
  }
};

export function useLiveProducts() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await fetchProductsFromSupabase();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const chId = `live-products-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(chId)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { products: items, loading, reload: load };
}

export const grindOptions = ["حبوب كاملة", "إسبريسو", "V60", "فرنش بريس"];

export const findProduct = (slug: string) => products.find((p) => p.slug === slug);

export const searchProducts = (q: string, list: Product[] = products) => {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return list
    .filter((p) => p.name.toLowerCase().includes(s) || p.short.toLowerCase().includes(s) || p.description.toLowerCase().includes(s))
    .slice(0, 6);
};

export const formatPrice = (v: number) =>
  new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 }).format(Math.round(v)) + " ريال";
