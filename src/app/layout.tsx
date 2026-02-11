import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/context/ThemeContext'
import GlassBackground from '@/components/ui/GlassBackground'
import LogoutButton from '@/components/ui/LogoutButton'

export const viewport: Viewport = {
  themeColor: '#34D399',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'JADE',
  description: 'Plataforma JADE Premium - Sistema de Inversión',
  icons: {
    icon: [
      {
        url: 'https://i.ibb.co/pTMSXB7/Captura-de-pantalla-2026-02-08-111325-Photoroom.png',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: 'https://i.ibb.co/pTMSXB7/Captura-de-pantalla-2026-02-08-111325-Photoroom.png',
        type: 'image/png',
      },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TeknolaApp',
  },
}

// Iniciar cron jobs solo si esta habilitado por entorno
if (typeof window === 'undefined' && process.env.ENABLE_INTERNAL_CRON === 'true') {
  import('@/lib/cron').then(({ startDailyProfitCron }) => {
    startDailyProfitCron()
  })
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="font-outfit text-text-primary antialiased">
        <ToastProvider>
          <ThemeProvider>
            {/* Fondo de cristal moderno */}
            <GlassBackground />

            <div className="min-h-screen relative z-10">
              {/* Botón de logout flotante */}
              <div className="fixed top-4 right-4 z-50">
                <LogoutButton />
              </div>
              <main className="pb-20">
                {children}
              </main>
            </div>
          </ThemeProvider>
        </ToastProvider>
      </body>
    </html>
  )
}

