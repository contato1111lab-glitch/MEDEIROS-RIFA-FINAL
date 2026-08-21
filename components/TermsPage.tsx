import React from 'react';
import { ClipboardList } from 'lucide-react';
import { motion } from 'motion/react';

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="text-2xl">📋</span>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Termos de Uso</h1>
        </div>

        <div className="space-y-6 text-white font-medium leading-relaxed">
          <p>
            1) “Na qualidade de Adquirente deste Bilhete Lotérico, aprovado conforme processo LOTEP que consta no produto:
          </p>
          <p className="pl-4">
            (i) tenho conhecimento de que a compra deste produto implica na automática adesão ao Regulamento da campanha e que o processo de regularidade deste bilhete lotérico encontra-se ao meu dispor no site da LOTEP.
          </p>
          <p className="pl-4">
            (ii) O contemplado poderá autorizar de forma gratuita o direito de uso do seu nome, imagem e voz, pelo período de um ano, para divulgação da campanha.
          </p>
          <p className="pl-4">
            (iii) Concordo com os Termos de Uso e a Política de privacidade.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
