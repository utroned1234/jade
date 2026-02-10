'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import BottomNav from '@/components/ui/BottomNav'
import { useToast } from '@/components/ui/Toast'

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: (() => void) | undefined
  }
}

interface DailyTask {
  id: number
  position: number
  image_url: string
  completed: boolean
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?#]+)/)
  return match ? match[1] : null
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function TareasPage() {
  const router = useRouter()
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [allTasksCompleted, setAllTasksCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null)
  const [videoEnded, setVideoEnded] = useState(false)
  const [videoDuration, setVideoDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoStarted, setVideoStarted] = useState(false)
  const [canActivate, setCanActivate] = useState(false)
  const [activating, setActivating] = useState(false)
  const [ytReady, setYtReady] = useState(false)
  const [hasNextTask, setHasNextTask] = useState(false)
  const [showNetflixBtn, setShowNetflixBtn] = useState(false)
  const [hasActivePackage, setHasActivePackage] = useState(true)
  const playerRef = useRef<any>(null)
  const timeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qualityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoCompletedRef = useRef(false)
  const autoCompleteRef = useRef<() => void>(() => {})
  const dailyTasksRef = useRef<DailyTask[]>([])
  const selectedTaskRef = useRef<DailyTask | null>(null)
  const { showToast } = useToast()

  // Keep refs in sync
  dailyTasksRef.current = dailyTasks
  selectedTaskRef.current = selectedTask

  const getToken = () => {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith('auth_token='))
      ?.split('=')[1]
  }

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtReady(true)
      return
    }

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (existingScript) {
      const checkReady = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setYtReady(true)
          clearInterval(checkReady)
        }
      }, 100)
      return () => clearInterval(checkReady)
    }

    window.onYouTubeIframeAPIReady = () => {
      setYtReady(true)
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }, [])

  useEffect(() => {
    fetchDailyTasks()
    checkActivationStatus()
  }, [])

  // Create YouTube player when modal opens or task changes
  useEffect(() => {
    if (!ytReady || !selectedTask || videoEnded) return

    const videoId = extractVideoId(selectedTask.image_url)
    if (!videoId) return

    const timeout = setTimeout(() => {
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch (e) {}
        playerRef.current = null
      }

      const playerDiv = document.getElementById('yt-player')
      if (!playerDiv) return

      playerRef.current = new window.YT.Player('yt-player', {
        videoId,
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          autoplay: 1,
          cc_load_policy: 0,
          vq: 'hd1080',
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            const duration = event.target.getDuration()
            setVideoDuration(duration)
            setVideoStarted(true)
            event.target.setPlaybackQuality('hd1080')
            event.target.playVideo()

            // Track current time, show Netflix at -15s, auto-complete at -8s
            timeIntervalRef.current = setInterval(() => {
              try {
                if (playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getDuration) {
                  const time = playerRef.current.getCurrentTime()
                  const dur = playerRef.current.getDuration()
                  setCurrentTime(time)
                  // Show Netflix button 15s before end
                  if (dur > 0 && time >= dur - 15) {
                    setShowNetflixBtn(true)
                  }
                  // Auto-complete 8s before end
                  if (dur > 0 && time >= dur - 8 && !autoCompletedRef.current) {
                    autoCompletedRef.current = true
                    try { playerRef.current.pauseVideo() } catch (e) {}
                    autoCompleteRef.current()
                  }
                }
              } catch (e) {}
            }, 200)

            // Continuously enforce 1080p every 3 seconds
            if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current)
            qualityIntervalRef.current = setInterval(() => {
              try {
                if (playerRef.current && playerRef.current.getPlaybackQuality) {
                  const currentQuality = playerRef.current.getPlaybackQuality()
                  if (currentQuality !== 'hd1080') {
                    playerRef.current.setPlaybackQuality('hd1080')
                  }
                }
              } catch (e) {}
            }, 3000)
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              if (!autoCompletedRef.current) {
                autoCompletedRef.current = true
                autoCompleteRef.current()
              }
            }
            if (event.data === window.YT.PlayerState.PLAYING) {
              try {
                event.target.setPlaybackQuality('hd1080')
              } catch (e) {}
            }
            if (event.data === window.YT.PlayerState.PAUSED) {
              if (!autoCompletedRef.current) {
                setTimeout(() => {
                  try {
                    if (playerRef.current && playerRef.current.playVideo && !autoCompletedRef.current) {
                      playerRef.current.playVideo()
                    }
                  } catch (e) {}
                }, 1000)
              }
            }
          },
          onPlaybackQualityChange: (event: any) => {
            if (event.data !== 'hd1080') {
              try {
                event.target.setPlaybackQuality('hd1080')
              } catch (e) {}
            }
          },
        },
      })
    }, 200)

    return () => {
      clearTimeout(timeout)
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current)
      if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current)
    }
  }, [ytReady, selectedTask, videoEnded])

  const fetchDailyTasks = async () => {
    try {
      const token = getToken()
      if (!token) {
        router.push('/login')
        return
      }

      const res = await fetch('/api/user/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const result = await res.json()
        setHasActivePackage(result.has_active_package !== false)
        setDailyTasks(result.tasks || [])
        setAllTasksCompleted(result.all_completed)
      }
    } catch (error) {
      console.error('Error fetching daily tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkActivationStatus = async () => {
    try {
      const token = getToken()
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

  const handleTaskClick = (task: DailyTask) => {
    if (task.completed) return
    autoCompletedRef.current = false
    setVideoEnded(false)

    setShowNetflixBtn(false)
    setSelectedTask(task)
    setVideoDuration(0)
    setCurrentTime(0)
    setVideoStarted(false)
  }

  const destroyPlayer = () => {
    if (playerRef.current) {
      try { playerRef.current.destroy() } catch (e) {}
      playerRef.current = null
    }
    if (timeIntervalRef.current) clearInterval(timeIntervalRef.current)
    if (qualityIntervalRef.current) clearInterval(qualityIntervalRef.current)
  }

  const closeModal = () => {
    destroyPlayer()
    setSelectedTask(null)
    setVideoEnded(false)

    setShowNetflixBtn(false)
    setCurrentTime(0)
    setVideoDuration(0)
    setVideoStarted(false)
  }

  const autoCompleteTask = async () => {
    const task = selectedTaskRef.current
    if (!task) return

    // Destroy player immediately to prevent YouTube end screen
    destroyPlayer()

    // Mark task complete via API
    try {
      const token = getToken()
      if (!token) return

      const res = await fetch('/api/user/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ task_id: task.id }),
      })

      const result = await res.json()

      if (res.ok) {
        showToast('Video completado', 'success')
        // Update local tasks to mark current as completed
        const updatedTasks = dailyTasksRef.current.map(t =>
          t.id === task.id ? { ...t, completed: true } : t
        )
        setDailyTasks(updatedTasks)
        dailyTasksRef.current = updatedTasks

        const remaining = updatedTasks.filter(t => !t.completed)
        setHasNextTask(remaining.length > 0)

        if (result.all_completed) {
          setAllTasksCompleted(true)
          setHasNextTask(false)
          checkActivationStatus()
        }
      } else {
        showToast(result.error || 'Error', 'error')
      }
    } catch (error) {
      showToast('Error al completar tarea', 'error')
    } finally {
      // Task completion finished
      setVideoEnded(true)
    }
  }

  // Keep ref updated so useEffect can call it
  autoCompleteRef.current = autoCompleteTask

  const openNetflix = () => {
    window.open('https://www.netflix.com', '_blank')
  }

  const goToNextTask = () => {
    const currentPos = selectedTaskRef.current?.position ?? 0
    const tasks = dailyTasksRef.current
    const sorted = [...tasks].filter(t => !t.completed).sort((a, b) => a.position - b.position)
    const next = sorted.find(t => t.position > currentPos) || sorted[0]
    if (next) {
      autoCompletedRef.current = false
      setVideoEnded(false)
  
      setShowNetflixBtn(false)
      setVideoDuration(0)
      setCurrentTime(0)
      setVideoStarted(false)
      setSelectedTask(next)
    }
  }

  const playMoneySound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
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
      playTone(1800, 0, 0.08, 0.4, 'sine')
      playTone(2200, 0.02, 0.08, 0.3, 'sine')
      playTone(150, 0.08, 0.03, 0.2, 'square')
      playTone(600, 0.12, 0.15, 0.35, 'triangle')
      playTone(400, 0.14, 0.2, 0.3, 'sine')
      playTone(300, 0.16, 0.25, 0.25, 'sine')
      playTone(1200, 0.15, 0.3, 0.15, 'sine')
      playTone(800, 0.18, 0.35, 0.12, 'sine')
      playTone(120, 0.35, 0.05, 0.18, 'square')
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const activateDailyProfit = async () => {
    if (activating || !canActivate) return

    setActivating(true)
    try {
      const token = getToken()
      if (!token) {
        showToast('Sesion expirada', 'error')
        setActivating(false)
        return
      }

      const res = await fetch('/api/user/activate-daily-profit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      const result = await res.json()

      if (res.status === 423) {
        showToast(result.message || 'Felicitaciones, espera tu nueva tarea', 'success')
        setCanActivate(false)
      } else if (res.ok) {
        playMoneySound()
        showToast(`Ganancias activadas! +$${result.total_profit.toFixed(2)}`, 'success')
        setCanActivate(false)
        setTimeout(() => {
          fetchDailyTasks()
          checkActivationStatus()
        }, 1000)
      } else {
        showToast(result.error || 'Error al activar ganancias', 'error')
        setTimeout(() => checkActivationStatus(), 500)
      }
    } catch (error) {
      console.error('Error activating profit:', error)
      showToast('Error al activar ganancias', 'error')
      setTimeout(() => checkActivationStatus(), 500)
    } finally {
      setActivating(false)
    }
  }

  const completedCount = dailyTasks.filter(t => t.completed).length
  const progress = videoDuration > 0 ? Math.min((currentTime / videoDuration) * 100, 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        <div className="p-8 text-center text-[#34D399] animate-pulse">Cargando tareas...</div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-screen-xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="text-center pt-4 pb-2">
          <h1 className="text-xl font-bold text-white tracking-wide">Tareas Diarias</h1>
          <p className="text-xs text-white/50 mt-1">Ve los 4 videos completos para activar tus ganancias</p>
        </div>

        {/* Progreso */}
        <div className="glass-card !p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-[#34D399] uppercase tracking-wider">Progreso</span>
            <span className="text-xs font-bold text-white">{completedCount}/{dailyTasks.length}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: dailyTasks.length > 0 ? `${(completedCount / dailyTasks.length) * 100}%` : '0%',
                background: allTasksCompleted
                  ? 'linear-gradient(90deg, #66BB6A, #43A047)'
                  : 'linear-gradient(90deg, #34D399, #059669)',
              }}
            />
          </div>
          {allTasksCompleted && (
            <p className="text-xs text-[#66BB6A] text-center mt-2 font-semibold">Todos los videos completados</p>
          )}
        </div>

        {/* Videos */}
        {dailyTasks.length > 0 ? (
          <div className="flex flex-col gap-3">
            {dailyTasks.map((task) => {
              const videoId = extractVideoId(task.image_url)
              return (
                <button
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="glass-card !p-0 overflow-hidden relative group w-full"
                  disabled={task.completed}
                >
                  <div className="aspect-video relative rounded-xl overflow-hidden">
                    {videoId && (
                      <img
                        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                        alt={`Video ${task.position}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {task.completed ? (
                      <div className="absolute inset-0 bg-[#0D1F1C]/70 flex items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#66BB6A] flex items-center justify-center">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-bold text-[#66BB6A]">Completado</span>
                          <p className="text-[10px] text-white/40">Video {task.position}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0D1F1C]/80 via-black/20 to-transparent flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:bg-white/30 transition-colors">
                          <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                        <span className="absolute bottom-3 left-3 text-xs font-bold text-[#34D399] uppercase tracking-wider px-3 py-1.5 rounded-full bg-[#0D1F1C]/60 border border-[#34D399]/30">
                          Video {task.position}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <Card>
            <div className="text-center py-8">
              <p className="text-white/50 text-sm">No hay videos disponibles por ahora</p>
              <p className="text-white/30 text-xs mt-1">Vuelve mas tarde</p>
            </div>
          </Card>
        )}

        {/* Boton de activar ganancias o ver paks */}
        {dailyTasks.length > 0 && (
          !hasActivePackage ? (
            <button
              onClick={() => router.push('/paks')}
              className="w-full py-4 px-6 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(52, 211, 153, 0.08))',
                border: '1px solid rgba(52, 211, 153, 0.5)',
                color: '#34D399',
                boxShadow: '0 0 16px rgba(52, 211, 153, 0.15)',
              }}
            >
              Ver Paks de Jade
            </button>
          ) : (
            <Button
              variant="primary"
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={activateDailyProfit}
              disabled={activating || !canActivate || (dailyTasks.length > 0 && !allTasksCompleted)}
            >
              <span className="flex items-center justify-center gap-2">
                {activating ? (
                  <>Activando...</>
                ) : dailyTasks.length > 0 && !allTasksCompleted ? (
                  <>Completa los videos primero</>
                ) : canActivate ? (
                  <>Activar mis ganancias diarias</>
                ) : (
                  <>Felicitaciones, espera tu nueva tarea</>
                )}
              </span>
            </Button>
          )
        )}
      </div>

      {/* Modal de Video */}
      {selectedTask && (
        <div className="fixed inset-0 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-4" onClick={videoEnded ? closeModal : undefined}>
          {/* Video 16:9 container */}
          {!videoEnded && (
            <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: '16/9' }}>
                {/* YouTube player */}
                <div
                  className="absolute inset-0"
                  style={{ transform: 'scale(1.04)', transformOrigin: 'center center' }}
                >
                  <div id="yt-player" className="w-full h-full" />
                </div>

                {/* Overlay to block top and bottom YouTube bars */}
                <div className="absolute top-0 left-0 right-0 h-10 bg-black z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-black z-10 pointer-events-none" />

                {/* Overlay to block all YouTube interactions (suggestions, clicks) */}
                <div className="absolute inset-0 z-20" />

                {/* Blur + Netflix button 15s before end */}
                {showNetflixBtn && (
                  <>
                    <div className="absolute inset-0 z-[25] backdrop-blur-md bg-black/30" />
                    <div className="absolute inset-0 z-30 flex items-center justify-center">
                      <button
                        onClick={openNetflix}
                        className="flex items-center gap-2 py-3 px-6 rounded-xl font-bold text-white text-sm transition-all active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #E50914 0%, #B20710 100%)',
                          boxShadow: '0 4px 20px rgba(229, 9, 20, 0.5)',
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24zm8.489 0v9.63L18.6 22.951c-.043.028-.06.006-.06.006 1.093-3.04 3.262-9.196 4.46-12.56V0zm-8.487 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24z"/>
                        </svg>
                        Ver Pelicula en Netflix
                      </button>
                    </div>
                  </>
                )}

                {/* Loading spinner */}
                {!videoStarted && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 rounded-2xl">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#34D399] mx-auto mb-2"></div>
                      <p className="text-white/60 text-xs">Cargando video...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress bar below video */}
              <div className="mt-3 px-1">
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #E50914, #FF6B6B)',
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-white/40 font-mono">
                    {formatTime(currentTime)}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono">
                    {videoDuration > 0 ? formatTime(videoDuration) : '--:--'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Video ended - buttons */}
          {videoEnded && (
            <div className="text-center space-y-5 p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="w-16 h-16 rounded-full bg-[#66BB6A] flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white text-lg font-bold">Tarea Completada</p>

              <button
                onClick={openNetflix}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-bold text-white text-base transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #E50914 0%, #B20710 100%)',
                  boxShadow: '0 4px 20px rgba(229, 9, 20, 0.4)',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24zm8.489 0v9.63L18.6 22.951c-.043.028-.06.006-.06.006 1.093-3.04 3.262-9.196 4.46-12.56V0zm-8.487 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24z"/>
                </svg>
                Ver Pelicula en Netflix
              </button>

              {hasNextTask ? (
                <button
                  onClick={goToNextTask}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-white text-base transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #34D399 0%, #059669 100%)',
                    boxShadow: '0 4px 20px rgba(52, 211, 153, 0.3)',
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Ver Siguiente Tarea
                </button>
              ) : (
                <div className="py-3 px-4 rounded-xl bg-[#66BB6A]/10 border border-[#66BB6A]/30">
                  <p className="text-[#66BB6A] text-sm font-semibold">Todos los videos completados</p>
                  <p className="text-white/40 text-xs mt-1">Ya puedes activar tus ganancias</p>
                </div>
              )}

              <button
                onClick={closeModal}
                className="w-full py-2 text-center text-white/40 text-xs"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-white/30 text-center">
        &copy; 2026 JADE &middot; Powered by Optiver. Todos los derechos reservados.
      </p>

      <BottomNav />
    </div>
  )
}
