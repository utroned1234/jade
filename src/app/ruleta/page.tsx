'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import BottomNav from '@/components/ui/BottomNav';
import Card from '@/components/ui/Card';

interface RoulettePrize {
  text: string;
  color: string;
  value: number;
}

// ===== GIRO GRATIS (compra de paquete) =====
const PURCHASE_PRIZES: RoulettePrize[] = [
  { text: '$2', color: '#B71C1C', value: 2 },
  { text: '$5', color: '#0D47A1', value: 5 },
  { text: '$10', color: '#1B5E20', value: 10 },
  { text: '$15', color: '#E65100', value: 15 },
  { text: '$20', color: '#4A148C', value: 20 },
  { text: '$40', color: '#004D40', value: 40 },
  { text: '$80', color: '#880E4F', value: 80 },
  { text: '$100', color: '#BF360C', value: 100 },
  { text: '$200', color: '#1A237E', value: 200 },
  { text: '$400', color: '#FF6F00', value: 400 },
];

function getWeightedPrizeIndex(): number {
  const rand = Math.random();
  if (rand < 0.45) return 0;  // $2  - 45%
  if (rand < 0.85) return 1;  // $5  - 40%
  return 2;                    // $10 - 15%
}

// ===== PARTICIPACIÓN PAGADA =====
const SEGMENT_COLORS = [
  '#B71C1C', '#0D47A1', '#1B5E20', '#E65100', '#4A148C',
  '#004D40', '#880E4F', '#BF360C', '#1A237E', '#FF6F00',
];

const PAID_PRIZES: Record<number, number[]> = {
  2:   [0, 1, 2, 3, 4, 5, 6, 7, 8, 10],
  5:   [0, 1, 2, 3, 4, 5, 6, 8, 10, 15],
  10:  [0, 2, 4, 6, 8, 10, 12, 14, 16, 20],
  20:  [0, 4, 8, 12, 16, 20, 24, 28, 32, 40],
  50:  [0, 5, 10, 15, 20, 30, 40, 55, 75, 100],
  100: [0, 10, 20, 30, 40, 60, 80, 110, 150, 200],
  200: [0, 20, 40, 60, 80, 120, 160, 220, 300, 400],
};

const ENTRY_AMOUNTS = [2, 5, 10, 20, 50, 100, 200];

function getPaidPrizes(entryAmount: number): RoulettePrize[] {
  const values = PAID_PRIZES[entryAmount] || PAID_PRIZES[2];
  return values.map((v, i) => ({
    text: v === 0 ? '$0' : `$${v}`,
    color: SEGMENT_COLORS[i],
    value: v,
  }));
}

// ===== INTERFACES =====
interface RouletteHistory {
  id: string;
  package_name: string;
  investment_bs: number;
  won_bs: number;
  spun_at: string;
}

interface RouletteData {
  can_spin: boolean;
  spins_available: number;
  eligible_purchases: Array<{
    id: string;
    package_name: string;
    investment_bs: number;
  }>;
  history: RouletteHistory[];
  total_winnings: number;
  min_investment: number;
}

interface PaidSpinHistory {
  id: string;
  entry_amount: number;
  prize_amount: number;
  won: boolean;
  created_at: string;
}

interface PaidRouletteData {
  balance: number;
  history: PaidSpinHistory[];
  stats: {
    total_spins: number;
    total_entries: number;
    total_prizes: number;
    net: number;
  };
}

type RouletteMode = 'free' | 'paid';

