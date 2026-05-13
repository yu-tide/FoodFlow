'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CloudUpload,
  Code2,
  Crown,
  Download,
  Droplet,
  Home,
  ImageIcon,
  Leaf,
  Loader2,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Wheat,
} from 'lucide-react'
import { ApiError } from '@/services/api'
import { getFoodRecord, type AnalyzeResult, type FoodItem, type MacroInfo } from '@/services/foods'

type MacroKey = 'protein' | 'carbs' | 'fat'

type UserProfile = {
  nickname: string
  phone: string
  avatarText: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

function getUserProfile(): UserProfile {
  if (typeof window === 'undefined') return { nickname: '', phone: '', avatarText: '' }
  try {
    const raw = localStorage.getItem('user')
    if (raw) {
      const u = JSON.parse(raw)
      return {
        nickname: u.nickname || '',
        phone: u.phone || '',
        avatarText: u.avatarText || u.nickname?.[0] || '',
      }
    }
  } catch { /* ignore */ }
  return { nickname: '', phone: '', avatarText: '' }
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatDate(value?: string) {
  if (!value) return '今天'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '今天'
  return date.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
  })
}

const macroToneMap: Record<
  MacroKey,
  {
    icon: React.ReactNode
    iconClassName: string
    barClassName: string
    textClassName: string
  }
> = {
  protein: {
    icon: <Target className="h-5 w-5" />,
    iconClassName: 'bg-green-50 text-green-600',
    barClassName: 'bg-green-500',
    textClassName: 'text-green-600',
  },
  carbs: {
    icon: <Wheat className="h-5 w-5" />,
    iconClassName: 'bg-orange-50 text-orange-500',
    barClassName: 'bg-orange-400',
    textClassName: 'text-orange-500',
  },
  fat: {
    icon: <Droplet className="h-5 w-5" />,
    iconClassName: 'bg-violet-50 text-violet-600',
    barClassName: 'bg-violet-600',
    textClassName: 'text-violet-600',
  },
}

