import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'secret'
const MIN_INVESTMENT_FOR_ROULETTE = 50 // Mínimo $50 USD (VIP 5+) para acceder a la ruleta

// Premios disponibles — deben coincidir con PURCHASE_PRIZES del frontend
const PRIZES = [
  { text: '$2', value: 2 },
  { text: '$5', value: 5 },
  { text: '$10', value: 10 },
  { text: '$15', value: 15 },
  { text: '$20', value: 20 },
  { text: '$40', value: 40 },
  { text: '$80', value: 80 },
  { text: '$100', value: 100 },
  { text: '$200', value: 200 },
  { text: '$400', value: 400 },
]

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

// GET: Verificar elegibilidad para la ruleta
export async function GET(request: NextRequest) {
  const userId = getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // Buscar compras ACTIVAS con inversión >= $2000 USD que no hayan usado la ruleta
    const eligiblePurchases = await prisma.purchase.findMany({
      where: {
        user_id: userId,
        status: 'ACTIVE',
        investment_bs: { gte: MIN_INVESTMENT_FOR_ROULETTE },
        roulette_spun: false
      },
      include: {
        vip_package: true
      },
      orderBy: {
        investment_bs: 'desc'
      }
    })

    // Obtener total de giros disponibles
    const spinsAvailable = eligiblePurchases.length

    // Obtener historial de giros (compras que ya usaron la ruleta)
    const spunPurchases = await prisma.purchase.findMany({
      where: {
        user_id: userId,
        roulette_spun: true
      },
      include: {
        vip_package: true
      },
      orderBy: {
        updated_at: 'desc'
      }
    })

    // Calcular total ganado en ruleta
    const totalRouletteWinnings = spunPurchases.reduce((sum, p) => sum + (p.roulette_won_bs || 0), 0)

    return NextResponse.json({
      can_spin: spinsAvailable > 0,
      spins_available: spinsAvailable,
      eligible_purchases: eligiblePurchases.map(p => ({
        id: p.id,
        package_name: p.vip_package.name,
        investment_bs: p.investment_bs
      })),
      history: spunPurchases.map(p => ({
        id: p.id,
        package_name: p.vip_package.name,
        investment_bs: p.investment_bs,
        won_bs: p.roulette_won_bs,
        spun_at: p.updated_at
      })),
      total_winnings: totalRouletteWinnings,
      min_investment: MIN_INVESTMENT_FOR_ROULETTE
    })
  } catch (error) {
    console.error('Error checking roulette eligibility:', error)
    return NextResponse.json({ error: 'Error al verificar elegibilidad' }, { status: 500 })
  }
}

// POST: Procesar giro de ruleta
export async function POST(request: NextRequest) {
  const userId = getUserFromToken(request)
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { purchase_id, prize_index } = body

    // Validar que el premio existe
    if (prize_index === undefined || prize_index < 0 || prize_index >= PRIZES.length) {
      return NextResponse.json({ error: 'Premio inválido' }, { status: 400 })
    }

    const prize = PRIZES[prize_index]

    // Buscar la compra elegible
    let purchase

    if (purchase_id) {
      // Si se especifica un purchase_id, usarlo
      purchase = await prisma.purchase.findFirst({
        where: {
          id: purchase_id,
          user_id: userId,
          status: 'ACTIVE',
          investment_bs: { gte: MIN_INVESTMENT_FOR_ROULETTE },
          roulette_spun: false
        },
        include: {
          vip_package: true
        }
      })
    } else {
      // Si no, usar la primera compra elegible disponible
      purchase = await prisma.purchase.findFirst({
        where: {
          user_id: userId,
          status: 'ACTIVE',
          investment_bs: { gte: MIN_INVESTMENT_FOR_ROULETTE },
          roulette_spun: false
        },
        include: {
          vip_package: true
        },
        orderBy: {
          investment_bs: 'desc'
        }
      })
    }

    if (!purchase) {
      return NextResponse.json({
        error: 'No tienes giros disponibles. Necesitas un paquete JADE 5 o superior activo.',
        no_spins: true
      }, { status: 403 })
    }

    const prizeAmount = prize.value

    // Usar transacción para actualizar todo
    const result = await prisma.$transaction(async (tx) => {
      // Marcar la compra como que ya usó la ruleta
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          roulette_spun: true,
          roulette_won_bs: prizeAmount
        }
      })

      // Agregar el premio a la billetera del usuario
      const ledgerEntry = await tx.walletLedger.create({
        data: {
          user_id: userId,
          type: 'ROULETTE_WIN',
          amount_bs: prizeAmount,
          description: `Premio de ruleta - Paquete ${purchase.vip_package.name}`
        }
      })

      return { updatedPurchase, ledgerEntry }
    })

    // Contar giros restantes
    const remainingSpins = await prisma.purchase.count({
      where: {
        user_id: userId,
        status: 'ACTIVE',
        investment_bs: { gte: MIN_INVESTMENT_FOR_ROULETTE },
        roulette_spun: false
      }
    })

    return NextResponse.json({
      success: true,
      prize_amount: prizeAmount,
      package_name: purchase.vip_package.name,
      remaining_spins: remainingSpins,
      message: `¡Ganaste $${prizeAmount}! El premio fue agregado a tu billetera.`
    })

  } catch (error) {
    console.error('Error processing roulette spin:', error)
    return NextResponse.json({ error: 'Error al procesar el giro' }, { status: 500 })
  }
}