export default function RouletteWheel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiContainerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState('');
  const [resultWon, setResultWon] = useState(true);

  // Modo: giro gratis vs participación pagada
  const [mode, setMode] = useState<RouletteMode>('free');

  // Estados giro gratis
  const [rouletteData, setRouletteData] = useState<RouletteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados participación pagada
  const [paidData, setPaidData] = useState<PaidRouletteData | null>(null);
  const [paidLoading, setPaidLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<number>(2);
  const [sessionId] = useState(() => {
    // Se genera una vez al montar el componente (recarga de página = nuevo sessionId)
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  });

  // Premios actuales según el modo
  const prizes = useMemo(() => {
    if (mode === 'paid') {
      return getPaidPrizes(selectedEntry);
    }
    return PURCHASE_PRIZES;
  }, [mode, selectedEntry]);

  // Obtener token
  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token') ||
      document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
  };

  // Cargar datos de elegibilidad (giro gratis)
  useEffect(() => {
    const fetchRouletteData = async () => {
      try {
        const token = getToken();
        if (!token) { setLoading(false); return; }

        const response = await fetch('/api/user/roulette', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          if (response.status === 401) { setLoading(false); return; }
          throw new Error('Error al cargar datos');
        }

        const data = await response.json();
        setRouletteData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchRouletteData();
  }, []);

  // Cargar datos de participación pagada
  useEffect(() => {
    const fetchPaidData = async () => {
      try {
        const token = getToken();
        if (!token) { setPaidLoading(false); return; }

        const response = await fetch('/api/user/roulette/paid', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setPaidData(data);
        }
      } catch (err) {
        console.error('Error fetching paid roulette data:', err);
      } finally {
        setPaidLoading(false);
      }
    };

    fetchPaidData();
  }, []);

  // Draw wheel on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2;
    const segmentAngle = (2 * Math.PI) / prizes.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    prizes.forEach((prize, index) => {
      const startAngle = index * segmentAngle - Math.PI / 2;
      const endAngle = startAngle + segmentAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = prize.color;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Arial';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(prize.text, radius - 20, 0);
      ctx.restore();
    });

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 50, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 12;
    ctx.stroke();
  }, [prizes]);

  // Create particles
  const particles = useMemo(() => {
    const particleElements = [];
    const numParticles = 40;
    const colors = ['#00ffff', '#ff00ff', '#00ff88', '#ffff00'];

    for (let i = 0; i < numParticles; i++) {
      const angle = (i / numParticles) * 2 * Math.PI;
      const x = Math.cos(angle) * 160;
      const y = Math.sin(angle) * 160;
      const color = colors[i % colors.length];

      particleElements.push(
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(${x}px, ${y}px)`,
            background: color,
            boxShadow: `0 0 10px ${color}`,
            animation: `ledBlink ${0.5 + Math.random()}s ease-in-out infinite`,
            animationDelay: `${i * 0.02}s`,
          }}
        />
      );
    }
    return particleElements;
  }, []);

  // Celebration function
  const celebrate = useCallback(() => {
    const confettiContainer = confettiContainerRef.current;
    if (!confettiContainer) return;

    const colors = ['#00ffff', '#ff00ff', '#00ff88', '#ffff00', '#ffd700'];
    for (let i = 0; i < 80; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confettiContainer.appendChild(confetti);

        setTimeout(() => confetti.remove(), 3000);
      }, i * 20);
    }
  }, []);

  // Función auxiliar para animar la ruleta a un índice dado
  const animateToIndex = useCallback((targetIndex: number, totalSegments: number) => {
    const segmentAngle = 360 / totalSegments;
    const segmentCenter = targetIndex * segmentAngle + (segmentAngle / 2);
    const targetFinalAngle = 360 - segmentCenter;
    const spins = Math.floor(Math.random() * 10) + 20;

    setRotation((currentRotation) => {
      const currentNormalized = ((currentRotation % 360) + 360) % 360;
      let additionalRotation = targetFinalAngle - currentNormalized;
      if (additionalRotation <= 0) {
        additionalRotation += 360;
      }
      const totalRotation = (spins * 360) + additionalRotation;
      return currentRotation + totalRotation;
    });
  }, []);

  // Spin function - GIRO GRATIS
  const spinFree = useCallback(async () => {
    if (isSpinning) return;
    if (!rouletteData?.can_spin) return;

    setIsSpinning(true);
    setResult('');
    setResultWon(true);
    setError('');

    const targetIndex = getWeightedPrizeIndex();
    animateToIndex(targetIndex, PURCHASE_PRIZES.length);

    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      const token = getToken();
      const wonPrize = PURCHASE_PRIZES[targetIndex];

      const response = await fetch('/api/user/roulette', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          purchase_id: rouletteData?.eligible_purchases[0]?.id,
          prize_index: targetIndex,
          prize_value: wonPrize.value,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar el giro');
      }

      const data = await response.json();
      setResult(`+$${data.prize_amount}`);
      setResultWon(true);
      celebrate();

      // Actualizar datos
      const updatedResponse = await fetch('/api/user/roulette', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (updatedResponse.ok) {
        setRouletteData(await updatedResponse.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el giro');
      setResult('');
    } finally {
      setIsSpinning(false);
    }
  }, [isSpinning, rouletteData, celebrate, animateToIndex]);

  // Spin function - PARTICIPACIÓN PAGADA
  const spinPaid = useCallback(async () => {
    if (isSpinning) return;
    if (!paidData || paidData.balance < selectedEntry) return;

    setIsSpinning(true);
    setResult('');
    setResultWon(true);
    setError('');

    try {
      const token = getToken();

      // Enviar al backend ANTES de animar - el backend decide el resultado
      const response = await fetch('/api/user/roulette/paid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          entry_amount: selectedEntry,
          session_id: sessionId,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar el giro');
      }

      const data = await response.json();
      const targetIndex = data.prize_index;

      // Animar la ruleta al índice que devolvió el backend
      const currentPrizes = getPaidPrizes(selectedEntry);
      animateToIndex(targetIndex, currentPrizes.length);

      // Esperar la animación (30 segundos)
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Mostrar resultado
      if (data.prize_amount > 0) {
        setResult(`+$${data.prize_amount}`);
        setResultWon(true);
        if (data.prize_amount >= selectedEntry) {
          celebrate();
        }
      } else {
        setResult('$0');
        setResultWon(false);
      }

      // Actualizar balance y datos
      setPaidData(prev => prev ? { ...prev, balance: data.new_balance } : prev);

      // Recargar historial completo
      const updatedResponse = await fetch('/api/user/roulette/paid', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (updatedResponse.ok) {
        setPaidData(await updatedResponse.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el giro');
      setResult('');
    } finally {
      setIsSpinning(false);
    }
  }, [isSpinning, paidData, selectedEntry, sessionId, celebrate, animateToIndex]);

  // Spin según modo
  const spin = mode === 'free' ? spinFree : spinPaid;

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpinning) {
        if (mode === 'free' && rouletteData?.can_spin) {
          e.preventDefault();
          spinFree();
        } else if (mode === 'paid' && paidData && paidData.balance >= selectedEntry) {
          e.preventDefault();
          spinPaid();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSpinning, spinFree, spinPaid, mode, rouletteData, paidData, selectedEntry]);

  const canSpin = mode === 'free'
    ? (rouletteData?.can_spin && !isSpinning)
    : (paidData && paidData.balance >= selectedEntry && !isSpinning);

  return (
    <div className="min-h-screen pb-24">
      <style jsx global>{`
        @keyframes ledBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes rotateBorder {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
        }

        @keyframes buttonPulse {
          0%, 100% { box-shadow: 0 0 30px rgba(0, 255, 255, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.2); }
          50% { box-shadow: 0 0 50px rgba(0, 255, 255, 0.9), inset 0 0 30px rgba(255, 255, 255, 0.4); }
        }

        @keyframes pointerBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .confetti-piece {
          position: absolute;
          width: 10px;
          height: 10px;
          animation: confettiFall 3s linear forwards;
          opacity: 0;
        }

        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(-100vh) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
        }
      `}</style>

      {/* Confetti Container */}
      <div
        ref={confettiContainerRef}
        className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      />

      <div className="max-w-screen-xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1
            className="text-2xl font-bold tracking-wider"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              background: 'linear-gradient(45deg, #00ffff, #ff00ff, #00ff88)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 30px rgba(0, 255, 255, 0.3)'
            }}
          >
            RULETA DE PREMIOS
          </h1>
        </div>

        {/* Tabs: Giro Gratis / Participación Pagada */}
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => { if (!isSpinning) { setMode('free'); setResult(''); setError(''); } }}
            disabled={isSpinning}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              mode === 'free'
                ? 'text-[#0a0a0f]'
                : 'text-white/50 hover:text-white/80'
            }`}
            style={mode === 'free' ? {
              background: 'linear-gradient(135deg, #00ffff, #0088ff)',
              border: '1px solid #00ffff',
            } : {
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            Giro Gratis
          </button>
          <button
            onClick={() => { if (!isSpinning) { setMode('paid'); setResult(''); setError(''); } }}
            disabled={isSpinning}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              mode === 'paid'
                ? 'text-[#0a0a0f]'
                : 'text-white/50 hover:text-white/80'
            }`}
            style={mode === 'paid' ? {
              background: 'linear-gradient(135deg, #FFD700, #FF8F00)',
              border: '1px solid #FFD700',
            } : {
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            Gana Jugando
          </button>
        </div>

        {/* ===== MODO GIRO GRATIS ===== */}
        {mode === 'free' && (
          <>
            <p className="text-white/40 text-xs text-center">Giro gratis por tu nueva compra</p>

            {rouletteData?.can_spin && rouletteData.eligible_purchases.length > 0 && (
              <div className="text-center">
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 143, 0, 0.1))',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                  }}
                >
                  <span className="text-[11px] font-bold text-[#FFD700]">
                    De tu nueva compra: {rouletteData.eligible_purchases[0].package_name}
                  </span>
                </div>
              </div>
            )}

            {!loading && (
              <div className="text-center">
                {rouletteData?.can_spin ? (
                  <div
                    className="inline-block px-4 py-2 rounded-full text-sm font-bold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(51, 230, 255, 0.2))',
                      border: '2px solid rgba(0, 255, 136, 0.5)',
                      color: '#00ff88',
                    }}
                  >
                    Giros disponibles: {rouletteData.spins_available}
                  </div>
                ) : (
                  <div
                    className="inline-block px-4 py-3 rounded-xl text-xs"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255, 170, 0, 0.1), rgba(255, 136, 0, 0.1))',
                      border: '2px solid rgba(255, 170, 0, 0.4)',
                      color: '#ffaa00',
                    }}
                  >
                    <p className="font-bold mb-1">Compra un paquete para obtener un giro gratis</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ===== MODO PARTICIPACIÓN PAGADA ===== */}
        {mode === 'paid' && (
          <>
            <p className="text-white/40 text-xs text-center">Elige tu entrada y gira para ganar</p>

            {/* Balance */}
            {!paidLoading && paidData && (
              <div className="text-center">
                <div
                  className="inline-block px-4 py-2 rounded-full text-sm font-bold"
                  style={{
                    background: 'rgba(0, 255, 136, 0.1)',
                    border: '1px solid rgba(0, 255, 136, 0.3)',
                    color: '#00ff88',
                  }}
                >
                  Saldo: ${paidData.balance.toFixed(2)}
                </div>
              </div>
            )}

            {/* Selección de entrada */}
            <div className="space-y-2">
              <p className="text-[11px] text-white/50 text-center font-medium uppercase tracking-wider">
                Selecciona tu entrada
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {ENTRY_AMOUNTS.map((amount) => {
                  const isSelected = selectedEntry === amount;
                  const canAfford = paidData ? paidData.balance >= amount : false;
                  return (
                    <button
                      key={amount}
                      onClick={() => { if (!isSpinning) setSelectedEntry(amount); }}
                      disabled={isSpinning || !canAfford}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        !canAfford ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105'
                      }`}
                      style={isSelected ? {
                        background: 'linear-gradient(135deg, #FFD700, #FF8F00)',
                        border: '2px solid #FFD700',
                        color: '#0a0a0f',
                        boxShadow: '0 0 15px rgba(255, 215, 0, 0.4)',
                      } : {
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '2px solid rgba(255, 255, 255, 0.15)',
                        color: 'rgba(255, 255, 255, 0.7)',
                      }}
                    >
                      ${amount}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="text-center text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-4">
            {error}
          </div>
        )}

        {/* Wheel Container */}
        <Card glassEffect className="!p-6">
          <div className="relative w-full max-w-[340px] aspect-square mx-auto">
            {/* Particle Ring */}
            <div className="absolute inset-0">
              {particles}
            </div>

            {/* Outer Rotating Ring */}
            <div
              className="absolute w-[105%] h-[105%] top-1/2 left-1/2 rounded-full"
              style={{
                border: '3px solid transparent',
                background: 'linear-gradient(#0a0a0f, #0a0a0f) padding-box, linear-gradient(45deg, #00ffff, #ff00ff, #00ff88, #00ffff) border-box',
                animation: 'rotateBorder 4s linear infinite',
                transform: 'translate(-50%, -50%)',
              }}
            />

            {/* Glow Ring */}
            <div
              className="absolute w-[102%] h-[102%] top-1/2 left-1/2 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, transparent 40%, rgba(0, 255, 255, 0.15) 50%, transparent 60%)',
                animation: 'pulse-glow 2s ease-in-out infinite',
                transform: 'translate(-50%, -50%)',
              }}
            />

            {/* Pointer */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 text-3xl"
              style={{
                color: '#00ffff',
                filter: 'drop-shadow(0 0 15px rgba(0, 255, 255, 0.8))',
                animation: 'pointerBounce 1s ease-in-out infinite',
              }}
            >
              ▼
            </div>

            {/* Wheel */}
            <div
              className="absolute inset-[3%] rounded-full overflow-hidden"
              style={{
                boxShadow: 'inset 0 0 60px rgba(0, 255, 255, 0.2), 0 0 80px rgba(0, 255, 255, 0.15)',
                border: '2px solid rgba(0, 255, 255, 0.3)',
                transition: 'transform 30s cubic-bezier(0.17, 0.67, 0.12, 0.99)',
                transform: `rotate(${rotation}deg)`,
              }}
            >
              <canvas
                ref={canvasRef}
                width="400"
                height="400"
                className="w-full h-full"
              />
            </div>

            {/* Center Button */}
            <button
              onClick={spin}
              disabled={!canSpin}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full z-30 flex items-center justify-center font-bold text-sm tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-110 active:scale-95"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: mode === 'paid'
                  ? 'linear-gradient(135deg, #FFD700, #FF8F00)'
                  : 'linear-gradient(135deg, #00ffff, #0088ff)',
                border: mode === 'paid'
                  ? '3px solid #FFD700'
                  : '3px solid #00ffff',
                color: '#0a0a0f',
                animation: canSpin ? 'buttonPulse 2s ease-in-out infinite' : 'none',
              }}
            >
              {isSpinning ? '...' : mode === 'paid' ? `$${selectedEntry}` : 'SPIN'}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div
              className="mt-6 text-center py-3 rounded-lg"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: resultWon ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 100, 100, 0.08)',
                border: resultWon ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid rgba(255, 100, 100, 0.3)',
              }}
            >
              <p className="text-2xl font-bold" style={{ color: resultWon ? '#00ff88' : '#ff6464' }}>{result}</p>
              <p className="text-xs text-white/50 mt-1">
                {resultWon ? 'Agregado a tu billetera' : 'Suerte la próxima vez'}
              </p>
            </div>
          )}
        </Card>

        {/* Instructions */}
        <Card className="!p-4">
          <div className="text-center space-y-2">
            <p className="text-xs text-white/50">
              Presiona <span className="text-gold font-bold">{mode === 'paid' ? `$${selectedEntry}` : 'SPIN'}</span> o la tecla <span className="text-gold font-bold">ESPACIO</span> para girar
            </p>
            {mode === 'paid' && (
              <p className="text-[10px] text-white/40">
                Se descontará ${selectedEntry} de tu saldo
              </p>
            )}
          </div>
        </Card>

        {/* ===== HISTORIAL GIRO GRATIS ===== */}
        {mode === 'free' && !loading && rouletteData?.history && rouletteData.history.length > 0 && (
          <Card className="!p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: '#00ffff' }}>Historial de premios</h3>
              <span
                className="text-xs font-bold px-2 py-1 rounded-full"
                style={{
                  background: 'rgba(0, 255, 136, 0.1)',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                  color: '#00ff88',
                }}
              >
                Total: ${rouletteData.total_winnings}
              </span>
            </div>
            <div className="space-y-2">
              {rouletteData.history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div>
                    <p className="text-xs font-medium text-white">{item.package_name}</p>
                    <p className="text-[10px] text-white/50">
                      {new Date(item.spun_at).toLocaleDateString('es-BO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#00ff88' }}>
                    +${item.won_bs}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ===== HISTORIAL PARTICIPACIÓN PAGADA ===== */}
        {mode === 'paid' && !paidLoading && paidData && paidData.history.length > 0 && (
          <Card className="!p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: '#FFD700' }}>Historial de participación</h3>
              <span
                className="text-xs font-bold px-2 py-1 rounded-full"
                style={{
                  background: paidData.stats.net >= 0 ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 100, 100, 0.1)',
                  border: paidData.stats.net >= 0 ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid rgba(255, 100, 100, 0.3)',
                  color: paidData.stats.net >= 0 ? '#00ff88' : '#ff6464',
                }}
              >
                Neto: {paidData.stats.net >= 0 ? '+' : ''}${paidData.stats.net.toFixed(2)}
              </span>
            </div>
            <div className="space-y-2">
              {paidData.history.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div>
                    <p className="text-xs font-medium text-white">
                      Entrada: ${item.entry_amount}
                    </p>
                    <p className="text-[10px] text-white/50">
                      {new Date(item.created_at).toLocaleDateString('es-BO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-sm font-bold"
                      style={{ color: item.won ? '#00ff88' : '#ff6464' }}
                    >
                      {item.prize_amount > 0 ? `+$${item.prize_amount}` : '$0'}
                    </span>
                    <p className="text-[9px]" style={{ color: item.won ? '#00ff88' : '#ff6464' }}>
                      {item.won ? 'Ganado' : 'Perdido'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <p className="mt-6 text-xs text-white/30 text-center">
        © 2026 JADE · Powered by Optiver. Todos los derechos reservados.
      </p>

      <BottomNav />
    </div>
  );
}
