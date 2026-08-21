import React, { useState, useEffect } from 'react';
import { HeroCarousel } from './HeroCarousel';
import { RaffleCard } from './RaffleCard';
import { raffleService } from '../services/raffleService';
import { Raffle, RaffleStatus, Winner } from '../types';
import { Trophy, User, Sparkles, Zap, Users, Calendar, Hash, Ticket, Smartphone } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { imageSrc, handleImageError } from '../services/imagePlaceholder';

export const Home: React.FC = () => {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [recentWinners, setRecentWinners] = useState<Winner[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
        const data = await raffleService.getAllRaffles();
        setRaffles(data);
        const winnersData = await raffleService.getWinners();
        setRecentWinners(winnersData.slice(0, 6));
    } catch (e) {
        console.error("Failed to load data", e);
    }
  };

  
  const maskName = (name: string) => {
      if (!name) return 'Anônimo';
      const parts = name.trim().split(' ');
      return parts.map(part => {
          if (part.length <= 2) return part;
          return part.substring(0, 2) + '*'.repeat(3) + part.substring(part.length - 1);
      }).join(' ');
  };
  const maskPhone = (phone: string) => {
      if (!phone) return 'Não informado';
      const numbers = phone.replace(/\D/g, '');
      if (numbers.length >= 10) {
          const area = numbers.substring(0, 2);
          const firstPart = numbers.substring(2, 3);
          const lastPart = numbers.substring(numbers.length - 4);
          return `(${area}) ${firstPart}****-${lastPart}`;
      }
      return '***********';
  };
  const formatCurrency = (value?: number) => {
      if (!value) return null;
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const featuredRaffle = raffles.find(r => r.isFeatured) || raffles[0];
  const otherRaffles = raffles.filter(r => r.id !== featuredRaffle?.id);
  
  const otherActive = otherRaffles.filter(r => r.status === RaffleStatus.ACTIVE);
  const finishedRaffles = otherRaffles.filter(r => r.status === RaffleStatus.FINISHED);

  return (
    <div className="animate-in fade-in duration-500">
      {/* Banner Carousel */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <HeroCarousel />
      </div>

      {/* Featured Section */}
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-12">
        <div className="flex items-center gap-2 mb-6 text-brand-primary">
            <Zap size={20} fill="currentColor" />
            <h2 className="text-xl font-black uppercase tracking-tighter">Campanhas</h2>
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest ml-2">Escolha sua sorte</span>
        </div>

        {featuredRaffle && (
            <div className="mb-8">
                <RaffleCard 
                    raffle={featuredRaffle} 
                    variant="featured" 
                    onClick={(r) => navigate(`/rifa/${r.slug || r.id}`)} 
                />
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherActive.map(raffle => (
                <RaffleCard 
                    key={raffle.id} 
                    raffle={raffle} 
                    variant="grid"
                    onClick={(r) => navigate(`/rifa/${r.slug || r.id}`)} 
                />
            ))}
            {finishedRaffles.map(raffle => (
                <RaffleCard 
                    key={raffle.id} 
                    raffle={raffle} 
                    variant="grid"
                    onClick={(r) => navigate(`/rifa/${r.slug || r.id}`)} 
                />
            ))}
        </div>
            </div>

      {recentWinners.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 pt-12 pb-16 border-t border-zinc-900">
            <div className="flex items-center gap-2 mb-8 text-amber-500">
                <Trophy size={20} fill="currentColor" />
                <h2 className="text-xl font-black uppercase tracking-tighter">Últimos Ganhadores</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentWinners.map((winner, index) => (
                <div 
                  key={winner.id}
                  className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 flex items-center gap-3 hover:border-amber-500/30 transition-all group shadow-sm"
                >
                  <div className="w-12 h-12 flex-shrink-0 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden border border-zinc-800 group-hover:border-amber-500/50 transition-colors">
                    {winner.imageUrl ? (
                        <img src={imageSrc(winner.imageUrl)} onError={handleImageError} alt="Ganhador" className="w-full h-full object-cover" />
                    ) : (
                        <User size={20} className="text-zinc-700" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 mb-1">
                        {winner.prizeType === 'bilhete' ? (
                            <><Ticket className="text-amber-500 w-3.5 h-3.5" /><span className="text-amber-500 text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">Bilhete Premiado</span></>
                        ) : (
                            <><Trophy className="text-brand-primary w-3.5 h-3.5" /><span className="text-brand-primary text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">Sorteio Final</span></>
                        )}
                      </div>
                      <h3 className="text-white font-black uppercase tracking-tight text-sm truncate leading-none mb-1">{maskName(winner.userName || '')}</h3>
                      <p className="text-zinc-400 font-bold text-[11px] uppercase tracking-wide truncate leading-none" title={winner.prize}>{winner.prize}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
      )}
    </div>
  );
};