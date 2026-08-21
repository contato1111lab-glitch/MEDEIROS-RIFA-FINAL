import React, { useEffect, useState } from 'react';
import { Trophy, User, Calendar, Hash, Ticket, Smartphone } from 'lucide-react';
import { motion } from 'motion/react';
import { raffleService } from '../services/raffleService';
import { Winner } from '../types';
import { imageSrc, handleImageError } from '../services/imagePlaceholder';

export const WinnersPage: React.FC = () => {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    raffleService.getWinners().then(data => {
      setWinners(data);
      setLoading(false);
    });
  }, []);

  // Helpers to mask data
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="text-brand-primary font-black uppercase tracking-widest animate-pulse">Carregando ganhadores...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-2xl"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🎉</span>
                <div className="flex items-baseline gap-2">
                <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Ganhadores</h1>
                </div>
            </div>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Os felizardos das nossas campanhas</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {winners.map((winner, index) => (
            <motion.div 
              key={winner.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-brand-primary/30 transition-all group shadow-xl"
            >
              {/* Type Badge */}
              <div className="bg-zinc-900 px-4 py-2 flex items-center justify-between border-b border-zinc-800/50">
                  <div className="flex items-center gap-2">
                    {winner.prizeType === 'bilhete' ? (
                        <><Ticket className="text-amber-500 w-4 h-4" /><span className="text-amber-500 text-[10px] font-black uppercase tracking-widest">Bilhete Premiado</span></>
                    ) : (
                        <><Trophy className="text-brand-primary w-4 h-4" /><span className="text-brand-primary text-[10px] font-black uppercase tracking-widest">Ganhador da Rifa</span></>
                    )}
                  </div>
                  <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(winner.drawDate).toLocaleDateString('pt-BR')}
                  </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                  {/* Photo */}
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-zinc-900 flex items-center justify-center flex-shrink-0 overflow-hidden border border-zinc-800 group-hover:border-brand-primary/50 transition-colors shadow-inner relative">
                    {winner.imageUrl ? (
                        <img src={imageSrc(winner.imageUrl)} onError={handleImageError} alt="Ganhador" className="w-full h-full object-cover" />
                    ) : (
                        <User size={40} className="text-zinc-700" />
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0 text-center sm:text-left w-full space-y-3">
                    <div>
                        <h3 className="text-white font-black uppercase tracking-tighter text-xl truncate leading-tight">{maskName(winner.userName || '')}</h3>
                        <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
                            <Smartphone className="w-3 h-3 text-zinc-500" />
                            <p className="text-zinc-400 font-mono text-sm leading-tight">{maskPhone(winner.userPhone || '')}</p>
                        </div>
                    </div>
                    
                    <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50 inline-block w-full text-left">
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Campanha</p>
                        <p className="text-brand-primary-light font-black text-sm uppercase tracking-tighter leading-tight">{winner.raffleName}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-left">
                        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Hash className="w-3 h-3" /> Bilhete</p>
                            <p className="text-white font-black">{String(winner.ticketNumber).padStart(6, '0')}</p>
                        </div>
                        <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Prêmio</p>
                            <p className="text-white font-bold text-sm truncate" title={winner.prize}>{winner.prize}</p>
                            {winner.prizeValue && (
                                <p className="text-brand-primary text-xs font-black mt-0.5">{formatCurrency(winner.prizeValue)}</p>
                            )}
                        </div>
                    </div>
                  </div>
              </div>
            </motion.div>
          ))}
          
        </div>
        {winners.length === 0 && (
            <div className="text-center py-16 bg-zinc-950/50 rounded-2xl border border-zinc-800 mt-4">
              <Trophy className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 font-bold uppercase tracking-widest">Nenhum ganhador registrado até o momento!</p>
              <p className="text-zinc-600 text-sm mt-2">Os ganhadores aparecerão aqui assim que as campanhas forem finalizadas.</p>
            </div>
          )}
      </motion.div>
    </div>
  );
};
