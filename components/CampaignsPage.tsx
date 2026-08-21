import React, { useEffect, useState } from 'react';
import { RaffleCard } from './RaffleCard';
import { Raffle } from '../types';
import { raffleService } from '../services/raffleService';
import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CampaignsPage: React.FC = () => {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    raffleService.getAllRaffles().then(data => {
      setRaffles(data);
      setLoading(false);
    });
  }, []);

  const handleRaffleClick = (raffle: Raffle) => {
    navigate(`/rifa/${raffle.slug || raffle.id}`);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="text-brand-primary font-black uppercase tracking-widest animate-pulse">Carregando campanhas...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 md:mb-12 border-b border-zinc-800 pb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="text-brand-primary" size={36} />
          <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">Nossas Campanhas</h1>
        </div>
        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs md:text-sm">Escolha sua sorte e participe dos melhores sorteios!</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {raffles.map((raffle) => (
          <RaffleCard 
            key={raffle.id} 
            raffle={raffle} 
            variant="grid"
            onClick={handleRaffleClick}
          />
        ))}
      </div>

      {raffles.length === 0 && (
        <div className="text-center py-20 bg-zinc-900/50 border border-zinc-800 rounded-3xl">
          <p className="text-zinc-500 font-bold uppercase tracking-widest">Nenhuma campanha ativa no momento.</p>
        </div>
      )}
    </div>
  );
};
