import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'secret'

// Configuración de entradas y premios
const PAID_ROULETTE_CONFIG: Record<number, {
  prizes: number[]
  maxWinIndex: number    // Índice máximo donde puede caer (nunca por encima)
  winIndices: number[]   // Índices donde cae cuando GANA
  loseIndices: number[]  // Índices donde cae cuando PIERDE
}> = {
  2: {
    prizes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 10],
    maxWinIndex: 3,      // nunca arriba de $3
    winIndices: [2, 3],  // $2, $3
    loseIndices: [0, 1], // $0, $1
  },
  5: {
    prizes: [0, 1, 2, 3, 4, 5, 6, 8, 10, 15],
    maxWinIndex: 5,          // nunca arriba de $6 (index 5 = $5, but index 5 value is 5)
    winIndices: [4, 5],      // $4, $5
    loseIndices: [0, 1],     // $0, $1
  },
  10: {
    prizes: [0, 2, 4, 6, 8, 10, 12, 14, 16, 20],
    maxWinIndex: 6,          // nunca arriba de $12
    winIndices: [4, 5, 6],   // $8, $10, $12
    loseIndices: [0, 1],     // $0, $2
  },
  20: {
    prizes: [0, 4, 8, 12, 16, 20, 24, 28, 32, 40],
    maxWinIndex: 6,          // nunca arriba de $24
    winIndices: [4, 5, 6],   // $16, $20, $24
    loseIndices: [0, 1],     // $0, $4
  },
  50: {
    prizes: [0, 5, 10, 15, 20, 30, 40, 55, 75, 100],
    maxWinIndex: 7,          // nunca arriba de $55
    winIndices: [5, 6, 7],   // $30, $40, $55
    loseIndices: [0, 1],     // $0, $5
  },
  100: {
    prizes: [0, 10, 20, 30, 40, 60, 80, 110, 150, 200],
    maxWinIndex: 7,          // nunca arriba de $110
    winIndices: [5, 6, 7],   // $60, $80, $110
    loseIndices: [0, 1],     // $0, $10
  },
  200: {
    prizes: [0, 20, 40, 60, 80, 120, 160, 220, 300, 400],
    maxWinIndex: 7,          // nunca arriba de $220
    winIndices: [5, 6, 7],   // $120, $160, $220
    loseIndices: [0, 1],     // $0, $20
  },
}

const VALID_ENTRY_AMOUNTS = [2, 5, 10, 20, 50, 100, 200]

function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    return decoded.userId
  } catch {
    return null
  }
}

// GET: Obtener historial de giros pagados del usuario
export async function GET(request: NextRequest) {
  const userId = getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // Obtener balance actual
    const ledgerSum = await prisma.walletLedger.aggregate({
      where: { user_id: userId },
      _sum: { amount_bs: true },
    })
    const balance = ledgerSum._sum.amount_bs || 0

    // Obtener historial de giros pagados (últimos 20)
    const history = await prisma.roulettePaidSpin.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 20,
    })

    // Estadísticas
    const stats = await prisma.roulettePaidSpin.aggregate({
      where: { user_id: userId },
      _sum: {
        entry_amount: true,
        prize_amount: true,
      },
      _count: true,
    })

    return NextResponse.json({
      balance,
      history: history.map(h => ({
        id: h.id,
        entry_amount: h.entry_amount,
        prize_amount: h.prize_amount,
        won: h.won,
        created_at: h.created_at,
      })),
      stats: {
        total_spins: stats._count,
        total_entries: stats._sum.entry_amount || 0,
        total_prizes: stats._sum.prize_amount || 0,
        net: (stats._sum.prize_amount || 0) - (stats._sum.entry_amount || 0),
      },
      entry_amounts: VALID_ENTRY_AMOUNTS,
      prizes_config: Object.fromEntries(
        VALID_ENTRY_AMOUNTS.map(amt => [amt, PAID_ROULETTE_CONFIG[amt].prizes])
      ),
    })
  } catch (error) {
    console.error('Error fetching paid roulette data:', error)
    return NextResponse.json({ error: 'Error al cargar datos' }, { status: 500 })
  }
}

