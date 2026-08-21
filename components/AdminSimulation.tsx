import React, { useState, useEffect } from 'react';
import { Raffle } from '../types';
import { adminService as raffleService } from '../services/adminService';
import { Loader2, AlertTriangle, Calendar, Clock, Ticket, Smartphone, User, CheckCircle2, XCircle, Share2, Download } from 'lucide-react';
import { imageSrc, handleImageError } from '../services/imagePlaceholder';

interface AdminSimulationProps {
  raffles: Raffle[];
}

export const AdminSimulation: React.FC<AdminSimulationProps> = ({ raffles }) => {
  const [selectedRaffleId, setSelectedRaffleId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Custom Time State
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  
  // Custom Winning Number State
  const [customWinningNumber, setCustomWinningNumber] = useState('');
  const [availableWinningTickets, setAvailableWinningTickets] = useState<any[]>([]);
  const [isManualInput, setIsManualInput] = useState(false);

  // Fetch winning tickets when raffle changes
  useEffect(() => {
      if (!selectedRaffleId) {
          setAvailableWinningTickets([]);
          return;
      }

      const fetchWinning = async () => {
          const tickets = await raffleService.getPublicWinningTickets(selectedRaffleId);
          // Filter only unsold and active/unlocked tickets
          const unsold = tickets.filter(t => !t.won && t.isActive);
          setAvailableWinningTickets(unsold);
      };

      fetchWinning();
  }, [selectedRaffleId]);

  const [simulationResult, setSimulationResult] = useState<{
    numbers: number[];
    winningNumber: number | null;
    reservationTime: Date;
    expirationTime: Date;
    totalValue: number;
    raffle: Raffle;
  } | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRaffleId || !buyerName || !buyerPhone || quantity < 1) return;

    const raffle = raffles.find(r => r.id === selectedRaffleId);
    if (!raffle) return;

    setLoading(true);
    try {
      let reservationTime = new Date();
      
      if (useCustomTime && customDate && customTime) {
          // Use custom time
          reservationTime = new Date(`${customDate}T${customTime}`);
      } else {
          // Generate random times (1-3 hours ago)
          const now = new Date();
          const hoursAgo = Math.floor(Math.random() * 2) + 1; // 1 or 2 hours
          const minutesAgo = Math.floor(Math.random() * 60);
          
          reservationTime = new Date(now);
          reservationTime.setHours(now.getHours() - hoursAgo);
          reservationTime.setMinutes(now.getMinutes() - minutesAgo);
      }

      const expirationTime = new Date(reservationTime);
      expirationTime.setMinutes(reservationTime.getMinutes() + 15); // Expired 15 mins after reservation

      // 2. Fetch simulation numbers from backend
      const fetchedNumbers = await raffleService.getSimulationNumbers(selectedRaffleId);
      
      // Select random numbers from available ones
      let finalNumbers: number[] = [];
      const available = fetchedNumbers.length > 0 ? fetchedNumbers : Array.from({length: raffle.totalNumbers}, (_, i) => i);
      
      for (let i = 0; i < quantity; i++) {
          const randomIndex = Math.floor(Math.random() * available.length);
          finalNumbers.push(available[randomIndex]);
      }

      let finalWinningNumber: number | null = null;

      if (customWinningNumber) {
          const customWin = parseInt(customWinningNumber);
          if (!isNaN(customWin)) {
              finalWinningNumber = customWin;
              // Ensure the custom number is in the list
              if (!finalNumbers.includes(customWin)) {
                  if (finalNumbers.length > 0) {
                      // Replace the first one (or ensure we don't exceed quantity if we just added)
                      finalNumbers[0] = customWin;
                  } else {
                      finalNumbers = [customWin];
                  }
              }
              finalNumbers.sort((a, b) => a - b);
          }
      }

      setSimulationResult({
        numbers: finalNumbers,
        winningNumber: finalWinningNumber,
        reservationTime,
        expirationTime,
        totalValue: quantity * raffle.pricePerNumber,
        raffle
      });

    } catch (error: any) {
      console.error(error);
      alert('Erro ao gerar simulação: ' + (error.message || error.error_description || JSON.stringify(error)));
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (val?: string | null) => {
    if (!val) return '';
    let value = String(val).replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    }
    return value;
  };

  const maskPhone = (phone: string) => {
    if (!phone) return '';
    return phone.replace(/-\d{4}$/, '-****');
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
        <h3 className="text-xl font-bold text-white mb-2">Gerador de Simulação (Marketing)</h3>
        <p className="text-zinc-400 text-sm mb-6">
          Crie prints de "Reservas Expiradas" para gerar urgência. O sistema seleciona números disponíveis aleatórios e simula um pagamento não realizado.
        </p>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-2 md:col-span-1">
            <label className="label-admin">Selecionar Rifa</label>
            <select 
              className="input-admin" 
              value={selectedRaffleId} 
              onChange={e => setSelectedRaffleId(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {raffles.filter(r => r.status === 'ACTIVE').map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="label-admin">Quantidade de Cotas</label>
            <input 
              type="number" 
              className="input-admin" 
              value={quantity} 
              onChange={e => setQuantity(parseInt(e.target.value))}
              min={1}
              max={500}
              required
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="label-admin">Número Premiado (Opcional)</label>
            
            <select 
                className="input-admin mb-2"
                value={isManualInput ? 'manual' : customWinningNumber}
                onChange={(e) => {
                    if (e.target.value === 'manual') {
                        setIsManualInput(true);
                        setCustomWinningNumber('');
                    } else {
                        setIsManualInput(false);
                        setCustomWinningNumber(e.target.value);
                    }
                }}
            >
                <option value="">Aleatório / Nenhum específico</option>
                {availableWinningTickets.map(t => (
                    <option key={t.id} value={t.ticketNumber}>
                        {String(t.ticketNumber).padStart(6, '0')} - {t.prizeDescription}
                    </option>
                ))}
                <option value="manual">Digitar outro número...</option>
            </select>

            {isManualInput && (
                <input 
                    type="number" 
                    className="input-admin animate-in fade-in slide-in-from-top-1" 
                    value={customWinningNumber} 
                    onChange={e => setCustomWinningNumber(e.target.value)}
                    placeholder="Ex: 1500"
                    autoFocus
                />
            )}
            
            <p className="text-[10px] text-zinc-500 mt-1">Selecione um bilhete premiado disponível para simular que ele foi "perdido".</p>
          </div>

          <div>
            <label className="label-admin">Nome do Comprador (Fictício)</label>
            <input 
              className="input-admin" 
              value={buyerName} 
              onChange={e => setBuyerName(e.target.value)}
              placeholder="Ex: Carlos Oliveira"
              required
            />
          </div>

          <div>
            <label className="label-admin">Telefone (Fictício)</label>
            <input 
              className="input-admin" 
              value={buyerPhone} 
              onChange={e => setBuyerPhone(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              required
            />
          </div>

          <div className="col-span-2 bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
            <div className="flex items-center gap-2 mb-4">
                <input 
                    type="checkbox" 
                    id="useCustomTime"
                    checked={useCustomTime}
                    onChange={e => setUseCustomTime(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-900 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="useCustomTime" className="text-sm text-zinc-300 font-medium cursor-pointer select-none">
                    Definir Data e Hora da Reserva Manualmente
                </label>
            </div>

            {useCustomTime && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <label className="label-admin">Data da Reserva</label>
                        <input 
                            type="date" 
                            className="input-admin" 
                            value={customDate} 
                            onChange={e => setCustomDate(e.target.value)}
                            required={useCustomTime}
                        />
                    </div>
                    <div>
                        <label className="label-admin">Hora da Reserva</label>
                        <input 
                            type="time" 
                            className="input-admin" 
                            value={customTime} 
                            onChange={e => setCustomTime(e.target.value)}
                            required={useCustomTime}
                        />
                    </div>
                    <p className="col-span-2 text-xs text-zinc-500">
                        * A data de expiração será calculada automaticamente (15 minutos após a reserva).
                    </p>
                </div>
            )}
          </div>

          <div className="col-span-2 pt-4">
            <button 
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Gerar Simulação'}
            </button>
          </div>
        </form>
      </div>

      {/* PREVIEW AREA */}
      {simulationResult && (
        <div className="flex flex-col items-center animate-in slide-in-from-bottom-4">
          <h4 className="text-zinc-400 text-sm uppercase font-bold mb-4">Pré-visualização do Print</h4>
          
          {/* MOBILE SCREEN SIMULATION */}
          <div className="w-full max-w-[380px] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative">
            {/* Status Bar Fake */}
            <div className="h-6 bg-black flex justify-between items-center px-4 text-[10px] text-white">
                <span>19:42</span>
                <div className="flex gap-1">
                    <span>5G</span>
                    <span>100%</span>
                </div>
            </div>

            {/* Content */}
            <div className="p-5 bg-zinc-950 min-h-[600px] flex flex-col">
                
                {/* Header Warning */}
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-center">
                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-red-500">
                        <XCircle size={24} />
                    </div>
                    <h3 className="text-red-500 font-bold text-lg">Pagamento Expirado</h3>
                    <p className="text-red-400/80 text-xs mt-1">Esta reserva foi cancelada automaticamente.</p>
                </div>

                {/* Raffle Info */}
                <div className="flex gap-3 mb-6 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                    <img src={imageSrc(simulationResult.raffle.imageUrl)} onError={handleImageError} className="w-16 h-16 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300 uppercase font-bold mb-1">Referente a</p>
                        <p className="text-white font-bold text-sm truncate">{simulationResult.raffle.name}</p>
                        <p className="text-zinc-300 text-xs truncate">{simulationResult.raffle.description}</p>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <span className="text-zinc-300 text-sm">Comprador</span>
                        <span className="text-white font-bold text-sm">{buyerName}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <span className="text-zinc-300 text-sm">Telefone</span>
                        <span className="text-white font-bold text-sm">{maskPhone(buyerPhone)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <span className="text-zinc-300 text-sm">Reserva</span>
                        <span className="text-zinc-200 text-sm flex items-center gap-1">
                            <Calendar size={12} />
                            {simulationResult.reservationTime.toLocaleDateString()} {simulationResult.reservationTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <span className="text-zinc-300 text-sm">Expiração</span>
                        <span className="text-red-400 text-sm font-bold flex items-center gap-1">
                            <Clock size={12} />
                            {simulationResult.expirationTime.toLocaleDateString()} {simulationResult.expirationTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                     <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                        <span className="text-zinc-300 text-sm">Total ({quantity} cotas)</span>
                        <span className="text-brand-primary font-bold text-lg">R$ {simulationResult.totalValue.toFixed(2)}</span>
                    </div>
                </div>

                {/* Tickets Grid */}
                <div className="flex-1">
                    <p className="text-xs text-zinc-300 uppercase font-bold mb-3">Números Liberados</p>
                    <div className="flex flex-wrap gap-2 content-start">
                        {simulationResult.numbers.map(num => {
                            const isWinner = num === simulationResult.winningNumber;
                            return (
                                <span 
                                    key={num} 
                                    className={`
                                        font-mono text-xs px-2 py-1.5 rounded border 
                                        ${isWinner 
                                            ? 'bg-brand-primary text-black border-brand-primary-dark font-bold shadow-[0_0_10px_rgba(234,179,8,0.3)] animate-pulse' 
                                            : 'bg-zinc-900 text-zinc-200 border-zinc-700 opacity-80'
                                        }
                                    `}
                                >
                                    {String(num).padStart(6, '0')}
                                    {isWinner && <span className="ml-1">🏆</span>}
                                </span>
                            );
                        })}
                    </div>
                </div>

                {/* Footer Fake */}
                <div className="mt-6 pt-4 border-t border-zinc-800 text-center">
                    <p className="text-[10px] text-zinc-600">ID da Transação: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                </div>
            </div>
          </div>
          
          <p className="text-zinc-500 text-xs mt-4 max-w-md text-center">
            * Tire um print da área acima (Win+Shift+S ou PrintScreen) para usar no marketing.
          </p>
        </div>
      )}
    </div>
  );
};
