import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

type DbClient = Prisma.TransactionClient | typeof prisma

async function applyReferralBonuses(
  client: DbClient,
  userId: string,
  investmentBs: number,
  level: number,
  multiplier: number
): Promise<void> {
  // Detener si excede 5 niveles (sistema de 5 niveles de patrocinio)
  if (level > 5) return

  // Buscar el usuario y su patrocinador
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { sponsor_id: true },
  })

  // Si no tiene patrocinador, terminar la cadena
  if (!user || !user.sponsor_id) return

  const actionLabel = multiplier < 0 ? 'Reverso' : 'Bono'

  // Nivel 1: Lógica especial - 10% directo + 5% repartido entre referidos directos
  if (level === 1) {
    // 10% directo al patrocinador
    const directBonus = (investmentBs * 10) / 100
    await client.walletLedger.create({
      data: {
        user_id: user.sponsor_id,
        type: 'REFERRAL_BONUS',
        amount_bs: directBonus * multiplier,
        description: `${actionLabel} de referido nivel 1 (10% directo)`,
      },
    })

    // 5% a repartir entre todos los referidos directos del patrocinador
    const sharedBonusTotal = (investmentBs * 5) / 100

    // Buscar todos los referidos directos del patrocinador
    const directReferrals = await client.user.findMany({
      where: { sponsor_id: user.sponsor_id },
      select: { id: true },
    })

    if (directReferrals.length > 0) {
      const bonusPerReferral = sharedBonusTotal / directReferrals.length

      // Pagar a cada referido directo su parte
      for (const referral of directReferrals) {
        await client.walletLedger.create({
          data: {
            user_id: referral.id,
            type: 'REFERRAL_BONUS',
            amount_bs: bonusPerReferral * multiplier,
            description: `${actionLabel} compartido nivel 1 (5% / ${directReferrals.length} referidos)`,
          },
        })
      }
    }
  } else {
    // Niveles 2-5: Lógica normal
    const bonusRule = await client.referralBonusRule.findUnique({
      where: { level },
    })

    if (bonusRule) {
      const bonusAmount = (investmentBs * bonusRule.percentage) / 100
      const amount = bonusAmount * multiplier

      await client.walletLedger.create({
        data: {
          user_id: user.sponsor_id,
          type: 'REFERRAL_BONUS',
          amount_bs: amount,
          description: `${actionLabel} de referido nivel ${level} (${bonusRule.percentage}%)`,
        },
      })
    }
  }

  // Continuar con el siguiente nivel en la cadena
  await applyReferralBonuses(client, user.sponsor_id, investmentBs, level + 1, multiplier)
}

// Versión que acepta un cliente de transacción externo
export async function payReferralBonusesWithClient(
  client: DbClient,
  userId: string,
  investmentBs: number,
  level: number = 1
): Promise<void> {
  await applyReferralBonuses(client, userId, investmentBs, level, 1)
}

// Versión standalone que crea su propia transacción
export async function payReferralBonuses(
  userId: string,
  investmentBs: number,
  level: number = 1
): Promise<void> {
  // Usar transacción para garantizar que todos los bonos se paguen o ninguno
  await prisma.$transaction(async (tx) => {
    await applyReferralBonuses(tx, userId, investmentBs, level, 1)
  })
}

export async function reverseReferralBonuses(
  client: DbClient,
  userId: string,
  investmentBs: number,
  level: number = 1
): Promise<void> {
  await applyReferralBonuses(client, userId, investmentBs, level, -1)
}