// POST: Procesar giro pagado
export async function POST(request: NextRequest) {
  const userId = getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { entry_amount, session_id } = body

    // Validar entrada
    if (!entry_amount || !VALID_ENTRY_AMOUNTS.includes(entry_amount)) {
      return NextResponse.json({ error: 'Monto de entrada inválido' }, { status: 400 })
    }

    if (!session_id || typeof session_id !== 'string') {
      return NextResponse.json({ error: 'Session ID requerido' }, { status: 400 })
    }

    // Verificar balance
    const ledgerSum = await prisma.walletLedger.aggregate({
      where: { user_id: userId },
      _sum: { amount_bs: true },
    })
    const balance = ledgerSum._sum.amount_bs || 0

    if (entry_amount > balance) {
      return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 })
    }

    // Contar giros previos con este session_id
    const spinCount = await prisma.roulettePaidSpin.count({
      where: {
        user_id: userId,
        session_id: session_id,
      },
    })

    // Determinar si gana o pierde según el ciclo
    const config = PAID_ROULETTE_CONFIG[entry_amount]
    let shouldWin: boolean
    let prizeIndex: number

    if (spinCount === 0) {
      // Primer giro: GANA
      shouldWin = true
    } else if (spinCount === 1) {
      // Segundo giro: 50% de ganar
      shouldWin = Math.random() < 0.5
    } else {
      // Tercer giro en adelante: PIERDE
      shouldWin = false
    }

    if (shouldWin) {
      // Elegir un índice de premio ganador al azar
      prizeIndex = config.winIndices[Math.floor(Math.random() * config.winIndices.length)]
    } else {
      // Elegir un índice de premio perdedor al azar ($0 o monto pequeño)
      prizeIndex = config.loseIndices[Math.floor(Math.random() * config.loseIndices.length)]
    }

    const prizeAmount = config.prizes[prizeIndex]
    const won = prizeAmount > 0

    // Transacción: deducir entrada + agregar premio + registrar giro
    await prisma.$transaction(async (tx) => {
      // Deducir entrada de la billetera
      await tx.walletLedger.create({
        data: {
          user_id: userId,
          type: 'ROULETTE_ENTRY',
          amount_bs: -entry_amount,
          description: `Entrada ruleta $${entry_amount}`,
        },
      })

      // Si ganó algo, agregar premio
      if (prizeAmount > 0) {
        await tx.walletLedger.create({
          data: {
            user_id: userId,
            type: 'ROULETTE_PAID_WIN',
            amount_bs: prizeAmount,
            description: `Premio ruleta - Entrada $${entry_amount}`,
          },
        })
      }

      // Registrar el giro
      await tx.roulettePaidSpin.create({
        data: {
          user_id: userId,
          session_id: session_id,
          entry_amount: entry_amount,
          prize_amount: prizeAmount,
          won: won,
        },
      })
    })

    // Obtener nuevo balance
    const newLedgerSum = await prisma.walletLedger.aggregate({
      where: { user_id: userId },
      _sum: { amount_bs: true },
    })
    const newBalance = newLedgerSum._sum.amount_bs || 0

    return NextResponse.json({
      success: true,
      prize_index: prizeIndex,
      prize_amount: prizeAmount,
      entry_amount: entry_amount,
      won: won,
      new_balance: newBalance,
      spin_number: spinCount + 1,
      message: won
        ? `¡Ganaste $${prizeAmount}!`
        : prizeAmount === 0
          ? '¡Suerte la próxima vez!'
          : `Ganaste $${prizeAmount}`,
    })
  } catch (error) {
    console.error('Error processing paid roulette spin:', error)
    return NextResponse.json({ error: 'Error al procesar el giro' }, { status: 500 })
  }
}