export default function RecordDetailPage() {
  const router = useRouter()
  const params = useParams()

  const recordId = useMemo(() => {
    const value = params?.id
    return Array.isArray(value) ? value[0] : String(value ?? '')
  }, [params])

  const [user] = useState<UserProfile>(getUserProfile)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadRecord = useCallback(async () => {
    if (!recordId) return
    setLoading(true)
    setErrorMessage('')
    try {
      const data = await getFoodRecord(recordId)
      setResult(data)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          router.push('/login')
          return
        }
        if (err.status === 404) {
          setErrorMessage('记录不存在或无权限访问')
          setLoading(false)
          return
        }
      }
      setErrorMessage('结果加载失败')
    } finally {
      setLoading(false)
    }
  }, [recordId, router])

  useEffect(() => {
    loadRecord()
  }, [loadRecord])

  function handleSaveRecord() {
    router.push('/records')
  }

  function handleReAnalyze() {
    router.push('/upload')
  }

  function handleExport() {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `foodflow-record-${result.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Render loading / error states
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-green-600" />
        </div>
      )
    }
    if (!result) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[16px] font-semibold text-slate-500">{errorMessage || '数据加载失败'}</p>
        </div>
      )
    }
    return (
      <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden">
          <div className="grid shrink-0 gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
            <CalorieResultCard result={result} />
            <MacroResultCard macros={result.macros} />
          </div>
          <FoodItemsCard items={result.foodItems} />
          <ActionBar onSave={handleSaveRecord} onReAnalyze={handleReAnalyze} onExport={handleExport} />
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <MealImageCard imageUrl={result.imageUrl} />
          <AiSummaryCard summary={result.aiSummary} />
          <TechDetailsCard technical={result.technical} />
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen grid-cols-1 lg:h-screen lg:grid-cols-[220px_minmax(0,1fr)]">
        <Sidebar user={user} />

        <section className="min-w-0 bg-white lg:h-screen lg:overflow-hidden">
          <div className="flex min-h-screen w-full flex-col px-5 py-4 sm:px-6 lg:h-screen lg:min-h-0 lg:px-8">
            <TopHeader
              user={user}
              result={result}
              loading={loading}
              errorMessage={errorMessage}
            />
            {renderContent()}
          </div>
        </section>
      </div>
    </main>
  )
}

function AppLogo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <div className="relative h-9 w-9 text-green-600">
        <Leaf className="absolute left-1 top-2 h-6 w-6 -rotate-[28deg] fill-green-500/15 stroke-[2.8]" />
        <Leaf className="absolute left-3.5 top-0 h-7 w-7 rotate-[22deg] fill-green-500/15 stroke-[2.8]" />
        <Leaf className="absolute left-[17px] top-[19px] h-5 w-5 rotate-[70deg] fill-green-500/15 stroke-[2.8]" />
      </div>

      <span className="text-[24px] font-black tracking-[-0.04em] text-green-700">
        FoodFlow
      </span>
    </Link>
  )
}

function Sidebar({ user }: { user: UserProfile }) {
  return (
    <aside className="hidden h-screen overflow-hidden border-r border-slate-200 bg-white px-4 py-5 lg:flex lg:flex-col">
      <AppLogo />

      <nav className="mt-7 space-y-2">
        <SidebarItem
          href="/dashboard"
          icon={<Home className="h-5 w-5" />}
          label="首页"
        />
        <SidebarItem
          href="/upload"
          icon={<CloudUpload className="h-5 w-5" />}
          label="上传"
        />
        <SidebarItem
          href="/records"
          active
          icon={<ClipboardList className="h-5 w-5" />}
          label="记录"
        />
        <SidebarItem
          href="/statistics/weekly"
          icon={<BarChart3 className="h-5 w-5" />}
          label="每周统计"
        />
        <SidebarItem
          href="/settings"
          icon={<Settings className="h-5 w-5" />}
          label="设置"
        />
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-4 shadow-[0_18px_45px_rgba(22,101,52,0.08)]">
          <div className="mb-2 flex items-center gap-2 text-green-700">
            <Crown className="h-5 w-5 fill-green-100 stroke-[2.4]" />
            <span className="text-[17px] font-black">升级专业版</span>
          </div>

          <p className="text-[13px] font-semibold leading-5 text-slate-500">
            解锁更强的 AI 洞察与个性化目标。
          </p>

          <button className="mt-3 h-9 w-full rounded-xl border border-green-500 bg-white text-[14px] font-black text-green-700 transition hover:bg-green-50">
            立即升级
          </button>
        </div>

        <button className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_14px_35px_rgba(15,23,42,0.05)] transition hover:bg-slate-50">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-green-400 to-green-700 text-[21px] font-black text-white shadow-lg shadow-green-600/20">
            {user.avatarText}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-black text-slate-900">
              {user.nickname}
            </div>
            <div className="truncate text-[12px] font-semibold text-slate-500">
              {user.phone}
            </div>
          </div>

          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </div>
    </aside>
  )
}

function SidebarItem({
  href,
  icon,
  label,
  active,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex h-[48px] items-center gap-4 rounded-xl px-4 text-[16px] font-black transition ${
        active
          ? 'bg-green-50 text-green-700 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.08)]'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <span className={active ? 'text-green-600' : 'text-slate-500'}>
        {icon}
      </span>
      {label}
    </Link>
  )
}

function TopHeader({
  user,
  result,
  loading,
  errorMessage,
}: {
  user: UserProfile
  result: AnalyzeResult | null
  loading: boolean
  errorMessage: string
}) {
  return (
    <header className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <Link
          href="/records"
          className="mb-1.5 inline-flex items-center gap-2 text-[14px] font-black text-slate-500 transition hover:text-green-700"
        >
          <ArrowLeft className="h-4 w-4" />
          返回饮食记录
        </Link>

        <h1 className="flex flex-wrap items-center gap-3 text-[30px] font-black leading-tight tracking-[-0.06em] text-slate-950">
          分析结果
          <span className="text-3xl">🥗</span>

          <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3.5 py-1.5 text-[14px] font-black tracking-normal text-green-700">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {loading ? '读取中' : result?.statusLabel ?? '加载中'}
          </span>
        </h1>

        <p className="mt-1 text-[15px] font-semibold text-slate-500">
          {formatDate(result?.createdAt)} 的 OCR 识别、营养分析与 AI 总结结果。
        </p>

        {errorMessage ? (
          <p className="mt-1 text-[13px] font-bold text-orange-600">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-4 lg:pt-0.5">
        <div className="text-right">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3.5 py-1.5 text-[14px] font-black text-green-700">
            <Sparkles className="h-4 w-4" />
            AI Workflow
          </div>

          <div className="text-[14px] font-semibold text-slate-500">
            本餐后还剩{' '}
            <span className="font-black text-slate-700">
              {result?.remainingCalories?.toLocaleString() ?? '0'}
            </span>{' '}
            kcal
          </div>
        </div>

        <button className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-green-400 to-green-700 text-[24px] font-black text-white shadow-xl shadow-green-600/20">
          {user.avatarText}
        </button>

        <ChevronDown className="h-5 w-5 text-slate-500" />
      </div>
    </header>
  )
}

function CardShell({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.055)] ${className}`}
    >
      {children}
    </div>
  )
}

