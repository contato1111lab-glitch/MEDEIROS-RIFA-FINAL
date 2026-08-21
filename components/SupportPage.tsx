import React, { useState } from 'react';
import { Mail, Phone, User, MessageSquare, Send, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { raffleService } from '../services/raffleService';

export const SupportPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    }
    setPhone(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone || !message.trim()) return;

    setLoading(true);
    try {
      await raffleService.sendSupportMessage({
        name,
        email,
        phone,
        subject: subject || 'Atendimento Geral',
        message
      });
      setSent(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">✉️</span>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Contato & Suporte</h1>
          <span className="text-zinc-500 text-sm font-bold uppercase tracking-widest ml-1">Tire suas dúvidas</span>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-black text-white mb-1">Sinta-se livre para nos contatar.</h2>
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Atendimento humano via WhatsApp e suporte interno.</p>
        </div>

        {sent ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-black mx-auto shadow-lg shadow-green-500/20">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Mensagem Enviada!</h3>
            <p className="text-white text-sm font-bold leading-relaxed max-w-md mx-auto">
              Recebemos seu contato com sucesso. Nossa equipe de suporte analisará a mensagem e entrará em contato via WhatsApp no número <span className="text-green-400">{phone}</span> em breve.
            </p>
            <button 
              onClick={() => { setSent(false); setMessage(''); setSubject(''); }}
              className="mt-4 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              Enviar outra mensagem
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome */}
            <div className="relative group">
              <label className="absolute -top-2.5 left-4 px-2 bg-zinc-900 text-xs font-bold text-zinc-400 group-focus-within:text-brand-primary transition-colors">
                Nome Completo*
              </label>
              <input 
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-brand-primary focus:outline-none transition-all font-medium"
                placeholder="Digite seu nome"
              />
            </div>

            {/* E-mail */}
            <div className="relative group">
              <label className="absolute -top-2.5 left-4 px-2 bg-zinc-900 text-xs font-bold text-zinc-400 group-focus-within:text-brand-primary transition-colors">
                E-mail (opcional)
              </label>
              <input 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-brand-primary focus:outline-none transition-all font-medium"
                placeholder="Digite seu e-mail"
              />
            </div>

            {/* Telefone */}
            <div className="relative group">
              <label className="absolute -top-2.5 left-4 px-2 bg-zinc-900 text-xs font-bold text-zinc-400 group-focus-within:text-brand-primary transition-colors z-10">
                Telefone (WhatsApp)*
              </label>
              <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 focus-within:border-brand-primary transition-all">
                <div className="flex items-center gap-2 pr-3 border-r border-zinc-800 mr-3">
                  <span className="text-xl">🇧🇷</span>
                  <span className="text-zinc-400 font-bold text-sm">+55</span>
                </div>
                <input 
                  type="tel"
                  required
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full bg-transparent text-white focus:outline-none font-medium"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {/* Assunto */}
            <div className="relative group">
              <label className="absolute -top-2.5 left-4 px-2 bg-zinc-900 text-xs font-bold text-zinc-400 group-focus-within:text-brand-primary transition-colors z-10">
                Assunto do contato
              </label>
              <select 
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-brand-primary focus:outline-none transition-all font-medium appearance-none"
              >
                <option value="" className="bg-zinc-900">Selecione um assunto</option>
                <option value="duvida" className="bg-zinc-900">Dúvida sobre Rifas</option>
                <option value="pagamento" className="bg-zinc-900">Confirmação de Pagamento PIX</option>
                <option value="premio" className="bg-zinc-900">Resgate de Prêmio</option>
                <option value="outro" className="bg-zinc-900">Outro assunto</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">▼</div>
            </div>

            {/* Mensagem */}
            <div className="relative group">
              <label className="absolute -top-2.5 left-4 px-2 bg-zinc-900 text-xs font-bold text-zinc-400 group-focus-within:text-brand-primary transition-colors">
                Digite sua mensagem*
              </label>
              <textarea 
                required
                rows={4}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-brand-primary focus:outline-none transition-all font-medium resize-none"
                placeholder="Descreva detalhadamente como podemos te ajudar..."
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-primary-dark disabled:bg-zinc-800 text-black font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-primary/20 uppercase tracking-tighter text-lg mt-4"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  Enviar Mensagem
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
