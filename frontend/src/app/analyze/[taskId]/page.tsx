'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CloudUpload,
  Crown,
  FileImage,
  FileText,
  Home,
  Leaf,
  Lightbulb,
  Lock,
  RefreshCcw,
  RotateCcw,
  ScanText,
  Settings,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Utensils,
  Workflow,
  XCircle,
} from 'lucide-react'

type AnalyzeTaskStatus =
  | 'PENDING'
  | 'UPLOADED'
  | 'OCR_PROCESSING'
  | 'OCR_SUCCESS'
  | 'STRUCTURING'
  | 'CALCULATING'
  | 'AI_SUMMARIZING'
  | 'SUCCESS'
  | 'FAILED'

type AnalyzeTaskEvent = {
  time: string
  title: string
}

type AnalyzeTask = {
  id: string
  task_id?: string
  filename: string
  image_url?: string
  upload_time?: string
  file_size?: string
  image_format?: string
  status: AnalyzeTaskStatus
  progress_percent?: number
  eta_seconds?: number
  retry_count?: number
  error_message?: string | null
  record_id?: string | null
  events?: AnalyzeTaskEvent[]
}

type UserProfile = {
  nickname: string
  phone: string
  avatarText: string
}

type WorkflowStep = {
  key: AnalyzeTaskStatus
  title: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
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

const user = getUserProfile()

const workflowSteps: WorkflowStep[] = [
  {
    key: 'UPLOADED',
    title: '图片已上传',
    desc: '上传完成，任务已创建',
    icon: FileImage,
  },
  {
    key: 'OCR_PROCESSING',
    title: 'OCR 识别中',
    desc: '正在识别图片中的食物文字',
    icon: ScanText,
  },
  {
    key: 'STRUCTURING',
    title: '食物结构化',
    desc: '将识别文本转换为食物数据',
    icon: Utensils,
  },
  {
    key: 'CALCULATING',
    title: '热量计算',
    desc: '计算热量与宏量营养素',
    icon: Calculator,
  },
  {
    key: 'AI_SUMMARIZING',
    title: 'AI 总结生成中',
    desc: '生成饮食建议与营养总结',
    icon: Sparkles,
  },
  {
    key: 'SUCCESS',
    title: '分析完成',
    desc: '结果已生成，可查看详情',
    icon: CheckCircle2,
  },
]

const processTips = [
  {
    title: '后台持续处理',
    desc: '你可以离开页面，任务仍会继续运行。',
    icon: <Workflow className="h-5 w-5" />,
    tone: 'bg-green-50 text-green-600',
  },
  {
    title: '自动轮询状态',
    desc: '页面会自动同步 OCR 与 AI 分析进度。',
    icon: <RefreshCcw className="h-5 w-5" />,
    tone: 'bg-green-50 text-green-600',
  },
  {
    title: '失败可重新分析',
    desc: '如果识别失败，可以重新发起任务。',
    icon: <RotateCcw className="h-5 w-5" />,
    tone: 'bg-yellow-50 text-yellow-500',
  },
]

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function getStatusText(status: AnalyzeTaskStatus) {
  const map: Record<AnalyzeTaskStatus, string> = {
    PENDING: '排队中',
    UPLOADED: '图片已上传',
    OCR_PROCESSING: 'OCR 识别中',
    OCR_SUCCESS: 'OCR 已完成',
    STRUCTURING: '食物结构化中',
    CALCULATING: '热量计算中',
    AI_SUMMARIZING: 'AI 总结生成中',
    SUCCESS: '分析完成',
    FAILED: '分析失败',
  }

  return map[status]
}

function getStepIndex(status: AnalyzeTaskStatus) {
  if (status === 'PENDING') return 0
  if (status === 'OCR_SUCCESS') return 2
  if (status === 'FAILED') return 1

  const map: Partial<Record<AnalyzeTaskStatus, number>> = {
    UPLOADED: 0,
    OCR_PROCESSING: 1,
    STRUCTURING: 2,
    CALCULATING: 3,
    AI_SUMMARIZING: 4,
    SUCCESS: 5,
  }

  return map[status] ?? 1
}

function getProgress(status: AnalyzeTaskStatus, fallback?: number) {
  if (typeof fallback === 'number') return fallback

  const map: Partial<Record<AnalyzeTaskStatus, number>> = {
    PENDING: 10,
    UPLOADED: 20,
    OCR_PROCESSING: 35,
    OCR_SUCCESS: 48,
    STRUCTURING: 58,
    CALCULATING: 72,
    AI_SUMMARIZING: 86,
    SUCCESS: 100,
    FAILED: 65,
  }

  return map[status] ?? 35
}

function formatEta(seconds?: number) {
  if (!seconds) return '15–30 秒'
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.ceil(seconds / 60)} 分钟`
}

export default function AnalyzeTaskPage() {
  const router = useRouter()
  const params = useParams()

  const taskId = useMemo(() => {
    const raw = params?.taskId
    if (Array.isArray(raw)) return raw[0] ?? ''
    return String(raw ?? '')
  }, [params])

  const [task, setTask] = useState<AnalyzeTask>({
    id: taskId,
    filename: '',
    status: 'PENDING',
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [lastSyncText, setLastSyncText] = useState('刚刚同步')

  const currentStepIndex = useMemo(
    () => getStepIndex(task.status),
    [task.status],
  )

  const progress = useMemo(
    () => getProgress(task.status, task.progress_percent),
    [task.status, task.progress_percent],
  )

  const isFinished = task.status === 'SUCCESS' && !!task.record_id
  const isFailed = task.status === 'FAILED'
  const isProcessing = !isFinished && !isFailed

  const syncTask = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setIsRefreshing(true)

        const token =
          typeof window !== 'undefined' ? localStorage.getItem('token') : null

        const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })

        if (res.status === 401) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          router.push('/login')
          return
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || data.message || '获取任务状态失败')
        }

        const data = (await res.json()) as AnalyzeTask
        setTask(data)
        setApiError(null)
        setLastSyncText('刚刚同步')
      } catch (err: unknown) {
        setApiError(
          err instanceof Error ? err.message : '任务状态同步失败',
        )
      } finally {
        setIsRefreshing(false)
      }
    },
    [taskId, router],
  )

  const handleRetry = useCallback(async () => {
    try {
      setIsRefreshing(true)

      const token =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null

      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        router.push('/login')
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || data.message || '重试失败')
      }

      // 重试成功后重置为 PENDING 状态，恢复轮询
      setTask({
        id: taskId,
        task_id: taskId,
        filename: task.filename ?? '',
        status: 'PENDING',
        progress_percent: 0,
        retry_count: (task.retry_count ?? 0) + 1,
        events: [],
      })
      setApiError(null)
      setLastSyncText('任务已重新提交')
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : '重试失败')
    } finally {
      setIsRefreshing(false)
    }
  }, [taskId, router, task])

  // 首次加载 + 轮询
  useEffect(() => {
    syncTask(true)
  }, [syncTask])

  useEffect(() => {
    if (!isProcessing) return

    const timer = window.setInterval(() => {
      syncTask(true)
    }, 1500)

    return () => window.clearInterval(timer)
  }, [isProcessing, syncTask])

  // SUCCESS + record_id → 判断是否需确认再跳转
  useEffect(() => {
    if (!isFinished || !task.record_id) return

    let cancelled = false
    async function decideRedirect() {
      try {
        const res = await fetch(`${API_BASE}/api/foods/${task.record_id}`, {
          headers: {
            ...(typeof window !== "undefined" && localStorage.getItem("token")
              ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
              : {}),
          },
        })
        if (!res.ok || cancelled) return
        const body = await res.json()
        const data = body.data || body
        const items: Array<{ estimated?: boolean; source?: string }> =
          data?.food_items || data?.foodItems || []
        const needsConfirm = items.some(
          (it) => it.estimated === true || it.source === "vision" || it.source === "fusion"
        )
        if (cancelled) return
        router.push(needsConfirm ? `/confirm/${task.record_id}` : `/records/${task.record_id}`)
      } catch {
        if (!cancelled) router.push(`/records/${task.record_id}`)
      }
    }
    decideRedirect()
    return () => { cancelled = true }
  }, [isFinished, task.record_id, router])

  return (
    <main className="min-h-screen bg-[#f8faf8] text-slate-950 lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen grid-cols-1 lg:h-screen lg:grid-cols-[220px_minmax(0,1fr)]">
        <Sidebar user={user} />

        <section className="min-w-0 bg-white lg:h-screen lg:overflow-hidden">
          <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col px-5 py-4 sm:px-6 lg:px-7">
            <TopHeader user={user} apiError={apiError} />

            <div className="mt-4 grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.055)]">
                <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)]">
                  <UploadedImageCard task={task} taskId={taskId} />

                  <WorkflowCard
                    task={task}
                    progress={progress}
                    currentStepIndex={currentStepIndex}
                    isFinished={isFinished}
                    isFailed={isFailed}
                  />
                </div>

                <ActionBar
                  isFinished={isFinished}
                  isFailed={isFailed}
                  isRefreshing={isRefreshing}
                  task={task}
                  onBack={() => router.push('/upload')}
                  onRefresh={() => syncTask(false)}
                  onRetry={handleRetry}
                  onViewResult={() => {
                    if (task.record_id) {
                      router.push(`/records/${task.record_id}`)
                    }
                  }}
                />

                <div className="mt-3 flex shrink-0 items-center justify-center gap-2 text-[13px] font-bold text-slate-500">
                  <Lock className="h-4 w-4" />
                  你的数据安全且私密
                </div>
              </section>

              <aside className="hidden min-h-0 flex-col gap-4 xl:flex">
                <CurrentStatusCard
                  task={task}
                  isProcessing={isProcessing}
                  isFailed={isFailed}
                  lastSyncText={lastSyncText}
                />

                <TaskTimelineCard task={task} />

                <ProcessingTipsCard />
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function UploadedImageCard({
  task,
  taskId,
}: {
  task: AnalyzeTask
  taskId: string
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.045)]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[20px] font-black tracking-[-0.04em] text-slate-950">
          上传图片
        </h2>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-[12px] font-black text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          上传成功
        </span>
      </div>

      <div className="relative h-[210px] shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
        {task.image_url ? (
          <img
            src={task.image_url.startsWith('/uploads') ? `${API_BASE}${task.image_url}` : task.image_url}
            alt={task.filename}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 text-slate-300">
            <FileImage className="h-12 w-12" />
            <div className="mt-2 text-[14px] font-black">暂无图片</div>
          </div>
        )}

        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[13px] font-black text-green-700 shadow-lg shadow-slate-900/5 backdrop-blur">
          <Check className="h-4 w-4 stroke-[3]" />
          已接收
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <div className="truncate text-[18px] font-black tracking-[-0.03em] text-slate-950">
          {task.filename || 'food-image.jpg'}
        </div>

        <div className="mt-4 space-y-3 text-[13px]">
          <InfoRow label="任务 ID" value={task.id || task.task_id || taskId} />
          <InfoRow label="上传时间" value={task.upload_time || '刚刚'} />
          <InfoRow label="文件大小" value={task.file_size || '—'} />
          <InfoRow label="图片格式" value={task.image_format || 'JPG'} />
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <div className="text-[14px] font-black text-green-700">
                图片已进入 AI Workflow
              </div>
              <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">
                系统会依次完成 OCR、食物结构化、热量计算和 AI 总结。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function WorkflowCard({
  task,
  progress,
  currentStepIndex,
  isFinished,
  isFailed,
}: {
  task: AnalyzeTask
  progress: number
  currentStepIndex: number
  isFinished: boolean
  isFailed: boolean
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.045)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-black tracking-[-0.04em] text-slate-950">
            分析进度
          </h2>
          <div className="mt-1 text-[13px] font-semibold text-slate-500">
            AI Workflow 正在执行中
          </div>
        </div>

        <StatusBadge status={task.status} />
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-[13px] font-black">
          <span className="text-slate-500">整体进度</span>
          <span className="text-slate-700">{progress}%</span>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className={cx(
              'h-full rounded-full transition-all duration-700',
              isFailed
                ? 'bg-red-500'
                : 'bg-gradient-to-r from-green-400 to-green-700',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1">
        {workflowSteps.map((step, index) => {
          const Icon = step.icon

          const complete =
            !isFailed && (isFinished || index < currentStepIndex)

          const current =
            !isFailed && !isFinished && index === currentStepIndex

          const pending = !complete && !current

          return (
            <div key={step.key}>
              <div
                className={cx(
                  'flex items-center gap-3 rounded-xl p-2.5 transition',
                  current &&
                    'border border-green-100 bg-green-50 shadow-[0_8px_20px_rgba(34,197,94,0.08)]',
                  pending && 'bg-white',
                )}
              >
                <div
                  className={cx(
                    'grid h-11 w-11 shrink-0 place-items-center rounded-full border-4 transition',
                    complete && 'border-green-100 bg-green-600 text-white',
                    current &&
                      'border-green-100 bg-gradient-to-br from-green-400 to-green-700 text-white shadow-lg shadow-green-600/20',
                    pending &&
                      'border-slate-100 bg-slate-50 text-slate-400',
                    isFailed &&
                      index === currentStepIndex &&
                      'border-red-100 bg-red-500 text-white',
                  )}
                >
                  {complete ? (
                    <Check className="h-5 w-5 stroke-[3]" />
                  ) : current ? (
                    <RefreshCcw className="h-5 w-5 animate-spin" />
                  ) : isFailed && index === currentStepIndex ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className={cx(
                      'text-[15px] font-black tracking-[-0.03em]',
                      current
                        ? 'text-green-700'
                        : complete
                          ? 'text-slate-950'
                          : 'text-slate-700',
                    )}
                  >
                    {index + 1}. {step.title}
                  </div>

                  <div className="mt-0.5 text-[12px] font-semibold text-slate-500">
                    {complete
                      ? '完成'
                      : current
                        ? step.desc
                        : isFailed && index === currentStepIndex
                          ? task.error_message || '处理失败'
                          : '等待中'}
                  </div>
                </div>
              </div>

              {index < workflowSteps.length - 1 ? (
                <div className="ml-[31px] flex h-4 w-8 items-center justify-center text-[12px] font-black text-slate-300">
                  ↓
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CurrentStatusCard({
  task,
  isProcessing,
  isFailed,
  lastSyncText,
}: {
  task: AnalyzeTask
  isProcessing: boolean
  isFailed: boolean
  lastSyncText: string
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.055)]">
      <div className="mb-4 flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-green-600" />
        <h2 className="text-[22px] font-black tracking-[-0.04em] text-green-700">
          当前状态
        </h2>
      </div>

      <div className="space-y-3.5">
        <StatusLine
          icon={<Workflow className="h-4 w-4" />}
          label="队列状态"
          value={isProcessing ? '已开始处理' : getStatusText(task.status)}
          tone={isFailed ? 'danger' : 'success'}
        />

        <StatusLine
          icon={<TimerReset className="h-4 w-4" />}
          label="预计剩余"
          value={isProcessing ? formatEta(task.eta_seconds) : '已完成'}
        />

        <StatusLine
          icon={<RefreshCcw className="h-4 w-4" />}
          label="轮询状态"
          value={isProcessing ? lastSyncText : '无需轮询'}
        />

        <StatusLine
          icon={<ShieldCheck className="h-4 w-4" />}
          label="失败重试"
          value="已启用"
          tone="success"
        />
      </div>
    </section>
  )
}

function TaskTimelineCard({ task }: { task: AnalyzeTask }) {
  const events = task.events?.length ? task.events : []

  return (
    <section className="min-h-0 flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.055)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[20px] font-black tracking-[-0.04em] text-slate-950">
          任务动态
        </h2>

        <span className="rounded-full bg-green-50 px-3 py-1 text-[12px] font-black text-green-700">
          实时同步
        </span>
      </div>

      <div className="space-y-4">
        {events.map((event: AnalyzeTaskEvent, index: number) => (
          <div key={`${event.time}-${event.title}`} className="flex gap-3">
            <div className="w-12 shrink-0 pt-0.5 text-right text-[13px] font-bold text-slate-500">
              {event.time}
            </div>

            <div className="relative flex flex-col items-center">
              <span className="z-10 mt-1 h-2.5 w-2.5 rounded-full bg-green-500 ring-4 ring-green-50" />
              {index < events.length - 1 ? (
                <span className="absolute top-4 h-8 w-px bg-green-200" />
              ) : null}
            </div>

            <div className="min-w-0 flex-1 text-[14px] font-black text-slate-700">
              {event.title}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProcessingTipsCard() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.055)]">
      <div className="mb-3 flex items-center gap-3">
        <Lightbulb className="h-7 w-7 text-yellow-500" />
        <h2 className="text-[22px] font-black tracking-[-0.04em] text-green-700">
          处理提示
        </h2>
      </div>

      <div>
        {processTips.map((item, index) => (
          <div
            key={item.title}
            className={cx(
              'flex gap-4 py-3',
              index === processTips.length - 1
                ? ''
                : 'border-b border-slate-100',
            )}
          >
            <div
              className={`grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full ${item.tone}`}
            >
              {item.icon}
            </div>

            <div className="min-w-0">
              <div className="text-[16px] font-black tracking-[-0.04em] text-slate-950">
                {item.title}
              </div>

              <p className="mt-1 text-[13px] font-semibold leading-5 text-slate-500">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ActionBar({
  isFinished,
  isFailed,
  isRefreshing,
  task,
  onBack,
  onRefresh,
  onRetry,
  onViewResult,
}: {
  isFinished: boolean
  isFailed: boolean
  isRefreshing: boolean
  task: AnalyzeTask
  onBack: () => void
  onRefresh: () => void
  onRetry: () => void
  onViewResult: () => void
}) {
  return (
    <div className="mt-5 shrink-0">
      <div className="grid gap-3 lg:grid-cols-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[15px] font-black text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          返回上传页
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[15px] font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw
            className={cx('h-4 w-4', isRefreshing && 'animate-spin')}
          />
          刷新状态
        </button>

        {isFailed ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRefreshing}
            className="flex h-[48px] items-center justify-center gap-2 rounded-xl bg-red-500 text-[15px] font-black text-white shadow-[0_14px_30px_rgba(239,68,68,0.2)] transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            重新分析
          </button>
        ) : (
          <button
            type="button"
            onClick={onViewResult}
            disabled={!isFinished}
            className={cx(
              'flex h-[48px] items-center justify-center gap-2 rounded-xl text-[15px] font-black transition',
              isFinished
                ? 'bg-gradient-to-b from-green-500 to-green-700 text-white shadow-[0_14px_30px_rgba(34,197,94,0.25)] hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(34,197,94,0.3)]'
                : 'cursor-not-allowed bg-slate-100 text-slate-300',
            )}
          >
            <FileText className="h-4 w-4" />
            查看结果 {!isFinished ? '（待完成）' : ''}
          </button>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: AnalyzeTaskStatus }) {
  const failed = status === 'FAILED'
  const success = status === 'SUCCESS'

  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-black',
        failed && 'bg-red-50 text-red-600',
        success && 'bg-green-50 text-green-700',
        !failed && !success && 'bg-green-50 text-green-700',
      )}
    >
      {failed ? (
        <XCircle className="h-3.5 w-3.5" />
      ) : success ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
      )}
      {getStatusText(status)}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="truncate text-right font-black text-slate-700">
        {value}
      </span>
    </div>
  )
}

function StatusLine({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'default' | 'success' | 'danger'
}) {
  return (
    <div className="grid grid-cols-[28px_82px_minmax(0,1fr)] items-center gap-2">
      <div
        className={cx(
          'grid h-7 w-7 place-items-center rounded-full',
          tone === 'success' && 'bg-green-50 text-green-600',
          tone === 'danger' && 'bg-red-50 text-red-500',
          tone === 'default' && 'bg-slate-50 text-slate-400',
        )}
      >
        {icon}
      </div>

      <span className="text-[13px] font-black text-slate-500">{label}：</span>

      <span
        className={cx(
          'truncate text-[13px] font-black',
          tone === 'success' && 'text-green-700',
          tone === 'danger' && 'text-red-500',
          tone === 'default' && 'text-slate-700',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function Sidebar({ user }: { user: UserProfile }) {
  const pathname = usePathname()

  return (
    <aside className="hidden h-screen overflow-hidden border-r border-slate-200 bg-white px-4 py-5 lg:flex lg:flex-col">
      <AppLogo />

      <nav className="mt-7 space-y-2">
        <SidebarItem
          href="/dashboard"
          pathname={pathname}
          icon={<Home className="h-5 w-5" />}
          label="首页"
        />

        <SidebarItem
          href="/upload"
          pathname={pathname}
          icon={<CloudUpload className="h-5 w-5" />}
          label="上传"
        />

        <SidebarItem
          href="/records"
          pathname={pathname}
          icon={<ClipboardList className="h-5 w-5" />}
          label="记录"
        />

        <SidebarItem
          href="/statistics/weekly"
          pathname={pathname}
          icon={<BarChart3 className="h-5 w-5" />}
          label="每周统计"
        />

        <SidebarItem
          href="/settings"
          pathname={pathname}
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
  pathname,
}: {
  href: string
  icon: React.ReactNode
  label: string
  pathname: string
}) {
  const active =
    href === '/dashboard'
      ? pathname === '/dashboard' || pathname === '/'
      : href === '/upload'
        ? pathname === '/upload' || pathname.startsWith('/analyze')
        : pathname === href || pathname.startsWith(`${href}/`)

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

function TopHeader({
  user,
  apiError,
}: {
  user: UserProfile
  apiError: string | null
}) {
  return (
    <header className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-4">
        <div className="grid h-[64px] w-[64px] shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-green-600 shadow-[0_14px_30px_rgba(15,23,42,0.07)]">
          <Workflow className="h-8 w-8" />
        </div>

        <div>
          <h1 className="text-[32px] font-black leading-tight tracking-[-0.06em] text-slate-950 sm:text-[36px]">
            分析任务
          </h1>

          <p className="mt-1.5 text-[16px] font-semibold text-slate-500">
            图片已上传，系统正在为你执行 OCR、结构化解析与 AI 营养分析。
          </p>

          {apiError ? (
            <div className="mt-2 inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-[12px] font-black text-yellow-700">
              {apiError}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-4 lg:pt-1">
        <div className="text-right">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3.5 py-1.5 text-[14px] font-black text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            状态良好
          </div>

          <div className="text-[14px] font-semibold text-slate-500">
            你今天还差{' '}
            <span className="font-black text-slate-700">230</span> kcal 达标
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