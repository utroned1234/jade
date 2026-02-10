'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import BottomNav from '@/components/ui/BottomNav'
import { useToast } from '@/components/ui/Toast'
import ScreenshotProtection from '@/components/ui/ScreenshotProtection'
import EarningsChart from '@/components/ui/EarningsChart'

interface DashboardData {
  user: {
    username: string
    full_name: string
    user_code: string
    profile_image_url?: string | null
  }
  daily_profit: number
  daily_profit_total: number
  active_vip_daily: number
  active_vip_name: string | null
  active_vip_status: string | null
  has_active_vip: boolean
  active_purchases: {
    daily_profit_bs: number
    vip_package: {
      name: string
      level: number
    }
  }[]
  referral_bonus: number
  referral_bonus_total: number
  referral_bonus_levels: {
    level: number
    amount_bs: number
    percentage: number
  }[]
  adjustments: {
    items: Array<{
      amount: number
      type: 'ABONADO' | 'DESCUENTO'
      description: string
    }>
    total: number
  }
  total_earnings: number
  network_count: number
  direct_referrals: number
  banners_top: any[]
  banners_bottom: any[]
  announcements: {
    id: number
    title: string
    body: string
    created_at: string
  }[]
  earnings_history: {
    date: string
    amount: number
    day: string
  }[]
  shared_bonus: number
  shared_bonus_entries: {
    amount_bs: number
    description: string
    created_at: string
  }[]
  sponsor_name: string | null
}

interface DailyTask {
  id: number
  position: number
  image_url: string
  completed: boolean
  rating: number | null
  comment: string | null
}

interface RoulettePrize {
  text: string
  color: string
  value: number
}

// Premios fijos de la ruleta (giro gratis por compra de paquete)
const PURCHASE_PRIZES: RoulettePrize[] = [
  { text: '$2', color: '#B71C1C', value: 2 },
  { text: '$5', color: '#0D47A1', value: 5 },
  { text: '$10', color: '#1B5E20', value: 10 },
  { text: '$15', color: '#E65100', value: 15 },
  { text: '$20', color: '#4A148C', value: 20 },
  { text: '$40', color: '#004D40', value: 40 },
  { text: '$80', color: '#880E4F', value: 80 },
  { text: '$100', color: '#BF360C', value: 100 },
  { text: '$200', color: '#1A237E', value: 200 },
  { text: '$400', color: '#FF6F00', value: 400 },
]

// Selección con probabilidad: nunca cae en $15+, mayor prob en $2 y $5
function getWeightedPrizeIndex(): number {
  const rand = Math.random()
  if (rand < 0.45) return 0  // $2  - 45%
  if (rand < 0.85) return 1  // $5  - 40%
  return 2                    // $10 - 15%
}

// ===== PARTICIPACIÓN PAGADA =====
const SEGMENT_COLORS = [
  '#B71C1C', '#0D47A1', '#1B5E20', '#E65100', '#4A148C',
  '#004D40', '#880E4F', '#BF360C', '#1A237E', '#FF6F00',
]

const PAID_PRIZES: Record<number, number[]> = {
  2:   [0, 1, 2, 3, 4, 5, 6, 7, 8, 10],
  5:   [0, 1, 2, 3, 4, 5, 6, 8, 10, 15],
  10:  [0, 2, 4, 6, 8, 10, 12, 14, 16, 20],
  20:  [0, 4, 8, 12, 16, 20, 24, 28, 32, 40],
  50:  [0, 5, 10, 15, 20, 30, 40, 55, 75, 100],
  100: [0, 10, 20, 30, 40, 60, 80, 110, 150, 200],
  200: [0, 20, 40, 60, 80, 120, 160, 220, 300, 400],
}

const ENTRY_AMOUNTS = [2, 5, 10, 20, 50, 100, 200]

function getPaidPrizes(entryAmount: number): RoulettePrize[] {
  const values = PAID_PRIZES[entryAmount] || PAID_PRIZES[2]
  return values.map((v, i) => ({
    text: v === 0 ? '$0' : `$${v}`,
    color: SEGMENT_COLORS[i],
    value: v,
  }))
}

interface PaidSpinHistory {
  id: string
  entry_amount: number
  prize_amount: number
  won: boolean
  created_at: string
}

interface PaidRouletteData {
  balance: number
  history: PaidSpinHistory[]
  stats: {
    total_spins: number
    total_entries: number
    total_prizes: number
    net: number
  }
}

type RouletteMode = 'free' | 'paid'

interface RouletteData {
  can_spin: boolean
  spins_available: number
  eligible_purchases: Array<{
    id: string
    package_name: string
    investment_bs: number
  }>
  history: {
    id: string
    package_name: string
    investment_bs: number
    won_bs: number
    spun_at: string
  }[]
  total_winnings: number
  min_investment: number
}