function CardTitle({
  icon,
  title,
}: {
  icon?: React.ReactNode
  title: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <h2 className="text-[19px] font-black tracking-[-0.04em] text-slate-950">
        {title}
      </h2>
      {icon}
    </div>
  )
}

function CalorieResultCard({ result }: { result: AnalyzeResult }) {
  const percent = clampPercent(
    Math.round((result.totalCalories / result.targetCalories) * 100),
  )

  const degrees = Math.round((percent / 100) * 360)

  return (
    <CardShell className="flex h-[224px] flex-col p-5">
      <CardTitle title="本餐热量" />

      <div className="flex flex-1 items-center justify-center py-1">
        <div
          className="relative grid h-[118px] w-[118px] place-items-center rounded-full"
          style={{
            background: `conic-gradient(#35ad5f 0deg ${degrees}deg, #eef0f2 ${degrees}deg 360deg)`,
          }}
        >
          <div className="absolute h-[90px] w-[90px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.02)]" />

          <div className="relative text-center">
            <div className="text-[27px] font-black tracking-[-0.06em] text-slate-950">
              {result.totalCalories}
            </div>
            <div className="mt-0.5 text-[12px] font-black text-slate-500">
              kcal
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 border-t border-slate-100 pt-3">
        <div>
          <div className="text-[21px] font-black leading-none tracking-[-0.05em] text-orange-500">
            {result.remainingCalories.toLocaleString()}
          </div>
          <div className="mt-1 text-[12px] font-black text-slate-500">
            今日剩余
          </div>
        </div>

        <div className="text-right">
          <div className="text-[21px] font-black leading-none tracking-[-0.05em] text-slate-700">
            {result.targetCalories.toLocaleString()}
          </div>
          <div className="mt-1 text-[12px] font-black text-slate-500">
            今日目标
          </div>
        </div>
      </div>
    </CardShell>
  )
}

function MacroResultCard({ macros }: { macros: MacroInfo[] }) {
  return (
    <CardShell className="flex h-[224px] flex-col overflow-hidden">
      <div className="flex-1 p-5">
        <CardTitle title="宏量营养素" />

        <div className="mt-4 space-y-4">
          {macros.map((item) => (
            <MacroProgressRow key={item.key} item={item} />
          ))}
        </div>
      </div>

      <Link
        href="/statistics/weekly"
        className="flex h-[38px] shrink-0 items-center justify-center gap-3 border-t border-slate-200 text-[15px] font-black text-green-700 transition hover:bg-green-50"
      >
        查看每周趋势
        <ChevronRight className="h-4 w-4" />
      </Link>
    </CardShell>
  )
}

