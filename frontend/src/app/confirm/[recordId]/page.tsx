"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Home,
  Info,
  Leaf,
  Loader2,
  Save,
  Settings,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { apiGet, ApiError } from "@/services/api";
import { formatFoodItemLabels } from "@/lib/foodLabels";
import { getFoodRecord, type AnalyzeResult, type FoodItem } from "@/services/foods";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function resolveImg(src: string) {
  if (!src) return "";
  if (src.startsWith("http")) return src;
  if (src.startsWith("/") && API_BASE) return `${API_BASE}${src}`;
  return src;
}

export default function ConfirmPage() {
  const router = useRouter();
  const params = useParams();
  const recordId = useMemo(() => {
    const v = params?.recordId;
    return Array.isArray(v) ? v[0] : String(v ?? "");
  }, [params]);

  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasEstimate = items.some((it) => it.estimated || it.source !== "ocr");

  const load = useCallback(async () => {
    if (!recordId) return;
    try {
      const data = await getFoodRecord(recordId);
      setResult(data);
      setItems(data.foodItems.map((item) => ({ ...item })));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem("token"); localStorage.removeItem("user");
        router.push("/login"); return;
      }
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, [recordId, router]);

  useEffect(() => { load(); }, [load]);

  const updateItem = (index: number, field: keyof FoodItem, value: string | number) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/foods/${recordId}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ items: items.map((it) => ({
          id: it.id, food_name: it.name, weight: it.weight, category: it.category,
          calories: it.calories, protein: it.protein, carbs: it.carbs, fat: it.fat,
        })) }),
      });
      if (res.status === 401) {
        localStorage.removeItem("token"); localStorage.removeItem("user");
        router.push("/login"); return;
      }
      if (!res.ok) throw new Error("保存失败");
      router.push(`/records/${recordId}`);
    } catch {
      setError("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>;
  }
  if (error && !result) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-slate-500 font-semibold">{error}</p></div>;
  }

  return (
    <div className="min-h-screen bg-[#FBFDF9] text-slate-950">
      <div className="mx-auto max-w-[800px] px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/records/${recordId}`} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-green-700">
            <ArrowLeft className="h-4 w-4" />返回详情
          </Link>
          <h1 className="text-xl font-black">确认识别结果</h1>
          <div className="w-16" />
        </div>

        {hasEstimate && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            该结果为系统估算，请确认后保存。
          </div>
        )}

        {result?.imageUrl && (
          <div className="mb-6 overflow-hidden rounded-2xl">
            <img src={resolveImg(result.imageUrl)} alt="food" className="max-h-[260px] w-full object-cover" />
          </div>
        )}

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.id || index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">{formatFoodItemLabels(item)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="食物名称" value={item.name} onChange={(v) => updateItem(index, "name", v)} />
                <Field label="份量" value={item.weight} onChange={(v) => updateItem(index, "weight", v)} />
                <Field label="热量 (kcal)" value={String(item.calories)} type="number" onChange={(v) => updateItem(index, "calories", Number(v))} />
                <Field label="蛋白质 (g)" value={String(item.protein)} type="number" onChange={(v) => updateItem(index, "protein", Number(v))} />
                <Field label="碳水 (g)" value={String(item.carbs)} type="number" onChange={(v) => updateItem(index, "carbs", Number(v))} />
                <Field label="脂肪 (g)" value={String(item.fat)} type="number" onChange={(v) => updateItem(index, "fat", Number(v))} />
              </div>
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-sm font-bold text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 flex h-[52px] w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-b from-green-500 to-green-700 text-base font-black text-white shadow-lg shadow-green-600/20 transition hover:shadow-xl disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? "保存中..." : "确认并保存"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, type = "text", onChange }: { label: string; value: string; type?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10"
      />
    </div>
  );
}
