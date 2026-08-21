import React from 'react';
import { Megaphone } from 'lucide-react';
import { motion } from 'motion/react';

export const AnnouncementsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="text-2xl">📢</span>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Comunicados</h1>
        </div>

        <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-8 text-center">
          <p className="text-zinc-600 font-bold uppercase tracking-widest">Nenhum comunicado até o momento!</p>
        </div>
      </motion.div>
    </div>
  );
};
