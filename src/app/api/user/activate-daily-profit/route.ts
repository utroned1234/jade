import { NextRequest, NextResponse } from 'next/server'
import { prisma, withRetry } from '@/lib/db'
import { requireAuth } from '@/lib/auth/middleware'

// La activación depende SOLO de las tareas completadas
// El admin controla cuándo se pueden activar subiendo nuevas imágenes de tareas

// Función auxiliar para verificar si el usuario completó todas las tareas actuales
async function hasCompletedAllTasks(userId: string): Promise<boolean> {
  // Obtener todas las tareas activas
  const tasks = await prisma.dailyTask.findMany({
    where: { is_active: true },
  })

  if (tasks.length === 0) {
    // Si no hay tareas, puede activar directamente
    return true
  }

  // Verificar que haya completado cada tarea DESPUÉS de su última actualización
  for (const task of tasks) {
    const completion = await prisma.taskCompletion.findFirst({
      where: {
        user_id: userId,
        task_id: task.id,
        completed_at: { gt: task.updated_at },
      },
    })

    if (!completion) {
      return false
    }
  }

  return true
}

// Función para verificar si ya activó con las tareas actuales
async function hasAlreadyActivatedForCurrentTasks(userId: string): Promise<boolean> {
  // Obtener la tarea más recientemente actualizada
  const latestTask = await prisma.dailyTask.findFirst({
    where: { is_active: true },
    orderBy: { updated_at: 'desc' },
  })

  if (!latestTask) {
    // Si no hay tareas, verificar si activó hoy
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayActivation = await prisma.walletLedger.findFirst({
      where: {
        user_id: userId,
        type: 'DAILY_PROFIT',
        created_at: { gte: today },
      },
    })

    return !!todayActivation
  }

  // Verificar si la última activación fue después de la última actualización de tareas
  const lastActivation = await prisma.walletLedger.findFirst({
    where: {
      user_id: userId,
      type: 'DAILY_PROFIT',
    },
    orderBy: { created_at: 'desc' },
  })

  if (!lastActivation) {
    return false
  }

  // Si activó después de que se actualizaron las tareas, ya no puede activar
  return lastActivation.created_at > latestTask.updated_at
}

export async function POST(req: NextRequest) {
  const authResult = requireAuth(req)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const userId = authResult.user.userId
    const now = new Date()

    // Verificar si ya activó para las tareas actuales
    const alreadyActivated = await hasAlreadyActivatedForCurrentTasks(userId)
    if (alreadyActivated) {
      return NextResponse.json(
        {
          error: 'Ya activaste tus ganancias',
          blocked: true,
          message: '🎉 Felicitaciones, espera tu nueva tarea',
        },
        { status: 423 }
      )
    }

    // Verificar si completó todas las tareas
    const tasksCompleted = await hasCompletedAllTasks(userId)
    if (!tasksCompleted) {
      return NextResponse.json(
        {
          error: 'Debes completar todas las tareas primero',
          blocked: true,
        },
        { status: 400 }
      )
    }

    // Obtener el usuario con sus compras activas
    const user = await withRetry(() =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          purchases: {
            where: { status: 'ACTIVE' },
            include: {
              vip_package: {
                select: {
                  daily_profit_bs: true,
                  name: true,
                },
              },
            },
          },
        },
      })
    )

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Verificar si tiene compras activas
    if (user.purchases.length === 0) {
      return NextResponse.json(
        { error: 'No tienes paquetes JADE activos' },
        { status: 400 }
      )
    }

    // Procesar ganancias para cada compra activa del usuario
    let totalProfit = 0
    const processedPackages: string[] = []

    // Procesar todas las compras en una sola transacción atómica
    await withRetry(() =>
      prisma.$transaction(async (tx) => {
        for (const purchase of user.purchases) {
          const effectiveProfit = purchase.vip_package?.daily_profit_bs ?? purchase.daily_profit_bs

          // Validar que el profit sea válido
          if (!effectiveProfit || effectiveProfit <= 0) {
            throw new Error(`Profit inválido para el paquete ${purchase.vip_package?.name || 'VIP'}`)
          }

          // Crear registro en wallet
          await tx.walletLedger.create({
            data: {
              user_id: userId,
              type: 'DAILY_PROFIT',
              amount_bs: effectiveProfit,
              description: `Ganancia diaria - ${purchase.vip_package?.name || 'VIP'}`,
            },
          })

          // Actualizar la compra
          await tx.purchase.update({
            where: { id: purchase.id },
            data: {
              last_profit_at: now,
              total_earned_bs: purchase.total_earned_bs + effectiveProfit,
              daily_profit_bs: effectiveProfit,
            },
          })

          totalProfit += effectiveProfit
          processedPackages.push(purchase.vip_package?.name || 'VIP')
        }
      })
    )

    return NextResponse.json({
      success: true,
      message: '🎉 Ganancias activadas exitosamente',
      total_profit: totalProfit,
      packages: processedPackages,
    })
  } catch (error) {
    console.error('Activate daily profit error:', error)
    return NextResponse.json(
      { error: 'Error al activar ganancias' },
      { status: 500 }
    )
  }
}

// Endpoint para verificar si el usuario puede activar
export async function GET(req: NextRequest) {
  const authResult = requireAuth(req)
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const userId = authResult.user.userId

    // Verificar si ya activó para las tareas actuales
    const alreadyActivated = await hasAlreadyActivatedForCurrentTasks(userId)

    // Verificar si completó todas las tareas
    const tasksCompleted = await hasCompletedAllTasks(userId)

    // Puede activar si: completó tareas Y no ha activado aún para estas tareas
    const canActivate = tasksCompleted && !alreadyActivated

    // Contar compras activas del usuario
    const activeCount = await withRetry(() =>
      prisma.purchase.count({
        where: { user_id: userId, status: 'ACTIVE' },
      })
    )

    return NextResponse.json({
      can_activate: canActivate,
      tasks_completed: tasksCompleted,
      already_activated: alreadyActivated,
      active_packages: activeCount,
    })
  } catch (error) {
    console.error('Check activation status error:', error)
    return NextResponse.json(
      { error: 'Error al consultar estado' },
      { status: 500 }
    )
  }
}
