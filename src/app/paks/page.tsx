'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/ui/BottomNav'
import ScreenshotProtection from '@/components/ui/ScreenshotProtection'

interface VipPackage {
  id: number
  level: number
  name: string
  investment_bs: number
  daily_profit_bs: number
  is_enabled: boolean
}

export default function PaksPage() {
  const router = useRouter()
  const [packages, setPackages] = useState<VipPackage[]>([])
  const [purchasedPackages, setPurchasedPackages] = useState<{ id: number; status: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPackages()
  }, [])

  const fetchPackages = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth_token='))
        ?.split('=')[1]

      if (token) {
        const purchasesRes = await fetch('/api/purchases/my', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (purchasesRes.ok) {
          const purchases = await purchasesRes.json()
          const paks = purchases
            .map((purchase: { vip_package_id: number; status: string }) => ({
              id: purchase.vip_package_id,
              status: purchase.status,
            }))
            .filter((p: { id: number }) => typeof p.id === 'number')
          setPurchasedPackages(paks)
        }
      }

      const res = await fetch('/api/packages', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (res.ok) {
        const data = await res.json()
        setPackages(data)
      }

    } catch (error) {
      console.error('Error fetching packages:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePercentage = (profit: number, investment: number) => {
    if (!investment || investment <= 0) return '0.00'
    return ((profit / investment) * 100).toFixed(2)
  }

  const calculateMonthly = (profit: number) => {
    return (profit * 30).toFixed(2)
  }

  const getPackageTier = (level: number) => {
    if (level <= 3) return { color: '#33e6ff', colorRgb: '51, 230, 255', bgFrom: 'rgba(6, 20, 35, 0.92)', bgTo: 'rgba(10, 35, 60, 0.88)' }
    if (level <= 6) return { color: '#818CF8', colorRgb: '129, 140, 248', bgFrom: 'rgba(12, 8, 30, 0.92)', bgTo: 'rgba(20, 18, 55, 0.88)' }
    if (level <= 9) return { color: '#C084FC', colorRgb: '192, 132, 252', bgFrom: 'rgba(18, 6, 28, 0.92)', bgTo: 'rgba(30, 15, 50, 0.88)' }
    return { color: '#FFD700', colorRgb: '255, 215, 0', bgFrom: 'rgba(25, 18, 5, 0.92)', bgTo: 'rgba(40, 30, 10, 0.88)' }
  }

  const getPackageIcon = (level: number) => {
    switch (level) {
      case 1: // Semilla
        return <>
          <path d="M7 20h10" />
          <path d="M10 20c0-4.4 3.6-8 8-8 0 4.4-3.6 8-8 8Z" />
          <path d="M14 20c0-4.4-3.6-8-8-8 0 4.4 3.6 8 8 8Z" />
        </>
      case 2: // Rayo
        return <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      case 3: // Escudo
        return <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      case 4: // Estrella
        return <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      case 5: // Gema
        return <>
          <path d="M6 3h12l4 6-10 13L2 9z" />
          <path d="M2 9h20" />
          <path d="M12 22L6 9l6-6 6 6z" />
        </>
      case 6: // Medalla
        return <>
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
        </>
      case 7: // Trofeo
        return <>
          <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0012 0V2z" />
        </>
      case 8: // Cohete
        return <>
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
          <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </>
      case 9: // Llama
        return <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
      case 10: // Diamante
        return <>
          <path d="M2.7 10.3a2.41 2.41 0 000 3.41l7.59 7.59a2.41 2.41 0 003.41 0l7.59-7.59a2.41 2.41 0 000-3.41L13.7 2.71a2.41 2.41 0 00-3.41 0z" />
          <path d="M8 12h8" />
          <path d="M12 8v8" />
        </>
      case 11: // Corona
        return <>
          <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
          <path d="M5 16h14v4H5z" />
        </>
      case 12: // Corona Real
        return <>
          <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
          <path d="M5 16h14v4H5z" />
          <circle cx="12" cy="1.5" r="1.5" fill="currentColor" />
          <circle cx="4" cy="2.5" r="1" fill="currentColor" />
          <circle cx="20" cy="2.5" r="1" fill="currentColor" />
        </>
      default:
        return <circle cx="12" cy="12" r="9" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="text-cyan-primary text-xl" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          <div className="inline-block animate-pulse">Cargando Paquetes...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20" style={{ fontFamily: 'Orbitron, sans-serif' }}>
      <ScreenshotProtection />
      <div className="max-w-screen-xl mx-auto p-6 space-y-8">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gold gold-glow uppercase tracking-wider mb-2">
            Paquetes JADE
          </h1>
          <p className="text-text-secondary text-sm uppercase tracking-widest">
            Elige tu nivel de inversión
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {packages.map((pkg) => {
            const purchasedData = purchasedPackages.find(p => p.id === pkg.id)
            const isPurchased = !!purchasedData
            const isDisabled = !pkg.is_enabled || isPurchased
            const tier = getPackageTier(pkg.level)

            return (
              <div
                key={pkg.id}
                className="relative group"
                style={{
                  background: `linear-gradient(135deg, ${tier.bgFrom}, ${tier.bgTo})`,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: `1px solid rgba(${tier.colorRgb}, 0.4)`,
                  borderRadius: '12px',
                  padding: '12px',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  overflow: 'hidden',
                  boxShadow: `0 4px 16px rgba(${tier.colorRgb}, 0.15)`,
                }}
                onClick={() => !isDisabled && router.push(`/paks/${pkg.id}/buy`)}
              >
                <div className="relative z-10 space-y-2">
                  {/* Icon + Title */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{
                        background: `linear-gradient(135deg, rgba(${tier.colorRgb}, 0.2), rgba(${tier.colorRgb}, 0.08))`,
                        border: `1px solid rgba(${tier.colorRgb}, 0.5)`,
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={tier.color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                        style={{ color: tier.color }}
                      >
                        {getPackageIcon(pkg.level)}
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xs font-bold uppercase" style={{ color: tier.color }}>
                        {pkg.name}
                      </h2>
                      <p className="text-[10px] text-text-secondary">
                        Nivel {pkg.level}
                      </p>
                    </div>
                  </div>

                  {/* Stats compactos */}
                  <div className="space-y-1 text-[10px] pt-2" style={{ borderTop: `1px solid rgba(${tier.colorRgb}, 0.2)` }}>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Inversión:</span>
                      <span className="font-bold text-white">${pkg.investment_bs.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Diario:</span>
                      <span className="font-bold" style={{ color: tier.color }}>${pkg.daily_profit_bs}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Mensual:</span>
                      <span className="font-bold" style={{ color: tier.color }}>${calculateMonthly(pkg.daily_profit_bs)}</span>
                    </div>
                  </div>

                  {/* Porcentaje grande */}
                  <div className="text-center py-1">
                    <span className="text-lg font-bold" style={{ color: tier.color }}>
                      {calculatePercentage(pkg.daily_profit_bs, pkg.investment_bs)}%
                    </span>
                  </div>

                  {/* Button */}
                  <button
                    disabled={isDisabled}
                    className="w-full py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all"
                    style={{
                      background: isDisabled
                        ? `rgba(${tier.colorRgb}, 0.1)`
                        : `linear-gradient(135deg, rgba(${tier.colorRgb}, 0.15), rgba(${tier.colorRgb}, 0.05))`,
                      border: `1px solid rgba(${tier.colorRgb}, ${isDisabled ? '0.2' : '0.5'})`,
                      color: isDisabled ? `rgba(${tier.colorRgb}, 0.4)` : tier.color,
                    }}
                  >
                    {isPurchased ? '✓ Comprado' : pkg.is_enabled ? 'Comprar' : 'No Disponible'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

      </div>

      <p className="mt-8 text-xs text-text-secondary text-center uppercase tracking-wider">
        © 2026 JADE · Powered by Optiver. Todos los derechos reservados.
      </p>

      <BottomNav />
    </div>
  )
}

