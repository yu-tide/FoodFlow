"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3, CheckCircle2, ChevronDown, ClipboardList,
  Home, Leaf, Loader2, LogOut, Save, Settings, UploadCloud,
} from "lucide-react";
import { ApiError } from "@/services/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type UserSettings = {
  target_calories: number;
  target_protein: number | null;
  target_carbs: number | null;
  target_fat: number | null;
  goal_type: string;
};

function getUserProfile() {
  if (typeof window === "undefined") return { nickname: "", phone: "", avatarText: "" };
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      return { nickname: u.nickname || "", phone: u.phone || "", avatarText: u.avatarText || u.nickname?.[0] || "" };
    }
  } catch { /* ignore */ }
  return { nickname: "", phone: "", avatarText: "" };
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(getUserProfile);
  const [settings, setSettings] = useState<UserSettings>({ target_calories: 2000, target_protein: null, target_carbs: null, target_fat: null, goal_type: "maintain" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/users/me/settings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("user"); router.push("/login"); return; }
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem("token"); localStorage.removeItem("user"); router.push("/login"); return;
      }
      setError("加载设置失败");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/login"); return; }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/users/me/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(settings),
      });
      if (res.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("user"); router.push("/login"); return; }
      if (!res.ok) throw new Error("保存失败");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setError("保存失败，请重试"); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#FBFDF9] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar user={user} />
        <main className="min-w-0 flex-1 px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-[640px]">
            <h1 className="text-3xl font-black tracking-tight text-slate-950">设置</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">配置你的每日营养目标。</p>

            {loading ? (
              <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>
            ) : (
              <div className="mt-6 space-y-5">
                <Field label="每日目标热量 (kcal)" value={settings.target_calories} onChange={(v) => setSettings({ ...settings, target_calories: Number(v) || 0 })} type="number" />
                <Field label="蛋白质目标 (g)" value={settings.target_protein ?? ""} onChange={(v) => setSettings({ ...settings, target_protein: v ? Number(v) : null })} type="number" />
                <Field label="碳水目标 (g)" value={settings.target_carbs ?? ""} onChange={(v) => setSettings({ ...settings, target_carbs: v ? Number(v) : null })} type="number" />
                <Field label="脂肪目标 (g)" value={settings.target_fat ?? ""} onChange={(v) => setSettings({ ...settings, target_fat: v ? Number(v) : null })} type="number" />

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">目标类型</label>
                  <div className="flex gap-3">
                    {[{ v: "maintain", l: "维持体重" }, { v: "lose", l: "减脂" }, { v: "gain", l: "增肌" }].map((opt) => (
                      <button key={opt.v} onClick={() => setSettings({ ...settings, goal_type: opt.v })}
                        className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black transition ${
                          settings.goal_type === opt.v ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-500 hover:border-green-200"
                        }`}
                      >{opt.l}</button>
                    ))}
                  </div>
                </div>

                {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}
                {saved && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700">设置已保存</p>}

                <button onClick={handleSave} disabled={saving}
                  className="flex h-[52px] w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-b from-green-500 to-green-700 text-base font-black text-white shadow-lg shadow-green-600/20 transition hover:shadow-xl disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  {saving ? "保存中..." : "保存设置"}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-[52px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10"
      />
    </div>
  );
}

function Sidebar({ user }: { user: { nickname: string; phone: string; avatarText: string } }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const navItems = [
    { l: "首页", h: "/dashboard", i: <Home className="h-5 w-5" /> },
    { l: "上传", h: "/upload", i: <UploadCloud className="h-5 w-5" /> },
    { l: "记录", h: "/records", i: <ClipboardList className="h-5 w-5" /> },
    { l: "每周统计", h: "/statistics/weekly", i: <BarChart3 className="h-5 w-5" /> },
    { l: "设置", h: "/settings", i: <Settings className="h-5 w-5" />, active: true },
  ];

  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-slate-100 bg-white px-5 py-7 lg:flex">
      <Link href="/dashboard" className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-600"><Leaf className="h-7 w-7" /></span>
        <span className="text-2xl font-black tracking-tight text-green-600">FoodFlow</span>
      </Link>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <Link key={item.h} href={item.h}
            className={`flex h-12 items-center gap-3 rounded-2xl px-4 text-sm font-bold transition ${
              (item as any).active ? "bg-green-50 text-green-700 shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >{item.i}{item.l}</Link>
        ))}
      </nav>
      <div className="mt-auto">
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="flex w-full items-center gap-3 rounded-3xl border border-slate-100 bg-white p-3 text-left shadow-sm transition hover:bg-slate-50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-base font-bold text-white">{user.avatarText || ""}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{user.nickname || "用户"}</span></span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
        {menuOpen && (
          <div className="mt-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-lg">
            <button onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-50"
            ><LogOut className="h-4 w-4" />退出登录</button>
          </div>
        )}
      </div>
    </aside>
  );
}
