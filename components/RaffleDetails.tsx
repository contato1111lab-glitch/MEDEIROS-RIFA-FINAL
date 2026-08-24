import React, { useState, useEffect } from 'react';
import { metaPixelService } from "../services/metaPixelService";
import { Raffle, RaffleStatus, WinningTicket, RecentWinner } from '../types';
import { raffleService } from '../services/raffleService';
import { 
  Ticket, 
  Minus, 
  Plus, 
  ChevronDown, 
  Trophy,
  Check,
  Gift
} from 'lucide-react';
import { TopBuyersRanking } from './TopBuyersRanking';
import { CheckoutModal } from './CheckoutModal';
import { SuccessView } from './SuccessView';
import { motion } from 'motion/react';
import { imageSrc, handleImageError } from '../services/imagePlaceholder';

interface RaffleDetailsProps {
  raffle: Raffle;
  onBack: () => void;
  onBuy: (qty: number) => void;
}

export const RaffleDetails: React.FC<RaffleDetailsProps> = ({ raffle, onBack }) => {
  const minTicketsForOneReal = Math.ceil(1.00 / (raffle.pricePerNumber || 0.10));
  const effectiveMinPurchase = Math.max(raffle.minPurchase || 1, minTicketsForOneReal);
  
  const [quantity, setQuantity] = useState(effectiveMinPurchase);
  const [winningTickets, setWinningTickets] = useState<WinningTicket[]>([]);
  const [showDescription, setShowDescription] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [successData, setSuccessData] = useState<{ numbers: number[], purchaseId: string } | null>(null);

  useEffect(() => {
    setQuantity(effectiveMinPurchase);
  }, [effectiveMinPurchase]);

  useEffect(() => {
    metaPixelService.track('ViewContent', {
      content_ids: [raffle.id],
      content_type: 'product',
      content_name: raffle.name,
      value: raffle.pricePerNumber,
      currency: 'BRL'
    });
  }, [raffle.id, raffle.name, raffle.pricePerNumber]);


  useEffect(() => {
    raffleService.getPublicWinningTickets(raffle.id).then(setWinningTickets);
  }, [raffle.id]);

  // Real live countdown timer for drawDate
  useEffect(() => {
    if (!raffle.drawDate) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const targetTime = new Date(raffle.drawDate!).getTime();
      const now = new Date().getTime();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft("ENCERRADO");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const formattedHours = String(hours).padStart(2, '0');
      const formattedMins = String(minutes).padStart(2, '0');
      const formattedSecs = String(seconds).padStart(2, '0');

      setTimeLeft(`${formattedHours}:${formattedMins}:${formattedSecs}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [raffle.drawDate]);

  const handleBuy = (qty: number) => {
    metaPixelService.track('AddToCart', {
      content_ids: [raffle.id],
      content_type: 'product',
      content_name: raffle.name,
      value: qty * raffle.pricePerNumber,
      currency: 'BRL',
      num_items: qty
    });
    setQuantity(qty);
    setShowCheckout(true);
  };

  const handleSuccess = (numbers: number[], purchaseId: string) => {
    setShowCheckout(false);
    setSuccessData({ numbers, purchaseId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (successData) {
    return (
      <SuccessView 
        purchaseId={successData.purchaseId}
        raffleName={raffle.name}
        raffleImage={raffle.imageUrl}
        numbers={successData.numbers}
        totalValue={successData.numbers.length * raffle.pricePerNumber}
        onHome={() => window.location.hash = '#/'}
        onMyTickets={() => window.location.hash = '#/meus-bilhetes'}
      />
    );
  }

  const handleQuantityChange = (val: string) => {
    const numericVal = val.replace(/\D/g, '');
    if (numericVal === '') {
      setQuantity(0);
      return;
    }
    setQuantity(parseInt(numericVal));
  };

  const quickOptions = [
    { label: '+10', qty: 10 },
    { label: '+50', qty: 50, popular: true },
    { label: '+100', qty: 100 },
    { label: '+500', qty: 500 },
  ];

  return (
    <div className="animate-in fade-in duration-500 max-w-2xl mx-auto pb-12">
      {/* Main Image */}
      <div 
        className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-brand-border mb-4 protected-img-bg select-none"
        style={{ backgroundImage: `url("${raffle.imageUrl}")` }}
        data-protected-image
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <img 
          src={imageSrc(raffle.imageUrl)} onError={handleImageError} 
          alt={raffle.name} 
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          className="w-full h-full object-cover opacity-0 pointer-events-none select-none"
        />
        <div className="absolute inset-0 z-10 pointer-events-none" />
        <div className="absolute bottom-4 left-4 z-20">
            <span className="bg-brand-primary text-black text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg">
                Corre, compre agora!
            </span>
        </div>
      </div>

      {/* Title & Subtitle Section */}
      <div className="text-center px-4 mb-5">
        {raffle.description && raffle.description.toLowerCase() !== raffle.name.toLowerCase() && (
          <span className="inline-block bg-brand-primary/10 text-brand-primary-light border border-brand-primary/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
            {raffle.description}
          </span>
        )}
        <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight mb-3">
          {raffle.name}
        </h1>
        <div className="inline-flex items-center gap-2 px-5 py-2 bg-zinc-900 border border-brand-border rounded-xl shadow-inner">
          <span className="text-zinc-400 text-xs font-black uppercase tracking-widest">Por apenas</span>
          <span className="text-brand-primary-light font-black text-xl">R$ {raffle.pricePerNumber.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>

      {/* Optional Green Promo Banner */}
      {raffle.showPromoBanner !== false && (
        <div className="bg-brand-primary rounded-2xl p-6 text-black mb-6 relative overflow-hidden shadow-xl shadow-brand-primary/10">
          <div className="relative z-10 text-center">
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter leading-tight mb-3">
                  {raffle.promoBannerTitle || `${raffle.name} 🍀`}
              </h2>
              
              {raffle.drawDate && timeLeft && (
                <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-75">Encerra em</span>
                        <span className="text-2xl font-black tabular-nums">{timeLeft}</span>
                    </div>
                    <div className="flex-1 max-w-[160px] relative">
                        <div className="w-full h-5 bg-black/10 rounded-full overflow-hidden border border-black/5">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: '75%' }}
                                className="h-full bg-white/50 rounded-full" 
                            />
                        </div>
                    </div>
                </div>
              )}

              <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1.5 font-black uppercase tracking-tighter text-sm">
                      {raffle.promoBannerSubtitle || `Para compras acima de ${effectiveMinPurchase} cotas! 🚨`}
                  </div>
                  {raffle.drawDate && (
                    <span className="text-[10px] font-bold opacity-75">
                      Sorteio programado: {new Date(raffle.drawDate).toLocaleDateString('pt-BR')}
                    </span>
                  )}
              </div>
          </div>
        </div>
      )}

      <div className="bg-brand-card border border-brand-border rounded-2xl p-4 mb-6 text-center">
        <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">
            Quanto mais títulos, mais chances de ganhar!
        </p>
      </div>

      {/* Purchase Selectors */}
      {raffle.status === 'FINISHED' ? (
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-center mb-8">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Campanha Encerrada</h3>
            <p className="text-zinc-400 text-sm mb-4">Esta rifa já foi finalizada e não aceita novas compras.</p>
            {raffle.winnerNumber != null && (
                <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-4">
                    <span className="block text-brand-primary font-bold mb-1">🎉 NÚMERO GANHADOR</span>
                    <span className="text-3xl font-black text-white">{String(raffle.winnerNumber).padStart(String(raffle.totalNumbers - 1).length, '0')}</span>
                    {raffle.winnerName && <span className="block text-zinc-300 mt-2 font-bold">{raffle.winnerName}</span>}
                </div>
            )}
        </div>
      ) : (
        <>
            {/* Quick Selection Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                {quickOptions.map((opt) => {
                const optPrice = opt.qty * raffle.pricePerNumber;
                return (
                    <button
                        key={opt.label}
                        onClick={() => setQuantity(opt.qty)}
                        className={`relative p-5 rounded-xl border-2 transition-all text-center flex flex-col items-center justify-center gap-1 ${
                            quantity === opt.qty 
                            ? 'bg-brand-primary border-brand-primary text-black' 
                            : 'bg-brand-card border-brand-border text-white hover:border-brand-primary/50'
                        }`}
                    >
                        {opt.popular && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-brand-primary text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg">
                                Mais popular
                            </span>
                        )}
                        <span className="text-2xl font-black">{opt.label}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${quantity === opt.qty ? 'text-black/70' : 'text-zinc-400'}`}>
                            R$ {optPrice.toFixed(2).replace('.', ',')}
                        </span>
                        <span className={`text-[8px] font-black uppercase tracking-widest ${quantity === opt.qty ? 'text-black/50' : 'text-zinc-500'}`}>
                            SELECIONAR
                        </span>
                    </button>
                );
                })}
            </div>

            {/* Manual Selector */}
            <div className="flex flex-col gap-3 mb-8">
                <div className="flex items-center gap-2 bg-brand-card border border-brand-border rounded-2xl px-4 h-16">
                    <button onClick={() => setQuantity(q => Math.max(effectiveMinPurchase, q - 1))} className="w-10 h-10 rounded-full border border-brand-border flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                        <Minus size={20} />
                    </button>
                    <input 
                        type="tel"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(e.target.value)}
                        className="flex-1 bg-transparent text-center text-2xl font-black text-white outline-none"
                    />
                    <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 rounded-full border border-brand-border flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                        <Plus size={20} />
                    </button>
                </div>
                <button 
                    onClick={() => handleBuy(Math.max(quantity, effectiveMinPurchase))}
                    className="w-full bg-brand-primary hover:bg-brand-primary-dark text-black font-black rounded-2xl h-16 flex items-center justify-center gap-3 transition-all shadow-lg shadow-brand-primary/20 uppercase tracking-tighter text-lg"
                >
                    <div className="w-6 h-6 rounded-full border-2 border-black flex items-center justify-center">
                        <Check size={14} strokeWidth={4} />
                    </div>
                    <div className="flex flex-col items-center leading-none">
                    <div className="flex items-center gap-2">
                        Quero participar
                        <span className="ml-1">R$ {(Math.max(quantity, effectiveMinPurchase) * raffle.pricePerNumber).toFixed(2).replace('.', ',')}</span>
                    </div>
                    </div>
                </button>
            </div>
        </>
      )}

      {/* Description / Regulation Toggle */}
      <button 
        onClick={() => setShowDescription(!showDescription)}
        className="w-full flex items-center justify-center gap-2 py-4 text-white font-black uppercase tracking-widest text-[10px] border-y border-brand-border mb-8 transition-colors hover:text-brand-primary-light"
      >
        <ChevronDown size={16} className={`transition-transform ${showDescription ? 'rotate-180' : ''}`} />
        Regulamento da Rifa
      </button>

      {showDescription && (
        <div className="px-5 py-6 bg-brand-card rounded-2xl border border-brand-border mb-8 animate-in slide-in-from-top-4 duration-300">
            <h3 className="text-white font-black uppercase tracking-wider text-xs mb-3 text-brand-primary flex items-center gap-2">
              📜 Regulamento & Termos Oficiais
            </h3>
            {raffle.termsAndRules || raffle.fullDescription ? (
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">
                  {raffle.termsAndRules || raffle.fullDescription}
              </p>
            ) : (
              <div className="text-zinc-400 text-xs leading-relaxed space-y-2">
                <p>• O sorteio é realizado com base na extração da Loteria Federal ou sistema oficial da plataforma.</p>
                <p>• Proibida a participação e compra para menores de 18 anos.</p>
                <p>• O pagamento da cota é instantâneo via Pix com confirmação automática.</p>
                <p>• Dúvidas ou suporte, entre em contato diretamente pelos nossos canais de atendimento.</p>
              </div>
            )}
        </div>
      )}

      {/* Bilhetes Premiados - Render ONLY if winningTickets exist */}
      {winningTickets.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-brand-primary">
                  <span className="text-xl">🍀</span>
                  <h2 className="text-lg font-black uppercase tracking-tighter text-white">Bilhetes Premiados</h2>
              </div>
          </div>

          <div className="flex flex-col gap-3 w-full">
              {winningTickets.map((item, idx) => (
                  <div
                      key={item.id || idx}
                      className={`relative flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 ${
                          item.won 
                            ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 border-emerald-400 text-black shadow-lg shadow-green-500/20' 
                            : 'bg-brand-card/90 border-brand-border text-white hover:border-brand-primary/40'
                      }`}
                  >
                      <div className="flex items-center gap-3 min-w-0">
                          <div className={`px-2.5 py-1 rounded-lg font-mono font-black text-sm tracking-wide flex items-center gap-1 flex-shrink-0 ${
                              item.won 
                                ? 'bg-black/20 text-black border border-black/10' 
                                : 'bg-green-500/10 text-white border border-green-500/30'
                          }`}>
                              <span>#{String(item.ticketNumber).padStart(String(raffle.totalNumbers - 1).length, '0')}</span>
                          </div>
                          
                          <div className="min-w-0 flex flex-col">
                              <div className={`text-xs font-black uppercase tracking-tight flex items-center gap-1.5 ${
                                  item.won ? 'text-black' : 'text-white'
                              }`}>
                                  <Gift size={14} className={item.won ? 'text-black flex-shrink-0' : 'text-green-400 flex-shrink-0'} />
                                  <span className="truncate">{item.prizeDescription}</span>
                              </div>
                          </div>
                      </div>
                      <div className="ml-2 flex-shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              item.won 
                                ? 'bg-black/20 text-black shadow-sm' 
                                : 'bg-zinc-800 text-white border border-zinc-700/60'
                          }`}>
                              {item.won ? (
                                  <>
                                      <Trophy size={11} className="text-black" />
                                      Prêmio Já Ganho
                                  </>
                              ) : (
                                  <>
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-0.5"></span>
                                      Disponível
                                  </>
                              )}
                          </span>
                      </div>
                  </div>
              ))}
          </div>
        </div>
      )}

      {/* Top Buyers Ranking - Render ONLY if showRanking is true */}
      {raffle.showRanking !== false && (
        <div className="mb-12">
          <TopBuyersRanking 
            raffleId={raffle.id} 
            config={raffle.rankingConfig || []} 
            pricePerNumber={raffle.pricePerNumber} 
            startDate={raffle.rankingStartDate}
            endDate={raffle.rankingEndDate}
            manualEntries={raffle.manualRanking}
            rankingMinValue={raffle.rankingMinValue}
          />
        </div>
      )}

      {showCheckout && (
        <CheckoutModal 
            raffle={raffle}
            quantity={quantity}
            onClose={() => setShowCheckout(false)}
            onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};