function MacroProgressRow({ item }: { item: MacroInfo }) {
  const tone = macroToneMap[item.key]

  return (
    <div className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-3">
      <div
        className={`grid h-10 w-10 place-items-center rounded-full ${tone.iconClassName}`}
      >
        {tone.icon}
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <div className="text-[15px] font-black text-slate-800">
            {item.label}
          </div>

          <div className="whitespace-nowrap text-[14px] font-bold text-slate-500">
            <span className="font-black text-slate-700">
              {item.value}
              {item.unit}
            </span>{' '}
            / {item.target}
            {item.unit}
            <span className="ml-3 font-black text-slate-600">
              {item.percent}%
            </span>
          </div>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${tone.barClassName}`}
            style={{ width: `${clampPercent(item.percent)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function FoodItemsCard({ items }: { items: FoodItem[] }) {
  return (
    <CardShell className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-4">
        <CardTitle
          title="识别食物明细"
          icon={<ClipboardList className="h-5 w-5 text-green-600" />}
        />

        <button className="flex h-9 items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 text-[14px] font-black text-green-700 transition hover:bg-green-100">
          <Plus className="h-4 w-4" />
          添加
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-100">
        <div className="grid h-10 shrink-0 grid-cols-[minmax(160px,1.4fr)_0.65fr_0.75fr_0.75fr_0.75fr_0.75fr_70px] items-center bg-slate-50 px-3 text-[13px] font-black text-slate-500">
          <div>食物</div>
          <div>重量</div>
          <div>热量</div>
          <div>蛋白质</div>
          <div>碳水</div>
          <div>脂肪</div>
          <div className="text-right">操作</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid min-h-[58px] grid-cols-[minmax(160px,1.4fr)_0.65fr_0.75fr_0.75fr_0.75fr_0.75fr_70px] items-center border-t border-slate-100 px-3 text-[14px]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FoodThumb imageUrl={item.imageUrl} />
                <div className="truncate font-black text-slate-800">
                  {item.name}
                </div>
              </div>

              <div className="font-bold text-slate-500">{item.weight}</div>
              <div className="font-bold text-orange-500">
                {item.calories}kcal
              </div>
              <div className="font-bold text-slate-500">{item.protein}g</div>
              <div className="font-bold text-slate-500">{item.carbs}g</div>
              <div className="font-bold text-slate-500">{item.fat}g</div>

              <div className="text-right">
                <button className="inline-flex h-8 items-center justify-center rounded-lg px-2 text-green-700 transition hover:bg-green-50">
                  <PencilLine className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  )
}

function FoodThumb({ imageUrl }: { imageUrl?: string }) {
  const [failed, setFailed] = useState(false)

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt="食物缩略图"
        className="h-9 w-9 shrink-0 rounded-lg object-cover"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-orange-100 to-green-100 text-[18px]">
      🍽️
    </div>
  )
}

function MealImageCard({ imageUrl }: { imageUrl: string }) {
  const [failed, setFailed] = useState(false)
  const showImage = imageUrl && !failed

  return (
    <CardShell className="shrink-0 overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <CardTitle
          title="餐食图片"
          icon={<ImageIcon className="h-5 w-5 text-green-600" />}
        />

        <span className="rounded-full bg-green-50 px-3 py-1 text-[12px] font-black text-green-700">
          已上传
        </span>
      </div>

      <div className="h-[218px] overflow-hidden rounded-xl 2xl:h-[240px]">
        {showImage ? (
          <img
            src={imageUrl}
            alt="上传的餐食图片"
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <MealMockImage />
        )}
      </div>
    </CardShell>
  )
}

function MealMockImage() {
  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-stone-100">
      <div className="absolute inset-x-5 bottom-[-34px] h-[128px] rounded-[50%] bg-white shadow-[inset_0_-14px_24px_rgba(120,113,108,0.12),0_18px_24px_rgba(15,23,42,0.12)]" />

      <div className="absolute left-8 top-10 h-[58px] w-[92px] rotate-[-12deg] rounded-[45%] bg-orange-400 shadow-[0_0_0_4px_#fdba74]" />
      <div className="absolute left-[116px] top-12 h-11 w-14 rounded-[45%] bg-yellow-300 shadow-[24px_6px_0_#facc15,52px_-4px_0_#fde047]" />
      <div className="absolute right-8 top-12 h-14 w-18 rounded-[45%] bg-green-500 shadow-[-18px_18px_0_#22c55e]" />
      <div className="absolute bottom-10 left-12 h-6 w-6 rounded-full bg-red-400 shadow-[28px_7px_0_#ef4444,58px_1px_0_#f97316]" />
    </div>
  )
}

function AiSummaryCard({ summary }: { summary: string[] }) {
  return (
    <CardShell className="flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-3 flex shrink-0 items-center gap-2.5">
        <Sparkles className="h-5 w-5 text-violet-600" />
        <CardTitle title="AI 营养总结" icon={null} />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {summary.map((text, index) => (
          <div key={`${text}-${index}`} className="flex gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <p className="text-[14px] font-semibold leading-6 text-slate-600">
              {text}
            </p>
          </div>
        ))}
      </div>
    </CardShell>
  )
}

function TechDetailsCard({
  technical,
}: {
  technical: AnalyzeResult['technical']
}) {
  return (
    <CardShell className="shrink-0 p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <Code2 className="h-5 w-5 text-slate-700" />
        <CardTitle title="技术详情" icon={null} />
      </div>

      <div className="space-y-2.5 text-[13px]">
        <DetailRow label="OCR 文本" value={technical.ocrText} />
        <DetailRow label="Prompt" value={technical.promptVersion} />
        <DetailRow label="AI 延迟" value={technical.aiLatency} />
        <DetailRow
          label="缓存命中"
          value={technical.cacheHit ? '命中' : '未命中'}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-[12px] font-bold text-green-700">
        <ShieldCheck className="h-4 w-4" />
        AI 分析结果仅供参考，可手动修正食物重量。
      </div>
    </CardShell>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[78px_minmax(0,1fr)] items-start gap-3">
      <span className="font-black text-slate-400">{label}</span>
      <span className="truncate text-right font-bold text-slate-600">
        {value}
      </span>
    </div>
  )
}

function ActionBar({
  onSave,
  onReAnalyze,
  onExport,
}: {
  onSave: () => void
  onReAnalyze: () => void
  onExport: () => void
}) {
  return (
    <div className="grid shrink-0 gap-3 md:grid-cols-3">
      <button
        type="button"
        onClick={onSave}
        className="flex h-[52px] items-center justify-center gap-3 rounded-xl bg-gradient-to-b from-green-500 to-green-700 text-[17px] font-black text-white shadow-[0_12px_28px_rgba(34,197,94,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(34,197,94,0.3)]"
      >
        <Save className="h-5 w-5" />
        保存记录
      </button>

      <button
        type="button"
        onClick={onReAnalyze}
        className="flex h-[52px] items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-[16px] font-black text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.045)] transition hover:bg-slate-50"
      >
        <RotateCcw className="h-5 w-5" />
        重新分析
      </button>

      <button
        type="button"
        onClick={onExport}
        className="flex h-[52px] items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-[16px] font-black text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.045)] transition hover:bg-slate-50"
      >
        <Download className="h-5 w-5" />
        导出结果
      </button>
    </div>
  )
}