export default function HomePage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingToken, setMissingToken] = useState(false)
  const [showAnnouncements, setShowAnnouncements] = useState(false)
  const [activating, setActivating] = useState(false)
  const [canActivate, setCanActivate] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [allTasksCompleted, setAllTasksCompleted] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null)
  const [taskRating, setTaskRating] = useState(0)
  const [taskComment, setTaskComment] = useState('')
  const [submittingTask, setSubmittingTask] = useState(false)
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [showDailyDetail, setShowDailyDetail] = useState(false)
  const [showBonusDetail, setShowBonusDetail] = useState(false)
  const [showSharedDetail, setShowSharedDetail] = useState(false)
  const [showExtrasDetail, setShowExtrasDetail] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(true)
  const { showToast } = useToast()

  // Roulette states
  const rouletteCanvasRef = useRef<HTMLCanvasElement>(null)
  const rouletteConfettiRef = useRef<HTMLDivElement>(null)
  const [rouletteRotation, setRouletteRotation] = useState(0)
  const [rouletteSpinning, setRouletteSpinning] = useState(false)
  const [rouletteResult, setRouletteResult] = useState('')
  const [rouletteResultWon, setRouletteResultWon] = useState(true)
  const [rouletteData, setRouletteData] = useState<RouletteData | null>(null)
  const [rouletteLoading, setRouletteLoading] = useState(true)
  const [rouletteError, setRouletteError] = useState('')

  // Paid roulette states
  const [rouletteMode, setRouletteMode] = useState<RouletteMode>('free')
  const [paidRouletteData, setPaidRouletteData] = useState<PaidRouletteData | null>(null)
  const [paidRouletteLoading, setPaidRouletteLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<number>(2)
  const [showRouletteHistory, setShowRouletteHistory] = useState(false)
  const [rouletteSessionId] = useState(() => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  })

  const prizes = useMemo(() => {
    if (rouletteMode === 'paid') return getPaidPrizes(selectedEntry)
    return PURCHASE_PRIZES
  }, [rouletteMode, selectedEntry])

  useEffect(() => {
    fetchDashboard()
    checkActivationStatus()
    fetchDailyTasks()
    fetchWhatsappNumber()
    fetchRouletteData()
    fetchPaidRouletteData()
  }, [])

  const fetchWhatsappNumber = async () => {
    try {
      const res = await fetch('/api/public/whatsapp')
      if (res.ok) {
        const data = await res.json()
        setWhatsappNumber(data.whatsapp_number || '')
      }
    } catch (error) {
      console.error('Error fetching WhatsApp number:', error)
    }
  }

  const fetchRouletteData = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]
      if (!token) { setRouletteLoading(false); return }

      const response = await fetch('/api/user/roulette', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setRouletteData(data)
      }
    } catch (err) {
      console.error('Error fetching roulette data:', err)
    } finally {
      setRouletteLoading(false)
    }
  }

  const fetchPaidRouletteData = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]
      if (!token) { setPaidRouletteLoading(false); return }

      const response = await fetch('/api/user/roulette/paid', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setPaidRouletteData(data)
      }
    } catch (err) {
      console.error('Error fetching paid roulette data:', err)
    } finally {
      setPaidRouletteLoading(false)
    }
  }

  // Draw roulette wheel
  useEffect(() => {
    const canvas = rouletteCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = canvas.width / 2
    const segmentAngle = (2 * Math.PI) / prizes.length

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    prizes.forEach((prize, index) => {
      const startAngle = index * segmentAngle - Math.PI / 2
      const endAngle = startAngle + segmentAngle

      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle)
      ctx.closePath()

      // Relleno sólido oscuro
      ctx.fillStyle = prize.color
      ctx.fill()

      // Borde dorado nítido entre segmentos
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      ctx.strokeStyle = '#FFD700'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Texto blanco nítido con sombra para contraste
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(startAngle + segmentAngle / 2)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 28px Arial'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2
      ctx.fillText(prize.text, radius - 20, 0)
      ctx.restore()
    })

    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.beginPath()
    ctx.arc(centerX, centerY, 50, 0, 2 * Math.PI)
    ctx.fillStyle = '#1a1a2e'
    ctx.fill()
    ctx.strokeStyle = '#FFD700'
    ctx.lineWidth = 3
    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur = 12
    ctx.stroke()
  }, [prizes, data])

  const rouletteParticles = useMemo(() => {
    const elems = []
    const colors = ['#00ffff', '#ff00ff', '#00ff88', '#ffff00']
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * 2 * Math.PI
      const x = Math.cos(angle) * 160
      const y = Math.sin(angle) * 160
      elems.push(
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(${x}px, ${y}px)`,
            background: colors[i % colors.length],
            boxShadow: `0 0 10px ${colors[i % colors.length]}`,
            animation: `ledBlink ${0.5 + Math.random()}s ease-in-out infinite`,
            animationDelay: `${i * 0.02}s`,
          }}
        />
      )
    }
    return elems
  }, [])

  // === Sonidos de la ruleta ===
  const audioCtxRef = useRef<AudioContext | null>(null)
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    return audioCtxRef.current
  }, [])

  const playSpinSound = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      let t = ctx.currentTime
      // Ticks acelerándose y desacelerándose
      for (let i = 0; i < 60; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 800 + Math.random() * 400
        osc.type = 'sine'
        gain.gain.value = 0.08
        osc.start(t)
        osc.stop(t + 0.03)
        // Intervalo: rápido al inicio, lento al final
        const progress = i / 60
        t += 0.05 + progress * 0.4
      }
    } catch {}
  }, [getAudioCtx])

  const playWinSound = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.15, t + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.4)
        osc.start(t + i * 0.15)
        osc.stop(t + i * 0.15 + 0.4)
      })
    } catch {}
  }, [getAudioCtx])

  const playLoseSound = useCallback(() => {
    try {
      const ctx = getAudioCtx()
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(400, t)
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.5)
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.12, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
      osc.start(t)
      osc.stop(t + 0.6)
    } catch {}
  }, [getAudioCtx])

  const rouletteCelebrate = useCallback(() => {
    const container = rouletteConfettiRef.current
    if (!container) return
    const colors = ['#00ffff', '#ff00ff', '#00ff88', '#ffff00', '#ffd700']
    for (let i = 0; i < 80; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div')
        confetti.className = 'confetti-piece'
        confetti.style.left = Math.random() * 100 + '%'
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)]
        confetti.style.animationDelay = Math.random() * 0.5 + 's'
        container.appendChild(confetti)
        setTimeout(() => confetti.remove(), 3000)
      }, i * 20)
    }
  }, [])

  const animateRouletteToIndex = useCallback((targetIndex: number, totalSegments: number) => {
    const segmentAngle = 360 / totalSegments
    const segmentCenter = targetIndex * segmentAngle + (segmentAngle / 2)
    const targetFinalAngle = 360 - segmentCenter
    const spins = Math.floor(Math.random() * 10) + 20

    setRouletteRotation((current) => {
      const currentNormalized = ((current % 360) + 360) % 360
      let additional = targetFinalAngle - currentNormalized
      if (additional <= 0) additional += 360
      return current + (spins * 360) + additional
    })
  }, [])

  const spinRoulette = useCallback(async () => {
    if (rouletteSpinning || !rouletteData?.can_spin) return

    setRouletteSpinning(true)
    setRouletteResult('')
    setRouletteResultWon(true)
    setRouletteError('')
    playSpinSound()

    const targetIndex = getWeightedPrizeIndex()
    animateRouletteToIndex(targetIndex, PURCHASE_PRIZES.length)

    await new Promise(resolve => setTimeout(resolve, 30000))

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]

      const wonPrize = PURCHASE_PRIZES[targetIndex]

      const response = await fetch('/api/user/roulette', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          purchase_id: rouletteData?.eligible_purchases[0]?.id,
          prize_index: targetIndex,
          prize_value: wonPrize.value,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al procesar el giro')
      }

      const data = await response.json()
      setRouletteResult(`+$${data.prize_amount}`)
      setRouletteResultWon(true)
      playWinSound()
      rouletteCelebrate()
      fetchRouletteData()
    } catch (err) {
      setRouletteError(err instanceof Error ? err.message : 'Error al procesar el giro')
      setRouletteResult('')
    } finally {
      setRouletteSpinning(false)
    }
  }, [rouletteSpinning, rouletteData, rouletteCelebrate, animateRouletteToIndex, playSpinSound, playWinSound])

  const spinPaidRoulette = useCallback(async () => {
    if (rouletteSpinning) return
    if (!paidRouletteData || paidRouletteData.balance < selectedEntry) return

    setRouletteSpinning(true)
    setRouletteResult('')
    setRouletteResultWon(true)
    setRouletteError('')
    playSpinSound()

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]

      // Backend decide el resultado ANTES de animar
      const response = await fetch('/api/user/roulette/paid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entry_amount: selectedEntry,
          session_id: rouletteSessionId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al procesar el giro')
      }

      const resultData = await response.json()
      const targetIndex = resultData.prize_index

      // Animar al índice que el backend eligió
      const currentPrizes = getPaidPrizes(selectedEntry)
      animateRouletteToIndex(targetIndex, currentPrizes.length)

      await new Promise(resolve => setTimeout(resolve, 30000))

      if (resultData.prize_amount > 0) {
        setRouletteResult(`+$${resultData.prize_amount}`)
        setRouletteResultWon(true)
        playWinSound()
        if (resultData.prize_amount >= selectedEntry) {
          rouletteCelebrate()
        }
      } else {
        setRouletteResult('$0')
        setRouletteResultWon(false)
        playLoseSound()
      }

      // Actualizar datos
      setPaidRouletteData(prev => prev ? { ...prev, balance: resultData.new_balance } : prev)
      fetchPaidRouletteData()
    } catch (err) {
      setRouletteError(err instanceof Error ? err.message : 'Error al procesar el giro')
      setRouletteResult('')
    } finally {
      setRouletteSpinning(false)
    }
  }, [rouletteSpinning, paidRouletteData, selectedEntry, rouletteSessionId, rouletteCelebrate, animateRouletteToIndex, playSpinSound, playWinSound, playLoseSound])

  const canSpinRoulette = rouletteMode === 'free'
    ? (rouletteData?.can_spin && !rouletteSpinning)
    : (paidRouletteData && paidRouletteData.balance >= selectedEntry && !rouletteSpinning)

  const handleSpinRoulette = rouletteMode === 'free' ? spinRoulette : spinPaidRoulette

  const fetchDailyTasks = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]
      if (!token) return

      const res = await fetch('/api/user/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const result = await res.json()
        setDailyTasks(result.tasks || [])
        setAllTasksCompleted(result.all_completed)
      }
    } catch (error) {
      console.error('Error fetching daily tasks:', error)
    }
  }

  const handleTaskClick = (task: DailyTask) => {
    if (task.completed) return
    setSelectedTask(task)
    setTaskRating(0)
    setTaskComment('')
    setShowTaskModal(true)
  }

  const submitTaskCompletion = async () => {
    if (!selectedTask || taskRating === 0 || taskComment.trim().length < 3) {
      showToast('Por favor califica y comenta la imagen', 'error')
      return
    }

    setSubmittingTask(true)
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]
      if (!token) return

      const res = await fetch('/api/user/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task_id: selectedTask.id,
          rating: taskRating,
          comment: taskComment.trim(),
        }),
      })

      const result = await res.json()

      if (res.ok) {
        showToast('Tarea completada', 'success')
        setShowTaskModal(false)
        setSelectedTask(null)
        fetchDailyTasks()
        if (result.all_completed) {
          setAllTasksCompleted(true)
          checkActivationStatus()
        }
      } else {
        showToast(result.error || 'Error al completar tarea', 'error')
      }
    } catch (error) {
      showToast('Error al completar tarea', 'error')
    } finally {
      setSubmittingTask(false)
    }
  }

  const checkActivationStatus = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]
      if (!token) return

      const res = await fetch('/api/user/activate-daily-profit', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const result = await res.json()
        setCanActivate(result.can_activate)
      }
    } catch (error) {
      console.error('Error checking activation status:', error)
    }
  }

  const playMoneySound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      // Helper para crear tonos
      const playTone = (frequency: number, startTime: number, duration: number, volume: number = 0.3, type: OscillatorType = 'sine') => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = frequency
        oscillator.type = type

        gainNode.gain.setValueAtTime(volume, audioContext.currentTime + startTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + duration)

        oscillator.start(audioContext.currentTime + startTime)
        oscillator.stop(audioContext.currentTime + startTime + duration)
      }

      // Sonido de caja registradora "Cha-ching"

      // "Cha" - Campana/Bell agudo
      playTone(1800, 0, 0.08, 0.4, 'sine')
      playTone(2200, 0.02, 0.08, 0.3, 'sine')

      // Click mecánico inicial
      playTone(150, 0.08, 0.03, 0.2, 'square')

      // "Ching" - Drawer opening (cajón abriéndose)
      playTone(600, 0.12, 0.15, 0.35, 'triangle')
      playTone(400, 0.14, 0.2, 0.3, 'sine')
      playTone(300, 0.16, 0.25, 0.25, 'sine')

      // Resonancia metálica
      playTone(1200, 0.15, 0.3, 0.15, 'sine')
      playTone(800, 0.18, 0.35, 0.12, 'sine')

      // Click mecánico final
      playTone(120, 0.35, 0.05, 0.18, 'square')
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const activateDailyProfit = async () => {
    if (activating || !canActivate) return

    setActivating(true)
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]

      if (!token) {
        showToast('Sesión expirada', 'error')
        setActivating(false)
        return
      }

      const res = await fetch('/api/user/activate-daily-profit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      const result = await res.json()

      if (res.status === 423) {
        // Bloqueado - ya activó, esperar nueva tarea
        showToast(result.message || 'Felicitaciones, espera tu nueva tarea', 'success')
        setCanActivate(false)
      } else if (res.ok) {
        // Éxito - reproducir sonido
        playMoneySound()
        showToast(`Ganancias activadas! +$${result.total_profit.toFixed(2)}`, 'success')
        setCanActivate(false)
        // Recargar dashboard y estado de activación
        setTimeout(() => {
          fetchDashboard()
          checkActivationStatus()
        }, 1000)
      } else {
        // Error - refrescar estado de activación para asegurar consistencia
        showToast(result.error || 'Error al activar ganancias', 'error')
        setTimeout(() => checkActivationStatus(), 500)
      }
    } catch (error) {
      console.error('Error activating profit:', error)
      showToast('Error al activar ganancias', 'error')
      // Refrescar estado en caso de error de red
      setTimeout(() => checkActivationStatus(), 500)
    } finally {
      setActivating(false)
    }
  }

  const fetchDashboard = async () => {
    setError(null)
    setMissingToken(false)
    setLoading(true)
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]

      if (!token) {
        setMissingToken(true)
        setError('Tu sesión expiró. Inicia sesión nuevamente.')
        return
      }

      const res = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401 || res.status === 403) {
        document.cookie = 'auth_token=; path=/; max-age=0'
        router.push('/login')
        return
      }

      if (!res.ok) {
        const errorPayload = await res.json().catch(() => null)
        const message = errorPayload?.error || 'No se pudo cargar el dashboard. Intenta nuevamente.'
        setError(message)
        return
      }

      const result = await res.json()
      setData(result)
      setShowAnnouncements(!!result?.announcements?.length)
    } catch (error) {
      console.error('Error fetching dashboard:', error)
      setError('Ocurrió un error al cargar los datos.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('La imagen debe ser menor a 5MB', 'error')
        return
      }
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUpdateProfileImage = async () => {
    if (!selectedFile) {
      showToast('Por favor selecciona una imagen', 'error')
      return
    }

    setUploadingPhoto(true)
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]

      if (!token) {
        showToast('Sesión expirada', 'error')
        setUploadingPhoto(false)
        return
      }

      // Convertir imagen a base64
      const reader = new FileReader()
      reader.readAsDataURL(selectedFile)

      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1]

          // Subir imagen al servidor
          const uploadRes = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 }),
          })

          if (!uploadRes.ok) {
            showToast('Error al subir la imagen', 'error')
            setUploadingPhoto(false)
            return
          }

          const uploadData = await uploadRes.json()
          const imageUrl = uploadData.url

          if (!imageUrl) {
            showToast('Error al obtener URL de imagen', 'error')
            setUploadingPhoto(false)
            return
          }

          // Guardar URL en la base de datos
          const res = await fetch('/api/user/profile-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ image_url: imageUrl }),
          })

          if (res.ok) {
            showToast('Foto de perfil actualizada', 'success')
            setShowPhotoModal(false)
            setSelectedFile(null)
            setPreviewUrl(null)
            fetchDashboard()
          } else {
            showToast('Error al actualizar la foto', 'error')
          }
        } catch (err) {
          console.error('Error in upload:', err)
          showToast('Error al subir la imagen', 'error')
        }
        setUploadingPhoto(false)
      }
    } catch (error) {
      console.error('Error updating profile image:', error)
      showToast('Error al actualizar la foto', 'error')
      setUploadingPhoto(false)
    }
  }


  const referralLink = data
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/signup?ref=${data.user.user_code}`
    : ''
  const referralCopyText = referralLink

  const copyReferralLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralCopyText)
        showToast('Link copiado', 'success')
        return
      }
    } catch (err) {
      // Fallback below
    }

    const textarea = document.createElement('textarea')
    textarea.value = referralCopyText
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'absolute'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    showToast(ok ? 'Link copiado' : 'No se pudo copiar el link', ok ? 'success' : 'error')
  }

  if (loading) return <div className="p-8 text-center text-primary animate-pulse">Cargando datos...</div>

  if (!data) {
    return (
      <div className="min-h-screen pb-20">
        <div className="max-w-screen-xl mx-auto p-6 space-y-6">
          <Card glassEffect>
            <div className="space-y-4 text-center">
              <p className="text-text-secondary">
                {error || 'Cargando información del dashboard...'}
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="primary" onClick={fetchDashboard}>
                  Reintentar
                </Button>
                {missingToken && (
                  <Button variant="outline" onClick={() => router.push('/login')}>
                    Ir a Login
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <ScreenshotProtection />
      <div className="max-w-screen-xl mx-auto p-4 space-y-4">
        {/* Header con perfil centrado */}
        <div className="flex flex-col items-center pt-2 pb-1">
          <button
            onClick={() => setShowPhotoModal(true)}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-[#34D399] to-[#0D1F1C] flex items-center justify-center text-white font-bold overflow-hidden hover:scale-105 transition-transform duration-300 relative"
            style={{
              boxShadow: '0 0 0 3px rgba(52, 211, 153, 0.3), 0 8px 24px rgba(0, 0, 0, 0.3)',
            }}
          >
            {data.user.profile_image_url ? (
              <img
                src={data.user.profile_image_url}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-bold">{data.user.username?.charAt(0).toUpperCase() || 'U'}</span>
            )}
          </button>
          <p className="mt-2 text-sm font-bold text-white tracking-wide">{data.user.full_name}</p>
          <p className="text-xs text-[#34D399]/70 font-medium">@{data.user.username}</p>
          <p className="mt-1 text-[10px] text-white/40 uppercase tracking-wider">
            Código: <span className="text-sm font-bold text-[#34D399] normal-case">{data.user.user_code}</span>
          </p>
          <p className="mt-1 text-[10px] text-white/30 break-all text-center max-w-[280px]">{referralLink}</p>
          <button
            onClick={copyReferralLink}
            className="mt-2 px-5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(52, 211, 153, 0.1))',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              color: '#34D399',
            }}
          >
            Copiar link
          </button>
        </div>

        {data.announcements.length > 0 && showAnnouncements && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
            <div className="max-w-xl w-full">
              <Card glassEffect>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-primary text-center w-full">
                    {data.announcements[0]?.title || 'Noticia'}
                  </h2>
                  <button
                    onClick={() => setShowAnnouncements(false)}
                    className="text-text-secondary hover:text-primary transition-colors text-sm"
                  >
                    Cerrar
                  </button>
                </div>
                <div className="space-y-3">
                  {data.announcements.map((item) => (
                    <div key={item.id} className="border-b border-card-border pb-3 last:border-b-0 last:pb-0 text-center">
                      <p className="text-sm text-text-secondary">{item.body}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Botones de navegación rápida */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/my-purchases')}
            className="relative overflow-hidden flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(145deg, rgba(13, 31, 28, 0.9), rgba(18, 37, 36, 0.85))',
              border: '1px solid rgba(52, 211, 153, 0.2)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
            }}
          >
            <span className="text-lg">👑</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">Mis Compras</span>
          </button>
          <button
            onClick={() => router.push('/network')}
            className="relative overflow-hidden flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(145deg, rgba(13, 31, 28, 0.9), rgba(18, 37, 36, 0.85))',
              border: '1px solid rgba(102, 187, 106, 0.2)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
            }}
          >
            <span className="text-lg">🌐</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#66BB6A]">Mi Red</span>
          </button>
        </div>

        {/* Resumen de Ganancias */}
        <EarningsChart
          totalEarnings={data.total_earnings}
          earningsHistory={data.earnings_history || []}
          referralBonusTotal={data.referral_bonus_total}
        />

        {/* Ganancia Diaria, Bonos Patrocinio, Bono Compartido y Bonos Extra */}
        <div className="grid grid-cols-4 gap-2">
          {/* Ganancia Diaria */}
          <button
            onClick={() => setShowDailyDetail(!showDailyDetail)}
            className="text-left glass-card !p-2.5 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-bold text-[#34D399] uppercase tracking-wider">G. Diaria</span>
              <svg
                className={`w-3 h-3 text-[#34D399]/50 transition-transform duration-300 ${showDailyDetail ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-lg font-bold text-[#34D399]">
              ${data.daily_profit.toFixed(2)}
            </p>
            <p className="text-[8px] text-white/30 mt-0.5">
              {data.has_active_vip ? 'JADE Activo' : 'Sin JADE'}
            </p>

            {/* Detalle expandible */}
            <div className={`overflow-hidden transition-all duration-300 ${showDailyDetail ? 'max-h-40 mt-2 pt-2 border-t border-white/10' : 'max-h-0'}`}>
              {data.has_active_vip ? (
                <div className="space-y-1">
                  {data.active_purchases.map((purchase) => (
                    <div
                      key={`${purchase.vip_package.level}-${purchase.vip_package.name}`}
                      className="flex justify-between text-[9px]"
                    >
                      <span className="text-white/60">✓ {purchase.vip_package.name}</span>
                      <span className="text-[#34D399] font-medium">${purchase.daily_profit_bs.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[9px] pt-1 border-t border-white/5">
                    <span className="text-white/40">Acum.</span>
                    <span className="text-white/60 font-medium">${data.daily_profit_total.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-[9px] text-white/50">
                    {data.active_vip_name
                      ? `${data.active_vip_name} ${data.active_vip_status === 'PENDING' ? 'PENDIENTE' : 'INACTIVO'}`
                      : 'Sin JADE activo'}
                  </p>
                  <p className="text-[9px] text-white/40">
                    Acum: ${data.daily_profit_total.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </button>

          {/* Bonos Patrocinio */}
          <button
            onClick={() => setShowBonusDetail(!showBonusDetail)}
            className="text-left glass-card !p-2.5 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-bold text-[#66BB6A] uppercase tracking-wider">Patrocinio</span>
              <svg
                className={`w-3 h-3 text-[#66BB6A]/50 transition-transform duration-300 ${showBonusDetail ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-lg font-bold text-[#66BB6A]">
              ${data.referral_bonus_total.toFixed(2)}
            </p>
            <p className="text-[8px] text-white/30 mt-0.5">
              5 niveles
            </p>

            {/* Detalle expandible */}
            <div className={`overflow-hidden transition-all duration-300 ${showBonusDetail ? 'max-h-40 mt-2 pt-2 border-t border-white/10' : 'max-h-0'}`}>
              {data.referral_bonus_levels.length > 0 && (
                <div className="space-y-1">
                  {data.referral_bonus_levels.map((item) => (
                    <div key={item.level} className="flex justify-between items-center text-[9px]">
                      <span className="text-white/50">Nv{item.level} <span className="text-[#34D399]">{item.percentage}%</span></span>
                      <span className="text-white/70 font-medium">${item.amount_bs.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </button>

          {/* Bono Compartido */}
          <button
            onClick={() => setShowSharedDetail(!showSharedDetail)}
            className="text-left glass-card !p-2.5 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-bold text-[#FFB74D] uppercase tracking-wider">Compartido</span>
              <svg
                className={`w-3 h-3 text-[#FFB74D]/50 transition-transform duration-300 ${showSharedDetail ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="text-lg font-bold text-[#FFB74D]">
              ${data.shared_bonus.toFixed(2)}
            </p>
            <p className="text-[8px] text-white/30 mt-0.5">
              {data.sponsor_name ? `de ${data.sponsor_name}` : '5% repartido'}
            </p>

            {/* Detalle expandible */}
            <div className={`overflow-hidden transition-all duration-300 ${showSharedDetail ? 'max-h-60 mt-2 pt-2 border-t border-white/10' : 'max-h-0'}`}>
              {data.shared_bonus_entries.length > 0 ? (
                <div className="space-y-1">
                  {data.shared_bonus_entries.map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[9px]">
                      <span className="text-white/50">
                        {new Date(entry.created_at).toLocaleDateString('es-BO', {
                          day: '2-digit', month: 'short',
                        })}
                      </span>
                      <span className="text-[#FFB74D] font-medium">+${entry.amount_bs.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-white/40 text-center">Sin bonos aún</p>
              )}
            </div>
          </button>

          {/* Bonos Extra */}
          <button
            onClick={() => setShowExtrasDetail(!showExtrasDetail)}
            className="text-left glass-card !p-2.5 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-bold text-[#AB47BC] uppercase tracking-wider">B. Extra</span>
              <svg
                className={`w-3 h-3 text-[#AB47BC]/50 transition-transform duration-300 ${showExtrasDetail ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className={`text-lg font-bold`} style={{ color: data.adjustments.total >= 0 ? '#AB47BC' : '#ff6464' }}>
              ${data.adjustments.total.toFixed(2)}
            </p>
            <p className="text-[8px] text-white/30 mt-0.5">
              {data.adjustments.items.length > 0 ? `${data.adjustments.items.length} movimientos` : 'Sin extras'}
            </p>

            {/* Detalle expandible */}
            <div className={`overflow-hidden transition-all duration-300 ${showExtrasDetail ? 'max-h-60 mt-2 pt-2 border-t border-white/10' : 'max-h-0'}`}>
              {data.adjustments.items.length > 0 ? (
                <div className="space-y-1">
                  {data.adjustments.items.map((adj, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[9px]">
                      <span className={`${adj.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {adj.description || adj.type}
                      </span>
                      <span className={`font-medium ${adj.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {adj.amount >= 0 ? '+' : ''}${adj.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-white/40 text-center">Sin bonos extra</p>
              )}
            </div>
          </button>
        </div>

        {/* Network & Referrals Row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="glass-card !p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(52, 211, 153, 0.15)' }}>
              <span className="text-sm">🌐</span>
            </div>
            <div>
              <p className="text-[8px] text-white/40 uppercase tracking-wider">Mi Red</p>
              <p className="text-lg font-bold text-[#34D399] leading-tight">{data.network_count}</p>
            </div>
          </div>
          <div className="glass-card !p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(102, 187, 106, 0.15)' }}>
              <span className="text-sm">👥</span>
            </div>
            <div>
              <p className="text-[8px] text-white/40 uppercase tracking-wider">Directos</p>
              <p className="text-lg font-bold text-[#66BB6A] leading-tight">{data.direct_referrals}</p>
            </div>
          </div>
        </div>

        {/* Ruleta de Premios */}
        <div className="glass-card !p-4 space-y-3">
          {/* Confetti container */}
          <div ref={rouletteConfettiRef} className="fixed inset-0 pointer-events-none z-50 overflow-hidden" />

          <div className="text-center">
            <h2
              className="text-xs font-bold tracking-wider"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                color: '#FFD700',
              }}
            >
              DUPLICA TUS GANANCIAS JUGANDO A LA RULETA
            </h2>
          </div>

          {/* Giro gratis por compra de paquete */}
          {rouletteData?.can_spin && rouletteData.eligible_purchases.length > 0 && (
            <button
              onClick={() => {
                if (!rouletteSpinning) {
                  setRouletteMode('free')
                  setRouletteResult('')
                  setRouletteError('')
                }
              }}
              disabled={rouletteSpinning}
              className="w-full py-2.5 px-4 rounded-xl text-center transition-all hover:scale-[1.02]"
              style={{
                background: rouletteMode === 'free'
                  ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 200, 255, 0.2))'
                  : 'linear-gradient(135deg, rgba(0, 255, 136, 0.08), rgba(0, 200, 255, 0.08))',
                border: rouletteMode === 'free'
                  ? '2px solid rgba(0, 255, 136, 0.5)'
                  : '1px solid rgba(0, 255, 136, 0.25)',
                boxShadow: rouletteMode === 'free' ? '0 0 15px rgba(0, 255, 136, 0.15)' : 'none',
              }}
            >
              <span className="text-[12px] font-bold text-[#00ff88]">
                🎁 Giro Gratis — {rouletteData.eligible_purchases[0].package_name}
              </span>
              <span className="block text-[10px] text-[#00ff88]/60 mt-0.5">
                {rouletteData.spins_available} {rouletteData.spins_available === 1 ? 'giro disponible' : 'giros disponibles'}
              </span>
            </button>
          )}

          {/* Montos de participación */}
          <div>
            {paidRouletteData && (
              <p className="text-[11px] font-bold text-center mb-1" style={{ color: '#00ff88' }}>
                Saldo: ${paidRouletteData.balance.toFixed(2)}
              </p>
            )}
            <p className="text-[10px] text-white/50 text-center mb-2">Elige tu entrada y duplica tus ganancias</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {ENTRY_AMOUNTS.map((amount) => {
                const isSelected = rouletteMode === 'paid' && selectedEntry === amount
                const canAfford = paidRouletteData ? paidRouletteData.balance >= amount : false
                return (
                  <button
                    key={amount}
                    onClick={() => {
                      if (!rouletteSpinning) {
                        setRouletteMode('paid')
                        setSelectedEntry(amount)
                        setRouletteResult('')
                        setRouletteError('')
                      }
                    }}
                    disabled={rouletteSpinning || !canAfford}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      !canAfford ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105'
                    }`}
                    style={isSelected ? {
                      background: 'linear-gradient(135deg, #FFD700, #FF8F00)',
                      border: '2px solid #FFD700',
                      color: '#0a0a0f',
                      boxShadow: '0 0 12px rgba(255, 215, 0, 0.4)',
                    } : {
                      background: 'rgba(255, 215, 0, 0.08)',
                      border: '2px solid rgba(255, 215, 0, 0.25)',
                      color: '#FFD700',
                    }}
                  >
                    ${amount}
                  </button>
                )
              })}
            </div>
          </div>

          {rouletteError && (
            <div className="text-center text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-3">
              {rouletteError}
            </div>
          )}

          {/* Wheel */}
          <div className="relative w-full max-w-[340px] aspect-square mx-auto">
            <div className="absolute inset-0">{rouletteParticles}</div>

            <div
              className="absolute w-[105%] h-[105%] top-1/2 left-1/2 rounded-full"
              style={{
                border: '3px solid transparent',
                background: 'linear-gradient(#0a0a0f, #0a0a0f) padding-box, linear-gradient(45deg, #00ffff, #ff00ff, #00ff88, #00ffff) border-box',
                animation: 'rotateBorder 4s linear infinite',
                transform: 'translate(-50%, -50%)',
              }}
            />

            <div
              className="absolute w-[102%] h-[102%] top-1/2 left-1/2 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, transparent 40%, rgba(0, 255, 255, 0.15) 50%, transparent 60%)',
                animation: 'pulseGlow 2s ease-in-out infinite',
                transform: 'translate(-50%, -50%)',
              }}
            />

            {/* Pointer */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 text-2xl"
              style={{
                color: '#00ffff',
                filter: 'drop-shadow(0 0 15px rgba(0, 255, 255, 0.8))',
                animation: 'pointerBounce 1s ease-in-out infinite',
              }}
            >
              ▼
            </div>

            {/* Wheel canvas */}
            <div
              className="absolute inset-[3%] rounded-full overflow-hidden"
              style={{
                boxShadow: 'inset 0 0 60px rgba(0, 255, 255, 0.2), 0 0 80px rgba(0, 255, 255, 0.15)',
                border: '2px solid rgba(0, 255, 255, 0.3)',
                transition: 'transform 30s cubic-bezier(0.17, 0.67, 0.12, 0.99)',
                transform: `rotate(${rouletteRotation}deg)`,
              }}
            >
              <canvas
                ref={rouletteCanvasRef}
                width="400"
                height="400"
                className="w-full h-full"
              />
            </div>

            {/* Center button */}
            <button
              onClick={handleSpinRoulette}
              disabled={!canSpinRoulette}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full z-30 flex items-center justify-center font-bold text-xs tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-110 active:scale-95"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: rouletteMode === 'paid'
                  ? 'linear-gradient(135deg, #FFD700, #FF8F00)'
                  : 'linear-gradient(135deg, #00ffff, #0088ff)',
                border: rouletteMode === 'paid'
                  ? '3px solid #FFD700'
                  : '3px solid #00ffff',
                color: '#0a0a0f',
                animation: canSpinRoulette ? 'buttonPulse 2s ease-in-out infinite' : 'none',
              }}
            >
              {rouletteSpinning ? '...' : rouletteMode === 'paid' ? `$${selectedEntry}` : 'SPIN'}
            </button>
          </div>

          {/* Result */}
          {rouletteResult && (
            <div
              className="text-center py-3 px-4 rounded-xl"
              style={{
                background: rouletteResultWon
                  ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.12), rgba(0, 200, 255, 0.08))'
                  : 'linear-gradient(135deg, rgba(255, 100, 100, 0.08), rgba(255, 170, 0, 0.05))',
                border: rouletteResultWon
                  ? '1px solid rgba(0, 255, 136, 0.4)'
                  : '1px solid rgba(255, 170, 0, 0.3)',
                animation: 'resultPop 0.4s ease-out',
              }}
            >
              {rouletteResultWon ? (
                <>
                  <p className="text-2xl font-bold" style={{ color: '#00ff88', animation: 'resultPop 0.5s ease-out' }}>
                    🎉 {rouletteResult} 🎉
                  </p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: '#00ff88' }}>
                    ¡Felicidades! Ganaste
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Agregado a tu billetera
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold" style={{ color: '#ffaa00' }}>
                    😅 {rouletteResult}
                  </p>
                  <p className="text-[11px] font-semibold mt-1" style={{ color: '#ffaa00' }}>
                    ¡Casi lo logras!
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    Inténtalo de nuevo, ¡el próximo puede ser el grande! 🍀
                  </p>
                </>
              )}
            </div>
          )}

          {/* Botón Ver Historial */}
          <div>
              <button
                onClick={() => setShowRouletteHistory(!showRouletteHistory)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.5)',
                }}
              >
                {showRouletteHistory ? '▲ Ocultar historial' : '▼ Ver historial'}
              </button>

              {showRouletteHistory && (
                <div className="mt-2 space-y-3">
                  {/* Historial Giro Gratis */}
                  {rouletteData?.history && rouletteData.history.length > 0 && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold" style={{ color: '#00ffff' }}>Giros Gratis</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(0, 255, 136, 0.1)',
                            border: '1px solid rgba(0, 255, 136, 0.3)',
                            color: '#00ff88',
                          }}
                        >
                          Total: ${rouletteData.total_winnings}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {rouletteData.history.slice(0, 5).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-1.5 px-2.5 rounded-lg"
                            style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                          >
                            <div>
                              <p className="text-[10px] font-medium text-white/70">{item.package_name}</p>
                              <p className="text-[9px] text-white/40">
                                {new Date(item.spun_at).toLocaleDateString('es-BO', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })}
                              </p>
                            </div>
                            <span className="text-xs font-bold" style={{ color: '#00ff88' }}>
                              +${item.won_bs}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Historial Participación Pagada */}
                  {paidRouletteData && paidRouletteData.history.length > 0 && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold" style={{ color: '#FFD700' }}>Participaciones</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: paidRouletteData.stats.net >= 0 ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 100, 100, 0.1)',
                            border: paidRouletteData.stats.net >= 0 ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid rgba(255, 100, 100, 0.3)',
                            color: paidRouletteData.stats.net >= 0 ? '#00ff88' : '#ff6464',
                          }}
                        >
                          Neto: {paidRouletteData.stats.net >= 0 ? '+' : ''}${paidRouletteData.stats.net.toFixed(2)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {paidRouletteData.history.slice(0, 5).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-1.5 px-2.5 rounded-lg"
                            style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                          >
                            <div>
                              <p className="text-[10px] font-medium text-white/70">Entrada: ${item.entry_amount}</p>
                              <p className="text-[9px] text-white/40">
                                {new Date(item.created_at).toLocaleDateString('es-BO', {
                                  day: '2-digit', month: 'short',
                                })}
                              </p>
                            </div>
                            <span className="text-xs font-bold" style={{ color: item.won ? '#00ff88' : '#ff6464' }}>
                              {item.prize_amount > 0 ? `+$${item.prize_amount}` : '$0'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Sin historial */}
                  {(!rouletteData?.history || rouletteData.history.length === 0) &&
                   (!paidRouletteData || paidRouletteData.history.length === 0) && (
                    <p className="text-[10px] text-white/30 text-center py-2">Aún no tienes giros registrados</p>
                  )}
                </div>
              )}
          </div>
        </div>

      </div>

      <p className="mt-6 text-xs text-white/30 text-center">
        © 2026 JADE · Powered by Optiver. Todos los derechos reservados.
      </p>

      {/* Botón flotante - WhatsApp */}
      <a
        href={`https://wa.me/${whatsappNumber || '59162464000'}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 right-2 z-40 w-12 h-12 bg-[#25D366] rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform duration-300 shadow-green-500/30"
        title="Contactar soporte vía WhatsApp"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      </a>

      {/* Modal - Foto de Perfil */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
          <div className="bg-card-bg rounded-2xl p-6 max-w-md w-full space-y-4 border border-card-border">
            <div className="flex items-center justify-between">
              <h3 className="text-primary font-bold">Actualizar foto de perfil</h3>
              <button
                onClick={() => {
                  setShowPhotoModal(false)
                  setSelectedFile(null)
                  setPreviewUrl(null)
                }}
                className="text-text-secondary hover:text-primary"
              >
                ✕
              </button>
            </div>
            <p className="text-text-secondary text-xs">
              Selecciona una foto desde tu dispositivo (máx. 5MB)
            </p>

            {/* Preview de la imagen */}
            <div className="flex justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-primary/50 flex items-center justify-center">
                  <span className="text-text-secondary text-xs text-center px-2">Sin foto</span>
                </div>
              )}
            </div>

            {/* Input de archivo */}
            <label className="block w-full cursor-pointer">
              <div className="w-full px-4 py-3 bg-gray-50 border border-card-border rounded-xl text-center hover:border-primary transition-colors">
                <span className="text-primary text-sm">
                  {selectedFile ? selectedFile.name : 'Seleccionar imagen'}
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            <Button
              variant="primary"
              className="w-full"
              onClick={handleUpdateProfileImage}
              disabled={uploadingPhoto || !selectedFile}
            >
              {uploadingPhoto ? 'Subiendo...' : 'Guardar foto'}
            </Button>
          </div>
        </div>
      )}


      {/* Modal de bienvenida - se muestra cada vez que se carga la página */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full rounded-2xl overflow-hidden" style={{
            background: 'linear-gradient(135deg, rgba(6, 20, 35, 0.98), rgba(10, 30, 50, 0.98))',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            boxShadow: '0 0 40px rgba(52, 211, 153, 0.15)',
          }}>
            <div className="p-5 text-center" style={{
              background: 'linear-gradient(180deg, rgba(52, 211, 153, 0.1), transparent)',
            }}>
              <div className="w-20 h-20 mx-auto mb-3">
                <img
                  src="https://i.ibb.co/pTMSXB7/Captura-de-pantalla-2026-02-08-111325-Photoroom.png"
                  alt="JADE Logo"
                  className="w-full h-full object-contain drop-shadow-lg"
                />
              </div>
              <h2 className="text-lg font-bold text-[#34D399] uppercase tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                JADE
              </h2>
            </div>

            <div className="px-5 pb-2 max-h-[55vh] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(52,211,153,0.3) transparent' }}>
              <div className="space-y-3 text-[11px] leading-relaxed text-white/75">
                <p>
                  <span className="text-[#34D399] font-bold">JADE</span> es una plataforma digital de inversión que permite a sus usuarios participar con montos desde <span className="text-white font-semibold">USD 2</span> hasta <span className="text-white font-semibold">USD 5.000</span>, conforme a su perfil y necesidad.
                </p>

                <p>
                  La plataforma <span className="text-[#34D399] font-bold">JADE</span> tambien participa en acciones de netflix y colaboramos en visualisar sus videotrailer de lanazamintos de series y peliculas.
                </p>

                <p>
                  Con el objetivo de fortalecer sus capacidades en mercados financieros internacionales, <span className="text-[#34D399] font-bold">JADE</span> mantiene una colaboración estratégica con <span className="text-white font-semibold">Optiver</span> para análisis y ejecución de estrategias en entornos de alta liquidez y con <span className="text-white font-semibold">Netflix</span> para Visualizar trailers de peliculas.
                </p>

                <p>
                  Dentro de la app, el usuario debe completar una tarea de participación consistente en la visualización de <span className="text-white font-semibold">4 tráilers de Netflix</span>.
                </p>

                <p>
                  El cumplimiento de esta tarea es un requisito para:
                </p>

                <div className="pl-3 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] mt-1 flex-shrink-0" />
                    <span>Aumetar la visibilidad de las nuevas peliculas de Netflix y para </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] mt-1 flex-shrink-0" />
                    <span>Habilitar la recepción de ganancias asociadas a la invercion, según los términos vigentes de la campaña.</span>
                  </div>
                </div>

                <p>
                  Adicionalmente, <span className="text-[#34D399] font-bold">JADE</span> podrá asignar parte de sus estrategias al sector de streaming, incluyendo <span className="text-white font-semibold">Netflix (NFLX)</span>, siempre de acuerdo con la política interna de inversión, la diversificación de cartera y el perfil de cada usuario.
                </p>
              </div>
            </div>

            <div className="p-5">
              <button
                onClick={() => setShowWelcomeModal(false)}
                className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.25), rgba(52, 211, 153, 0.1))',
                  border: '1px solid rgba(52, 211, 153, 0.5)',
                  color: '#34D399',
                  fontFamily: 'Orbitron, sans-serif',
                }}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
