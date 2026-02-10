'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

interface Task {
  id: number
  position: number
  image_url: string
  is_active: boolean
}

interface TasksTabProps {
  token: string
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?#]+)/)
  return match ? match[1] : null
}

export default function TasksTab({ token }: TasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [urls, setUrls] = useState<{ [key: number]: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/admin/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setTasks(data.tasks || [])
        const urlMap: { [key: number]: string } = {}
        for (const task of data.tasks || []) {
          urlMap[task.position] = task.image_url
        }
        setUrls(urlMap)
      }
    } catch (err) {
      console.error('Error fetching tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (position: number) => {
    const url = urls[position]?.trim()
    if (!url) {
      setError('Ingresa una URL de YouTube')
      return
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      setError('URL de YouTube invalida. Usa formato: https://www.youtube.com/watch?v=...')
      return
    }

    setSaving(position)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ position, image_url: url }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al guardar')
      }

      setSuccess(`Video ${position} actualizado correctamente`)
      fetchTasks()
    } catch (err: any) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (position: number) => {
    if (!confirm('Eliminar este video?')) return

    try {
      const res = await fetch(`/api/admin/tasks?position=${position}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        setSuccess(`Video ${position} eliminado`)
        setUrls(prev => ({ ...prev, [position]: '' }))
        fetchTasks()
      } else {
        setError('Error al eliminar')
      }
    } catch (err) {
      setError('Error al eliminar')
    }
  }

  const getTaskByPosition = (position: number) => {
    return tasks.find(t => t.position === position)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gold mb-2">Tareas Diarias - Videos</h2>
        <p className="text-text-secondary text-sm">
          Pega 4 URLs de YouTube. Los usuarios deben ver cada video completo para activar sus ganancias.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-lg text-center text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500 text-green-300 px-4 py-2 rounded-lg text-center text-sm">
          {success}
        </div>
      )}

      <div className="space-y-4">
        {[1, 2, 3, 4].map(position => {
          const task = getTaskByPosition(position)
          const videoId = urls[position] ? extractVideoId(urls[position]) : null
          return (
            <Card key={position} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-gold font-bold">Video {position}</span>
                {task && <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded">Activo</span>}
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={urls[position] || ''}
                  onChange={(e) => setUrls(prev => ({ ...prev, [position]: e.target.value }))}
                  className="w-full rounded-lg p-3 text-sm"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(212, 175, 55, 0.2)',
                    color: '#D1FAE5',
                  }}
                />

                {videoId && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-black">
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                      alt={`Preview video ${position}`}
                      className="w-full h-full object-cover opacity-80"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    className="flex-1 text-xs"
                    onClick={() => handleSave(position)}
                    disabled={saving !== null}
                  >
                    {saving === position ? 'Guardando...' : task ? 'Actualizar Video' : 'Guardar Video'}
                  </Button>
                  {task && (
                    <button
                      type="button"
                      className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-50"
                      onClick={() => handleDelete(position)}
                      disabled={saving !== null}
                    >
                      X
                    </button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="p-4 bg-dark-lighter">
        <p className="text-xs text-text-secondary text-center">
          Al cambiar un video, todos los usuarios deben volver a verlo para poder activar ganancias.
          Los usuarios deben ver los 4 videos completos. Al terminar cada video aparece un boton de Netflix.
        </p>
      </Card>
    </div>
  )
}
