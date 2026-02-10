import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth/middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = requireAdmin(req)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    // Obtener últimos 50 giros pagados con datos del usuario
    const spins = await prisma.roulettePaidSpin.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            username: true,
            full_name: true,
          },
        },
      },
    })

    // Estadísticas globales
    const stats = await prisma.roulettePaidSpin.aggregate({
      _sum: {
        entry_amount: true,
        prize_amount: true,
      },
      _count: true,
    })

    const totalEntries = stats._sum.entry_amount || 0
    const totalPrizes = stats._sum.prize_amount || 0

    return NextResponse.json({
      spins: spins.map(s => ({
        id: s.id,
        username: s.user.username,
        full_name: s.user.full_name,
        entry_amount: s.entry_amount,
        prize_amount: s.prize_amount,
        won: s.won,
        session_id: s.session_id,
        created_at: s.created_at,
      })),
      stats: {
        total_spins: stats._count,
        total_entries: totalEntries,
        total_prizes: totalPrizes,
        platform_profit: totalEntries - totalPrizes,
      },
    })
  } catch (error) {
    console.error('Error fetching roulette history:', error)
    return NextResponse.json({ error: 'Error al cargar historial' }, { status: 500 })
  }
}
