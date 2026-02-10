'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import Card from '@/components/ui/Card'

export default function SignupClient({
  initialSponsorCode = '',
}: {
  initialSponsorCode?: string
}) {
  const router = useRouter()
  // Establecer 'CARLOS9092' como patrocinador por defecto si no viene de URL referida
  const defaultSponsorCode = initialSponsorCode || 'ADMIN001'
  const [formData, setFormData] = useState({
    sponsor_code: defaultSponsorCode,
    full_name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState({ username: '', password: '' })
  const { showToast } = useToast()
  // Siempre bloquear el campo de patrocinador
  const lockSponsor = true

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsor_code: formData.sponsor_code,
          full_name: formData.full_name,
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al registrarse')
        return
      }

      // Guardar credenciales y mostrar modal
      setCreatedCredentials({
        username: formData.username,
        password: formData.password,
      })
      setShowSuccessModal(true)
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Logo + Info */}
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-2xl animate-pulse" />
            <img
              src="https://i.ibb.co/pTMSXB7/Captura-de-pantalla-2026-02-08-111325-Photoroom.png"
              alt="JADE Logo"
              className="relative z-10 w-full h-full object-contain drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-widest text-white">
              J<span className="text-[#34D399]">A</span>DE
            </h1>
            <p className="mt-2 text-white/40 text-[10px] uppercase tracking-widest">
              Tu futuro financiero
            </p>
          </div>

          {/* Resumen de lo que verás */}
          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
              <span className="text-base">💰</span>
              <span className="text-[10px] text-white/70 leading-tight">Ganancias diarias en USDT</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
              <span className="text-base">👥</span>
              <span className="text-[10px] text-white/70 leading-tight">Red de referidos 5 niveles</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
              <span className="text-base">📊</span>
              <span className="text-[10px] text-white/70 leading-tight">Panel con historial de ingresos</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
              <span className="text-base">🎰</span>
              <span className="text-[10px] text-white/70 leading-tight">Ruleta de premios diarios</span>
            </div>
          </div>

          <p className="text-white/40 text-[9px] leading-relaxed max-w-xs mx-auto text-center">
            Compra paquetes JADE, completa tareas diarias y activa tus ganancias. Retira tus fondos cuando quieras.
          </p>

          <p className="text-white/35 text-[9px] leading-relaxed max-w-xs mx-auto text-center">
            Obtén hasta un 2.5% diario de retorno sobre tu inversión. Invita amigos y gana bonos de patrocinio en 5 niveles de profundidad.
          </p>

          <div className="max-w-xs mx-auto px-3 py-2 rounded-xl bg-[#34D399]/8 border border-[#34D399]/15">
            <p className="text-[#34D399]/80 text-[9px] leading-relaxed text-center">
              Solo por registrarte, puedes recibir ganancias cada vez que tu patrocinador active un paquete. Tu red trabaja por ti.
            </p>
          </div>
        </div>

        {/* Titulo Registro */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gold">Crear Cuenta</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Código de Patrocinador"
            type="text"
            value={formData.sponsor_code}
            onChange={(e) => setFormData({ ...formData, sponsor_code: e.target.value })}
            placeholder="Código de quien te invitó"
            readOnly={true}
            disabled={true}
          />

          <Input
            label="Nombre Completo"
            type="text"
            required
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          />

          <Input
            label="Teléfono"
            type="tel"
            required
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Ej: 70012345"
          />

          <Input
            label="Email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <Input
            label="Contraseña"
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />

          <Input
            label="Confirmar Contraseña"
            type="password"
            required
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          />

          {error && (
            <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-3 rounded-btn">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrarse'}
          </Button>

          <p className="text-center text-text-secondary">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-gold hover:text-gold-bright">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
      <p className="mt-8 text-xs text-text-secondary">
        © 2026 JADE · Powered by Optiver. Todos los derechos reservados.
      </p>

      {/* Modal de registro exitoso */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80">
          <Card glassEffect>
            <div className="text-center space-y-4 p-2">
              <div className="text-5xl mb-2">🎉</div>
              <h2 className="text-xl font-bold text-gold">¡Registro Exitoso!</h2>
              <p className="text-text-secondary text-sm">
                Tu cuenta ha sido creada correctamente. Guarda tus credenciales:
              </p>

              <div className="bg-dark-card border border-gold/30 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-text-secondary uppercase">Teléfono</p>
                  <p className="text-gold font-bold text-lg">{createdCredentials.username}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase">Contraseña</p>
                  <p className="text-gold font-bold text-lg">{createdCredentials.password}</p>
                </div>
              </div>

              <p className="text-xs text-text-secondary">
                Recuerda guardar estos datos en un lugar seguro
              </p>

              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  setShowSuccessModal(false)
                  router.push('/login')
                }}
              >
                Aceptar e Iniciar Sesión
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
