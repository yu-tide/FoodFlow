"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Beef,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Crown,
  Download,
  Flame,
  Home,
  Info,
  Leaf,
  PieChart as PieChartIcon,
  Settings,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UploadCloud,
  User,
  Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiGet, ApiError } from "@/services/api";

type DayCalories = {
  day: string;
  calories: number;
};

type MacroTrend = {
  day: string;
  protein: number;
  carbs: number;
  fat: number;
};

type MealDistribution = {
  name: string;
  calories: number;
  color: string;
};

type WeeklyStats = {
  weekRange: string;
  targetCalories: number;
  avgDailyCalories: number;
  totalCalories: number;
  proteinTargetDays: number;
  highCarbDays: number;
  recordCount: number;
  averageMeals: number;
  todayGap: number;
  caloriesTrend: DayCalories[];
  macroTrend: MacroTrend[];
  mealDistribution: MealDistribution[];
  lastWeekComparison: {
    avgCaloriesDeltaPct: number;
    proteinDeltaPct: number;
    recordDeltaDays: number;
    avgCaloriesLastWeek: number;
    proteinLastWeek: number;
    recordDaysLastWeek: number;
  };
  aiSummary: string[];
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

const classNames = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

// 后端返回 snake_case → 前端 camelCase 适配
function adaptWeeklyStats(raw: Record<string, unknown>): WeeklyStats {
  const r = (key: string) => raw[key] ?? null;
  const num = (val: unknown, fallback = 0) => (typeof val === "number" ? val : fallback);
  const arr = <T extends unknown>(val: unknown): T[] => (Array.isArray(val) ? (val as T[]) : []);

  return {
    weekRange: String(r("week_range") ?? r("weekRange") ?? ""),
    targetCalories: num(r("target_calories") ?? r("targetCalories"), 2000),
    avgDailyCalories: num(r("avg_daily_calories") ?? r("avgDailyCalories")),
    totalCalories: num(r("total_calories") ?? r("totalCalories")),
    proteinTargetDays: num(r("protein_target_days") ?? r("proteinTargetDays")),
    highCarbDays: num(r("high_carb_days") ?? r("highCarbDays")),
    recordCount: num(r("record_count") ?? r("recordCount")),
    averageMeals: num(r("average_meals") ?? r("averageMeals")),
    todayGap: num(r("today_gap") ?? r("todayGap")),
    caloriesTrend: arr<DayCalories>(r("daily_calories") ?? r("caloriesTrend")).map(
      (d: Record<string, unknown>) => ({
        day: String(d.day ?? ""),
        calories: num(d.calories),
      })
    ),
    macroTrend: arr<MacroTrend>(r("macro_trend") ?? r("macroTrend")).map(
      (d: Record<string, unknown>) => ({
        day: String(d.day ?? ""),
        protein: num(d.protein),
        carbs: num(d.carbs),
        fat: num(d.fat),
      })
    ),
    mealDistribution: arr<MealDistribution>(r("meal_distribution") ?? r("mealDistribution")).map(
      (d: Record<string, unknown>) => ({
        name: String(d.name ?? ""),
        calories: num(d.calories),
        color: String(d.color ?? "#16A34A"),
      })
    ),
    lastWeekComparison: {
      avgCaloriesDeltaPct: num(
        (r("last_week_comparison") as Record<string, unknown> | null)?.avg_calories_delta_pct ??
        (r("lastWeekComparison") as Record<string, unknown> | null)?.avgCaloriesDeltaPct
      ),
      proteinDeltaPct: num(
        (r("last_week_comparison") as Record<string, unknown> | null)?.protein_delta_pct ??
        (r("lastWeekComparison") as Record<string, unknown> | null)?.proteinDeltaPct
      ),
      recordDeltaDays: num(
        (r("last_week_comparison") as Record<string, unknown> | null)?.record_delta_days ??
        (r("lastWeekComparison") as Record<string, unknown> | null)?.recordDeltaDays
      ),
      avgCaloriesLastWeek: num(
        (r("last_week_comparison") as Record<string, unknown> | null)?.avg_calories_last_week ??
        (r("lastWeekComparison") as Record<string, unknown> | null)?.avgCaloriesLastWeek
      ),
      proteinLastWeek: num(
        (r("last_week_comparison") as Record<string, unknown> | null)?.protein_last_week ??
        (r("lastWeekComparison") as Record<string, unknown> | null)?.proteinLastWeek
      ),
      recordDaysLastWeek: num(
        (r("last_week_comparison") as Record<string, unknown> | null)?.record_days_last_week ??
        (r("lastWeekComparison") as Record<string, unknown> | null)?.recordDaysLastWeek
      ),
    },
    aiSummary: arr<string>(r("ai_summary") ?? r("aiSummary") ?? r("summary_items")).map(String),
  };
}

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

export default function WeeklyStatisticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user] = useState(getUserProfile);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const raw = await apiGet<Record<string, unknown>>("/api/statistics/weekly");
        if (mounted) {
          setStats(adaptWeeklyStats(raw));
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          if (err instanceof ApiError) {
            if (err.status === 401) {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              router.push("/login");
              return;
            }
            setError(err.message);
          } else {
            setError("数据加载失败");
          }
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFDF9]">
        <p className="text-sm font-bold text-slate-500">加载中...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFDF9]">
        <div className="text-center">
          <Info className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-500">{error || "暂无数据"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFDF9] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar user={user} />

        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-[1220px]">
            <PageHeader
              todayGap={stats.todayGap}
              isLoading={isLoading}
            />

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={Flame}
                tone="green"
                title="平均每日热量"
                value={formatNumber(stats.avgDailyCalories)}
                suffix="kcal"
                description={`目标 ${formatNumber(stats.targetCalories)} kcal`}
              />
              <KpiCard
                icon={Beef}
                tone="emerald"
                title="蛋白质达标"
                value={`${stats.proteinTargetDays} / 7`}
                suffix="天"
                description={`达标率 ${Math.round(
                  (stats.proteinTargetDays / 7) * 100
                )}%`}
              />
              <KpiCard
                icon={Wheat}
                tone="orange"
                title="高碳水天数"
                value={stats.highCarbDays}
                suffix="天"
                description={`占比 ${Math.round(
                  (stats.highCarbDays / 7) * 100
                )}%`}
              />
              <KpiCard
                icon={ClipboardList}
                tone="purple"
                title="本周记录"
                value={stats.recordCount}
                suffix="餐"
                description={`平均每日 ${stats.averageMeals} 餐`}
              />
            </section>

            <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="xl:col-span-6">
                <CaloriesBarChartCard stats={stats} />
              </div>

              <div className="xl:col-span-6">
                <MacroTrendChartCard stats={stats} />
              </div>
            </section>

            <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="xl:col-span-4">
                <MealDistributionCard stats={stats} />
              </div>

              <div className="xl:col-span-3">
                <LastWeekComparisonCard stats={stats} />
              </div>

              <div className="xl:col-span-5">
                <AiWeeklySummaryCard stats={stats} />
              </div>
            </section>

            <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => downloadWeeklyReport(stats)}
                className="group flex h-14 items-center justify-center gap-3 rounded-2xl border border-green-200 bg-white text-sm font-semibold text-green-700 shadow-sm transition hover:border-green-300 hover:bg-green-50"
              >
                <Download className="h-5 w-5 transition group-hover:-translate-y-0.5" />
                导出周报
              </button>

              <Link
                href="/records"
                className="group flex h-14 items-center justify-center gap-3 rounded-2xl bg-green-600 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(22,163,74,0.25)] transition hover:bg-green-700"
              >
                <ClipboardList className="h-5 w-5 transition group-hover:-translate-y-0.5" />
                查看全部记录
              </Link>
            </section>
          </div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}

