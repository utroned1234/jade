'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import BottomNav from '@/components/ui/BottomNav'
import { useToast } from '@/components/ui/Toast'

interface VipPackage {
  id: number
  level: number
  name: string
  investment_bs: number
  daily_profit_bs: number
}

export default function BuyPackagePage() {
  const router = useRouter()
  const params = useParams()
  const packageId = params.id as string

  const [pkg, setPkg] = useState<VipPackage | null>(null)
  const [receipt, setReceipt] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [walletId, setWalletId] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [pkgRes, configRes] = await Promise.all([
        fetch(`/api/packages/${packageId}`),
        fetch('/api/payment-config'),
      ])

      if (pkgRes.ok) {
        const data = await pkgRes.json()
        setPkg(data)
      } else {
        setError('Paquete no encontrado')
      }

      if (configRes.ok) {
        const configData = await configRes.json()
        setWalletId(configData.binance_wallet_id || '')
        setQrUrl(configData.binance_qr_url || '')
      }
    } catch {
      setError('Error al cargar el paquete')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceipt(e.target.files[0])
    }
  }

  const copyWalletId = async () => {
    try {
      await navigator.clipboard.writeText(walletId)
      setCopied(true)
      showToast('ID de billetera copiado', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('No se pudo copiar', 'error')
    }
  }

  const downloadQr = () => {
    if (!qrUrl) return
    const link = document.createElement('a')
    link.href = qrUrl
    link.download = 'binance-qr.png'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSubmit = async () => {
    if (!receipt) {
      showToast('Por favor sube el comprobante de pago', 'error')
      return
    }

    setUploading(true)
    setError('')

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]

      if (!token) {
        router.push('/login')
        return
      }

      // Upload receipt to Supabase
      const formData = new FormData()
      formData.append('file', receipt)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!uploadRes.ok) {
        const uploadError = await uploadRes.json().catch(() => null)
        throw new Error(uploadError?.error || 'Error al subir comprobante')
      }

      const uploadPayload = await uploadRes.json()
      const url = uploadPayload.url

      // Create purchase
      const purchaseRes = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vip_package_id: parseInt(packageId),
          receipt_url: url,
        }),
      })

      if (!purchaseRes.ok) {
        const data = await purchaseRes.json()
        throw new Error(data.error || 'Error al crear compra')
      }

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Error al procesar la compra')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#34D399] mx-auto mb-3"></div>
          <p className="text-[#34D399] text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  if (error && !pkg) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 text-xl">{error}</p>
      </div>
    )
  }

  if (!pkg) return null

  // Estado: Compra enviada - Pendiente
  if (submitted) {
    return (
      <div className="min-h-screen pb-20">
        <div className="max-w-md mx-auto p-6 flex flex-col items-center justify-center min-h-[70vh]">
          <div className="glass-card !p-8 text-center space-y-5 w-full">
            {/* Icon reloj */}
            <div className="w-20 h-20 rounded-full bg-[#34D399]/20 flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-[#34D399]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-2">Solicitud Enviada</h2>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FBBF24]/15 border border-[#FBBF24]/30">
                <div className="w-2 h-2 rounded-full bg-[#FBBF24] animate-pulse" />
                <span className="text-sm font-semibold text-[#FBBF24]">PENDIENTE</span>
              </div>
            </div>

            <p className="text-white/60 text-sm leading-relaxed">
              Estamos revisando tu solicitud de pago. <br />
              Espere un momento, el administrador verificará tu comprobante.
            </p>

            <div className="pt-3 space-y-3">
              <button
                onClick={() => router.push('/my-purchases')}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-white text-sm transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)',
                }}
              >
                Ver Mis Compras
              </button>
              <button
                onClick={() => router.push('/paks')}
                className="w-full py-3.5 px-6 rounded-xl font-bold text-sm transition-all active:scale-95 border border-[#34D399]/30 text-[#34D399] hover:bg-[#34D399]/10"
              >
                Volver a Paquetes
              </button>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="text-center pt-2 pb-1">
          <h1 className="text-2xl font-bold text-white">{pkg.name}</h1>
          <p className="text-xs text-white/50 mt-1 uppercase tracking-wider">Completa tu compra</p>
        </div>

        {/* Detalles del paquete */}
        <div className="glass-card !p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-white/50 uppercase tracking-wider">Inversión</span>
            <span className="text-lg font-bold text-[#FBBF24]">${pkg.investment_bs} USDT</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/50 uppercase tracking-wider">Ganancia diaria</span>
            <span className="text-lg font-bold text-[#34D399]">${pkg.daily_profit_bs} USDT</span>
          </div>
        </div>

        {/* Paso 1: Pagar con Binance */}
        <div className="glass-card !p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#FBBF24]/20 flex items-center justify-center text-[#FBBF24] text-xs font-bold">1</span>
            <h2 className="text-sm font-bold text-[#FBBF24] uppercase tracking-wider">Pagar con Binance (USDT)</h2>
          </div>

          {/* QR */}
          {qrUrl ? (
            <div className="space-y-3">
              <p className="text-[10px] text-white/50 text-center uppercase tracking-wider">
                Escanea el QR con tu app de Binance
              </p>
              <div className="relative w-48 h-48 mx-auto bg-white rounded-2xl p-3">
                <img
                  src={qrUrl}
                  alt="QR Binance"
                  className="w-full h-full object-contain"
                />
              </div>
              <button
                onClick={downloadQr}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border border-[#34D399]/30 text-[#34D399] hover:bg-[#34D399]/10 transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar QR
              </button>
            </div>
          ) : (
            <div className="w-48 h-48 mx-auto bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
              <p className="text-white/40 text-xs text-center px-4">
                QR no disponible. Contacta al administrador.
              </p>
            </div>
          )}

          {/* Wallet ID */}
          {walletId && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/50 uppercase tracking-wider">O copia el ID de billetera</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs font-mono truncate">
                  {walletId}
                </div>
                <button
                  onClick={copyWalletId}
                  className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                  style={{
                    background: copied ? 'rgba(52, 211, 153, 0.2)' : 'rgba(52, 211, 153, 0.1)',
                    border: `1px solid ${copied ? 'rgba(52, 211, 153, 0.5)' : 'rgba(52, 211, 153, 0.3)'}`,
                    color: '#34D399',
                  }}
                >
                  {copied ? (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copiado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      Copiar
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Paso 2: Subir comprobante */}
        <div className="glass-card !p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#34D399]/20 flex items-center justify-center text-[#34D399] text-xs font-bold">2</span>
            <h2 className="text-sm font-bold text-[#34D399] uppercase tracking-wider">Subir Comprobante</h2>
          </div>

          <p className="text-[10px] text-white/50">
            Una vez realizado el pago, sube una captura del comprobante de transferencia.
          </p>

          <label className="block cursor-pointer">
            <div className={`w-full py-4 rounded-xl border-2 border-dashed text-center transition-all ${
              receipt
                ? 'border-[#34D399]/50 bg-[#34D399]/5'
                : 'border-white/15 hover:border-white/30'
            }`}>
              {receipt ? (
                <div className="space-y-1">
                  <svg className="w-8 h-8 text-[#34D399] mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xs text-[#34D399] font-semibold">{receipt.name}</p>
                  <p className="text-[10px] text-white/40">Toca para cambiar</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <svg className="w-8 h-8 text-white/30 mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-xs text-white/50">Seleccionar imagen</p>
                  <p className="text-[10px] text-white/30">PNG, JPG o captura de pantalla</p>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        {/* Botón confirmar */}
        <button
          onClick={handleSubmit}
          disabled={uploading || !receipt}
          className="w-full py-4 px-6 rounded-2xl font-bold text-white text-base transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            boxShadow: receipt ? '0 4px 20px rgba(16, 185, 129, 0.35)' : 'none',
          }}
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Procesando...
            </span>
          ) : (
            'Confirmar Compra'
          )}
        </button>
      </div>

      <p className="mt-6 text-xs text-white/30 text-center">
        &copy; 2026 JADE &middot; Powered by Optiver. Todos los derechos reservados.
      </p>

      <BottomNav />
    </div>
  )
}
