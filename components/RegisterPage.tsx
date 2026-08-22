import React, { useState } from 'react';
import { metaPixelService } from "../services/metaPixelService";
import { User, Phone, Mail, Calendar, MapPin, Hash, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerContext';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useCustomerAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    cpf: '',
    phone: '',
    confirmPhone: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.phone !== formData.confirmPhone) {
      alert('Os telefones não coincidem!');
      return;
    }

    

    setLoading(true);
    try {
      await register({
        fullName: formData.fullName,
        cpf: formData.cpf,
        phone: formData.phone
      });
      metaPixelService.track('CompleteRegistration');
      alert('Cadastro realizado com sucesso! Você já está conectado.');
      navigate('/meus-bilhetes');
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Erro ao realizar cadastro. Verifique se o CPF ou telefone já estão cadastrados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="text-2xl">🧑‍💻</span>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Faça o seu cadastro</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome Completo */}
          <div className="relative group">
            <label className="absolute -top-2.5 left-4 px-2 bg-zinc-900 text-xs font-bold text-zinc-500 group-focus-within:text-brand-primary transition-colors">
              Nome Completo*
            </label>
            <input 
              type="text"
              name="fullName"
              required
              value={formData.fullName}
              onChange={handleChange}
              className="w-full bg-transparent border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-brand-primary focus:outline-none transition-all font-medium"
              placeholder="Digite seu nome completo"
            />
          </div>

          {/* CPF */}
          <div className="relative group">
            <label className="absolute -top-2.5 left-4 px-2 bg-zinc-900 text-xs font-bold text-zinc-500 group-focus-within:text-brand-primary transition-colors">
              Informe seu CPF*
            </label>
            <input 
              type="text"
              name="cpf"
              required
              value={formData.cpf}
              onChange={handleChange}
              className="w-full bg-transparent border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-brand-primary focus:outline-none transition-all font-medium"
              placeholder="000.000.000-00"
            />
          </div>

          {/* Telefone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative group">
              <label className="absolute -top-2.5 left-4 px-2 bg-zinc-900 text-xs font-bold text-zinc-500 group-focus-within:text-brand-primary transition-colors">
                Telefone*
              </label>
              <div className="flex items-center border border-zinc-800 rounded-xl px-4 py-4 focus-within:border-brand-primary transition-all">
                <div className="flex items-center gap-2 pr-3 border-r border-zinc-800 mr-3">
                  <img src="https://flagcdn.com/w20/br.png" alt="BR" className="w-5 h-auto rounded-sm" />
                  <span className="text-white font-bold text-sm">▼</span>
                </div>
                <input 
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full bg-transparent text-white focus:outline-none font-medium"
                  placeholder="Telefone"
                />
              </div>
            </div>

            <div className="relative group">
              <label className="absolute -top-2.5 left-4 px-2 bg-zinc-900 text-xs font-bold text-zinc-500 group-focus-within:text-brand-primary transition-colors">
                Confirme o Telefone*
              </label>
              <div className="flex items-center border border-zinc-800 rounded-xl px-4 py-4 focus-within:border-brand-primary transition-all">
                <div className="flex items-center gap-2 pr-3 border-r border-zinc-800 mr-3">
                  <img src="https://flagcdn.com/w20/br.png" alt="BR" className="w-5 h-auto rounded-sm" />
                  <span className="text-white font-bold text-sm">▼</span>
                </div>
                <input 
                  type="tel"
                  name="confirmPhone"
                  required
                  value={formData.confirmPhone}
                  onChange={handleChange}
                  className="w-full bg-transparent text-white focus:outline-none font-medium"
                  placeholder="Telefone"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary-dark text-black font-black py-5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-primary/20 uppercase tracking-tighter mt-8 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Concluir Cadastro'}
            {!loading && <ArrowRight size={20} />}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