function PageHeader({
  todayGap,
  isLoading,
}: {
  todayGap: number;
  isLoading: boolean;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">
          每周统计
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          查看你本周的热量趋势、宏量营养变化与 AI 周复盘。
        </p>

        {isLoading && (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              数据同步中...
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-start gap-2 lg:items-end">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            状态良好
          </span>

          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-slate-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-base font-bold text-white shadow-[0_12px_24px_rgba(22,163,74,0.24)]">
              A
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <p className="text-sm font-semibold text-slate-500">
          你今天还差{" "}
          <span className="font-black text-slate-700">{todayGap}</span> kcal 达标
        </p>
      </div>
    </header>
  );
}

function Sidebar({ user }: { user: { nickname: string; phone: string; avatarText: string } }) {
  const items: Array<{
    label: string;
    href: string;
    icon: LucideIcon;
    active?: boolean;
  }> = [
    { label: "首页", href: "/dashboard", icon: Home },
    { label: "上传", href: "/upload", icon: UploadCloud },
    { label: "记录", href: "/records", icon: ClipboardList },
    {
      label: "每周统计",
      href: "/statistics/weekly",
      icon: BarChart3,
      active: true,
    },
    { label: "设置", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="sticky top-0 hidden h-screen w-[276px] shrink-0 flex-col border-r border-slate-100 bg-white px-5 py-7 lg:flex">
      <Link href="/dashboard" className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-600">
          <Leaf className="h-7 w-7" />
        </span>
        <span className="text-2xl font-black tracking-tight text-green-600">
          FoodFlow
        </span>
      </Link>

      <nav className="space-y-2">
        {items.map((item) => (
          <SidebarItem key={item.href} {...item} />
        ))}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-3xl border border-green-100 bg-gradient-to-br from-green-50 via-white to-green-50 p-4 shadow-sm">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-green-100 text-green-700">
            <Crown className="h-5 w-5" />
          </div>
          <h3 className="text-base font-black text-green-700">升级专业版</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            解锁更强的 AI 洞察与个性化目标。
          </p>
          <button
            type="button"
            className="mt-4 h-10 w-full rounded-xl border border-green-300 bg-white text-sm font-bold text-green-700 transition hover:bg-green-50"
          >
            立即升级
          </button>
        </div>

        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-3xl border border-slate-100 bg-white p-3 text-left shadow-sm transition hover:bg-slate-50"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 text-base font-bold text-white">
            {user.avatarText || user.nickname?.[0] || ""}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black text-slate-800">
              {user.nickname || ""}
            </span>
            <span className="block truncate text-xs font-medium text-slate-400">
              {user.phone || ""}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({
  label,
  href,
  icon: Icon,
  active,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={classNames(
        "flex h-13 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition",
        active
          ? "bg-green-50 text-green-700 shadow-sm"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

function KpiCard({
  icon: Icon,
  tone,
  title,
  value,
  suffix,
  description,
}: {
  icon: LucideIcon;
  tone: "green" | "emerald" | "orange" | "purple";
  title: string;
  value: string | number;
  suffix: string;
  description: string;
}) {
  const toneClass = {
    green: "bg-green-50 text-green-600",
    emerald: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-500",
    purple: "bg-violet-50 text-violet-600",
  }[tone];

  return (
    <article className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.045)]">
      <div className="flex items-center gap-4">
        <div
          className={classNames(
            "flex h-12 w-12 items-center justify-center rounded-full",
            toneClass
          )}
        >
          <Icon className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-black text-slate-700">{title}</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-2xl font-black tracking-tight text-slate-950">
              {value}
            </span>
            <span className="pb-1 text-sm font-bold text-slate-600">
              {suffix}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}

function ChartCard({
  title,
  icon: Icon,
  children,
  right,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <article className="h-full rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.045)]">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-green-600" />}
          <h2 className="text-lg font-black text-slate-900">{title}</h2>
          <Info className="h-4 w-4 text-slate-300" />
        </div>
        {right}
      </div>
      {children}
    </article>
  );
}

function CaloriesBarChartCard({ stats }: { stats: WeeklyStats }) {
  return (
    <ChartCard title="每日热量趋势" icon={BarChart3}>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={stats.caloriesTrend}
            margin={{ top: 20, right: 26, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#EEF2F7" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }}
              width={42}
            />
            <Tooltip
              cursor={{ fill: "rgba(22, 163, 74, 0.08)" }}
              content={<ChartTooltip unit="kcal" />}
            />
            <ReferenceLine
              y={stats.targetCalories}
              stroke="#94A3B8"
              strokeDasharray="4 4"
              label={{
                value: `目标 ${formatNumber(stats.targetCalories)}`,
                position: "right",
                fill: "#475569",
                fontSize: 12,
                fontWeight: 700,
              }}
            />
            <Bar dataKey="calories" name="热量" barSize={28} radius={[12, 12, 0, 0]}>
              {stats.caloriesTrend.map((item) => (
                <Cell
                  key={item.day}
                  fill={
                    item.calories > stats.targetCalories ? "#22C55E" : "#16A34A"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function MacroTrendChartCard({ stats }: { stats: WeeklyStats }) {
  return (
    <ChartCard
      title="宏量营养趋势"
      icon={Activity}
      right={
        <div className="hidden items-center gap-4 text-xs font-bold text-slate-500 sm:flex">
          <LegendDot color="#16A34A" label="蛋白质 (g)" />
          <LegendDot color="#F97316" label="碳水 (g)" />
          <LegendDot color="#6D5DF6" label="脂肪 (g)" />
        </div>
      }
    >
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={stats.macroTrend}
            margin={{ top: 14, right: 22, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#EEF2F7" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748B", fontSize: 12, fontWeight: 600 }}
              width={42}
            />
            <Tooltip content={<ChartTooltip unit="g" />} />
            <Line
              type="monotone"
              dataKey="protein"
              name="蛋白质"
              stroke="#16A34A"
              strokeWidth={2.6}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="carbs"
              name="碳水"
              stroke="#F97316"
              strokeWidth={2.6}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="fat"
              name="脂肪"
              stroke="#6D5DF6"
              strokeWidth={2.6}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function MealDistributionCard({ stats }: { stats: WeeklyStats }) {
  const total = useMemo(
    () => stats.mealDistribution.reduce((sum, item) => sum + item.calories, 0),
    [stats.mealDistribution]
  );

  return (
    <ChartCard title="餐别热量分布" icon={PieChartIcon}>
      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[170px_1fr] xl:grid-cols-1 2xl:grid-cols-[170px_1fr]">
        <div className="relative h-[170px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.mealDistribution}
                dataKey="calories"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={1}
                stroke="none"
              >
                {stats.mealDistribution.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-xl font-black text-slate-950">
                {formatNumber(total)}
              </div>
              <div className="mt-0.5 text-xs font-bold text-slate-500">kcal</div>
              <div className="text-xs font-semibold text-slate-400">总摄入</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {stats.mealDistribution.map((item) => {
            const percent = total ? ((item.calories / total) * 100).toFixed(1) : "0";
            return (
              <div key={item.name} className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-slate-700">
                    {item.name}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-500">
                    {formatNumber(item.calories)} kcal{" "}
                    <span className="text-slate-400">({percent}%)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartCard>
  );
}

function LastWeekComparisonCard({ stats }: { stats: WeeklyStats }) {
  const items = [
    {
      label: "平均热量",
      value: `${stats.lastWeekComparison.avgCaloriesDeltaPct}%`,
      description: `较上周 ${formatNumber(
        stats.lastWeekComparison.avgCaloriesLastWeek
      )} kcal`,
      icon: TrendingDown,
      positive: stats.lastWeekComparison.avgCaloriesDeltaPct < 0,
    },
    {
      label: "蛋白质",
      value: `+${stats.lastWeekComparison.proteinDeltaPct}%`,
      description: `较上周 ${stats.lastWeekComparison.proteinLastWeek} g`,
      icon: Beef,
      positive: true,
    },
    {
      label: "记录频率",
      value: `+${stats.lastWeekComparison.recordDeltaDays} 天`,
      description: `较上周 ${stats.lastWeekComparison.recordDaysLastWeek} 天`,
      icon: TrendingUp,
      positive: true,
    },
  ];

  return (
    <ChartCard title="与上周相比" icon={Activity}>
      <div className="space-y-1">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={classNames(
              "flex items-center gap-3 py-4",
              index !== items.length - 1 && "border-b border-slate-100"
            )}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
              <item.icon className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-700">
                {item.label}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-400">
                {item.description}
              </div>
            </div>

            <div
              className={classNames(
                "text-lg font-black",
                item.positive ? "text-green-600" : "text-orange-500"
              )}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function AiWeeklySummaryCard({ stats }: { stats: WeeklyStats }) {
  const iconStyles = [
    "bg-green-50 text-green-600",
    "bg-emerald-50 text-emerald-600",
    "bg-orange-50 text-orange-500",
    "bg-violet-50 text-violet-600",
  ];

  return (
    <ChartCard
      title="AI 周总结"
      icon={Sparkles}
      right={
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-600">
          AI Insight
        </span>
      }
    >
      <div className="space-y-4">
        {stats.aiSummary.map((item, index) => (
          <div key={item} className="flex items-start gap-3">
            <div
              className={classNames(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                iconStyles[index % iconStyles.length]
              )}
            >
              {index === 0 && <CheckCircle2 className="h-5 w-5" />}
              {index === 1 && <Beef className="h-5 w-5" />}
              {index === 2 && <Wheat className="h-5 w-5" />}
              {index === 3 && <Sparkles className="h-5 w-5" />}
            </div>

            <p className="text-sm font-semibold leading-7 text-slate-600">
              {item}
            </p>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_16px_36px_rgba(15,23,42,0.12)]">
      <div className="mb-2 text-sm font-black text-slate-700">{label}</div>
      <div className="space-y-1">
        {payload.map((item) => (
          <div
            key={item.name}
            className="flex min-w-[128px] items-center justify-between gap-4 text-sm"
          >
            <span className="flex items-center gap-2 font-semibold text-slate-500">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </span>
            <span className="font-black text-slate-900">
              {formatNumber(Number(item.value))} {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileTabBar() {
  const tabs: Array<{
    label: string;
    href: string;
    icon: LucideIcon;
    active?: boolean;
  }> = [
    { label: "首页", href: "/dashboard", icon: Home },
    { label: "上传", href: "/upload", icon: UploadCloud },
    { label: "记录", href: "/records", icon: ClipboardList },
    { label: "统计", href: "/statistics/weekly", icon: BarChart3, active: true },
    { label: "我的", href: "/settings", icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 px-2 pb-3 pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={classNames(
              "flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-xs font-bold transition",
              tab.active ? "text-green-600" : "text-slate-400"
            )}
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function downloadWeeklyReport(stats: WeeklyStats) {
  const rows = [
    ["day", "calories", "protein", "carbs", "fat"],
    ...stats.caloriesTrend.map((dayItem) => {
      const macro = stats.macroTrend.find((item) => item.day === dayItem.day);

      return [
        dayItem.day,
        String(dayItem.calories),
        String(macro?.protein ?? ""),
        String(macro?.carbs ?? ""),
        String(macro?.fat ?? ""),
      ];
    }),
  ];

  const csv = `\uFEFF${rows.map((row) => row.join(",")).join("\n")}`;
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "foodflow-weekly-report.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}