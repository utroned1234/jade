'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
        return
      }

      document.cookie = `auth_token=${data.token}; path=/; max-age=${30 * 24 * 60 * 60}`
      router.push('/home')
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-8 md:p-10 animate-float">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2 font-outfit">Bienvenido</h1>
          <p className="text-text-secondary text-sm font-medium">
            Inicia sesión en tu cuenta
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Telefono o Email"
              type="text"
              required
              value={formData.identifier}
              onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
            />

          <Input
            label="Contraseña"
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />

          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-primary hover:text-primary-dark font-medium transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button type="submit" variant="primary" className="w-full shadow-glow" disabled={loading}>
            {loading ? 'Iniciando...' : 'Iniciar Sesión'}
          </Button>

          <p className="text-center text-text-secondary text-sm">
            ¿No tienes cuenta?{' '}
            <Link href="/signup" className="text-primary hover:text-primary-dark font-bold transition-colors">
              Regístrate
            </Link>
          </p>
        </form>

        <p className="mt-8 text-xs text-text-secondary text-center">
          © 2026 JADE · Powered by Optiver. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}
