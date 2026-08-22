import React, { useState, useEffect, useCallback } from 'react';
import { Search, Ticket as TicketIcon, CheckCircle2, ChevronRight, ArrowLeft, Copy, Check, ShieldCheck, Lock, User, Loader2, AlertTriangle, UserCheck, MapPin, Calendar, Phone, Mail, FileText, LogIn, LockKeyhole } from 'lucide-react';
import { raffleService } from '../services/raffleService';
import { Purchase, Profile, RaffleStatus } from '../types';
import { useCustomerAuth } from '../context/CustomerContext';
import { motion, AnimatePresence } from 'motion/react';

export const MyTickets: React.FC = () => {
  const { customer, openAuthModal, login } = useCustomerAuth();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isPendingRegistration, setIsPendingRegistration] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedRaffleId, setSelectedRaffleId] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState<string | null>(null);

  // Auto load tickets if user is logged in
  const loadCustomerTickets = useCallback(async (cleanCpf: string, cleanPhone: string) => {
    if (!cleanCpf || !cleanPhone) return;
    setLoading(true);
    setSelectedRaffleId(null);
    setFormError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/tickets/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: cleanCpf, phone: cleanPhone })
      });

      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        setPurchases(data.purchases);
        
        const isComplete = data.registrationComplete;
        setIsPendingRegistration(!isComplete);

        if (data.profile) {
          // DO NOT USE MASKED DATA FOR FORM STATE
          // We use the `cleanPhone` provided by the user to the search function instead of the API response
          let formattedPhone = '';
          const cleanP = cleanPhone.replace(/\D/g, '');
          if (cleanP.length === 11) {
            formattedPhone = cleanP.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
          } else if (cleanP.length === 10) {
            formattedPhone = cleanP.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
          }

          const safeFullName = data.profile.fullName && !data.profile.fullName.includes('*') && !data.profile.fullName.startsWith('Cliente ') ? data.profile.fullName : '';
          const safeEmail = data.profile.email && !data.profile.email.includes('*') && !data.profile.email.includes('@example.invalid') ? data.profile.email : '';
          
          let formattedCep = data.profile.cep || '';
          if (formattedCep.includes('*')) formattedCep = '';
          const cleanCepVal = formattedCep.replace(/\D/g, '');
          if (cleanCepVal.length === 8) {
            formattedCep = cleanCepVal.replace(/^(\d{5})(\d{3})$/, '$1-$2');
          }

          setFormState({
            fullName: safeFullName,
            phone: formattedPhone,
            phoneConfirm: formattedPhone
          });
        }
        setSearched(true);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (customer && customer.cpf && customer.phone) {
      const cleanCpf = customer.cpf.replace(/\D/g, '');
      const cleanPhone = customer.phone.replace(/\D/g, '');
      if (cleanCpf.length === 11) {
        let masked = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        setCpf(masked);
        
        loadCustomerTickets(cleanCpf, cleanPhone);
      }
    }
  }, [customer, loadCustomerTickets]);

  // Form state for profile completion
  const [formState, setFormState] = useState({
    fullName: '',
    phone: '',
    phoneConfirm: ''
  });

    const [savingProfile, setSavingProfile] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);



  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpf(value);
  };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'phone' | 'phoneConfirm') => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    let formatted = value;
    if (value.length > 10) {
      formatted = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (value.length > 6) {
      formatted = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      formatted = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else if (value.length > 0) {
      formatted = value.replace(/^(\d*)/, '($1');
    }
    setFormState(prev => ({ ...prev, [field]: formatted }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, '');

    if (cleanCpf.length < 11) return;
    if (!password.trim()) {
      setFormError("Informe o telefone cadastrado.");
      return;
    }

    setLoading(true);
    setSelectedRaffleId(null);
    setFormError(null);
    setSuccessMsg(null);

    try {
      await login(cleanCpf, password);
      // login success sets customer, which triggers useEffect to load tickets!
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('Nenhum cadastro')) {
        setFormError('Você ainda não possui uma conta.');
      } else {
        setFormError('CPF ou telefone incorretos.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCpfVal = cpf.replace(/\D/g, '');
    const cleanPhoneVal = formState.phone.replace(/\D/g, '');
    const cleanConfirmPhoneVal = formState.phoneConfirm.replace(/\D/g, '');
    
    if (!formState.fullName.trim() || formState.fullName.startsWith('Cliente ')) {
      setFormError('Informe seu nome completo.');
      return;
    }
    if (cleanPhoneVal.length < 10) {
      setFormError('Informe um telefone válido com DDD.');
      return;
    }
    if (cleanPhoneVal !== cleanConfirmPhoneVal) {
      setFormError('A confirmação de telefone não confere com o telefone informado.');
      return;
    }

    setSavingProfile(true);
    try {
      let targetProfileId = profile?.id;
      if (!targetProfileId) {
        const newP = await raffleService.createProfile({
          fullName: formState.fullName.trim(),
          cpf: cleanCpfVal,
          phone: cleanPhoneVal,
          
        });
        targetProfileId = newP.id;
        setProfile(newP);
      } else {
        await raffleService.updateProfile(targetProfileId, {
          fullName: formState.fullName.trim(),
          phone: cleanPhoneVal,
          
        });
      }

      setIsPendingRegistration(false);
      setSuccessMsg('Cadastro concluído com sucesso! Suas cotas foram liberadas.');
      setTimeout(() => setSuccessMsg(null), 6000);

      // Auto login triggers context update and reloads tickets automatically
      await login(cleanCpfVal, formState.phone);
      
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setFormError(err.message || 'Erro ao salvar cadastro. Tente novamente.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCopyPix = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPix(code);
    setTimeout(() => setCopiedPix(null), 2000);
  };

  const groupedPurchases = purchases ? purchases.reduce((acc, purchase) => {
    if (!acc[purchase.raffleId]) {
      acc[purchase.raffleId] = {
        raffleName: purchase.raffleName || 'Rifa Desconhecida',
        raffleImageUrl: purchase.raffleImageUrl,
        raffleStatus: purchase.raffleStatus,
        purchases: []
      };
    }
    acc[purchase.raffleId].purchases.push(purchase);
    return acc;
  }, {} as Record<string, { raffleName: string, raffleImageUrl?: string, raffleStatus?: RaffleStatus, purchases: Purchase[] }>) : {};

  const visibleGroups = Object.entries(groupedPurchases);
  const selectedGroup = selectedRaffleId ? groupedPurchases[selectedRaffleId] : null;

  return (
    <div className="max-w-5xl mx-auto min-h-[80vh] px-4 py-12 animate-in fade-in duration-700">
      {!customer ? (
        <>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4 uppercase tracking-tighter">Acesse seus bilhetes</h2>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Utilize seu CPF e telefone cadastrado para entrar</p>
          </div>

          <div className="bg-brand-card border border-brand-border rounded-3xl p-6 mb-12 shadow-2xl max-w-lg mx-auto">
            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 flex flex-col items-center justify-center gap-3 text-red-400 text-xs font-bold text-center">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="flex-shrink-0" />
                    {formError}
                </div>
                {formError.includes('não possui uma conta') && (
                    <button
                        onClick={() => openAuthModal('register')}
                        className="px-4 py-2 mt-2 bg-brand-primary text-black rounded-xl hover:bg-brand-primary-light font-bold transition-colors uppercase tracking-wider"
                    >
                        Criar Conta
                    </button>
                )}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">CPF do Participante</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                  <input 
                      type="tel" 
                      value={cpf}
                      onChange={handleCpfChange}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full bg-brand-bg border-2 border-brand-border rounded-2xl pl-12 pr-6 py-4 text-white text-xl font-black focus:border-brand-primary outline-none transition-all placeholder:text-zinc-800"
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2">Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                  <input 
                      type="tel"
                      value={password}
                      onChange={(e) => {
                         let val = e.target.value.replace(/\D/g, '');
                         if (val.length > 11) val = val.slice(0, 11);
                         let formatted = val;
                         if (val.length > 10) formatted = val.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
                         else if (val.length > 5) formatted = val.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
                         else if (val.length > 2) formatted = val.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
                         setPassword(formatted);
                      }}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-brand-bg border-2 border-brand-border rounded-2xl pl-12 pr-6 py-4 text-white text-xl font-black focus:border-brand-primary outline-none transition-all placeholder:text-zinc-800"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading || cpf.length < 14 || !password.trim()}
                className="w-full px-10 py-4 bg-brand-primary hover:bg-brand-primary-dark disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black rounded-2xl transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 uppercase tracking-tighter"
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    <LogIn size={20} /> Entrar
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-8 mt-8 pt-8 border-t border-brand-border opacity-30 grayscale">
              <div className="flex items-center gap-1.5 text-[9px] font-black text-white uppercase tracking-widest">
                  <ShieldCheck size={14} className="text-brand-primary" /> 100% Seguro
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-black text-white uppercase tracking-widest">
                  <Lock size={14} className="text-brand-primary" /> Criptografado
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary/10 border border-brand-primary/20 rounded-full text-brand-primary text-[10px] font-black uppercase tracking-widest mb-6">
                  <TicketIcon size={14} /> Meus Bilhetes
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-4 uppercase tracking-tighter">Seus Bilhetes</h2>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Acompanhe suas participações</p>
          </div>
        </>
      )}

      {/* SUCCESS TOAST MESSAGE */}
      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-primary/10 border-2 border-brand-primary/40 rounded-3xl p-6 mb-8 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-brand-primary-light font-black text-lg uppercase tracking-tight">
            <CheckCircle2 size={24} /> {successMsg}
          </div>
        </motion.div>
      )}

      {/* PENDING REGISTRATION SCREEN */}
      {searched && isPendingRegistration && !loading && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-8"
        >
          {/* Warning Banner */}
          <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-8 text-center space-y-3">
            <div className="w-16 h-16 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">
              Você ainda não concluiu seu cadastro
            </h3>
            <p className="text-white text-sm max-w-xl mx-auto leading-relaxed">
              Sua compra foi realizada com sucesso e seus bilhetes estão garantidos! Para consultar suas cotas e participar dos sorteios, por favor conclua seu cadastro abaixo.
            </p>
          </div>

          {/* Complete Registration Form */}
          <div className="bg-brand-card border border-brand-border rounded-3xl p-6 md:p-10 shadow-2xl max-w-3xl mx-auto">
            <div className="flex items-center gap-3 pb-6 mb-8 border-b border-brand-border">
              <div className="w-10 h-10 bg-brand-primary/20 rounded-2xl flex items-center justify-center text-brand-primary-light font-bold">
                <UserCheck size={20} />
              </div>
              <div>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">Cadastro de Participante</h4>
                <p className="text-xs text-zinc-500 font-bold">Preencha todos os dados obrigatórios para liberar seus bilhetes</p>
              </div>
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 flex items-center gap-3 text-red-400 text-xs font-bold">
                <AlertTriangle size={18} className="flex-shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveRegistration} className="space-y-6">
              {/* Personal Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Nome Completo *</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="text"
                      required
                      placeholder="Seu nome completo"
                      value={formState.fullName}
                      onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                      className="w-full bg-brand-bg border border-brand-border rounded-2xl pl-12 pr-4 py-3.5 text-white font-bold text-sm focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">CPF (Confirmado)</label>
                  <div className="relative opacity-60">
                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="text"
                      disabled
                      value={cpf}
                      className="w-full bg-zinc-900 border border-brand-border rounded-2xl pl-12 pr-4 py-3.5 text-zinc-400 font-mono text-sm cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Telefone *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="tel"
                      required
                      placeholder="(00) 00000-0000"
                      value={formState.phone}
                      onChange={(e) => handlePhoneChange(e, 'phone')}
                      className="w-full bg-brand-bg border border-brand-border rounded-2xl pl-12 pr-4 py-3.5 text-white font-bold text-sm focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Confirmação do Telefone *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="tel"
                      required
                      placeholder="Confirme o telefone"
                      value={formState.phoneConfirm}
                      onChange={(e) => handlePhoneChange(e, 'phoneConfirm')}
                      className="w-full bg-brand-bg border border-brand-border rounded-2xl pl-12 pr-4 py-3.5 text-white font-bold text-sm focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full bg-brand-primary hover:bg-brand-primary-dark disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 uppercase tracking-tight text-lg mt-8"
              >
                {savingProfile ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <CheckCircle2 size={22} /> Concluir Cadastro e Liberar Cotas
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      )}

      {/* COMPLETED REGISTRATION -> SHOW TICKETS */}
      {searched && !isPendingRegistration && visibleGroups.length === 0 && !loading && (
        <div className="text-center py-20 bg-brand-card border border-brand-border rounded-3xl">
          <TicketIcon className="w-20 h-20 mx-auto mb-6 text-zinc-800" />
          <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Nenhum bilhete encontrado</h3>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Nenhuma cota registrada para este CPF</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {searched && !isPendingRegistration && !selectedRaffleId && visibleGroups.length > 0 && (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
            {visibleGroups.map(([raffleId, group]) => (
                <div 
                key={raffleId} 
                onClick={() => setSelectedRaffleId(raffleId)}
                className="group bg-brand-card border border-brand-border rounded-3xl overflow-hidden cursor-pointer hover:border-brand-primary/50 transition-all shadow-xl"
                >
                <div className="aspect-video w-full relative overflow-hidden bg-brand-bg">
                    {group.raffleImageUrl ? (
                    <img 
                        src={group.raffleImageUrl} 
                        alt={group.raffleName} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <TicketIcon className="text-zinc-800 w-16 h-16" />
                    </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-bg via-transparent to-transparent flex items-end p-6">
                    <div className="flex items-center gap-2">
                        {group.raffleStatus === RaffleStatus.ACTIVE ? (
                        <span className="px-3 py-1 rounded-full bg-green-500 text-black text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20">
                            ATIVA
                        </span>
                        ) : (
                        <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                            ENCERRADA
                        </span>
                        )}
                    </div>
                    </div>
                </div>
                
                <div className="p-6">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4 group-hover:text-brand-primary transition-colors">
                    {group.raffleName}
                    </h3>
                    <div className="flex justify-between items-center">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">{group.purchases.length} compras realizadas</span>
                    <div className="w-10 h-10 bg-brand-bg rounded-xl flex items-center justify-center text-zinc-500 group-hover:text-brand-primary group-hover:translate-x-1 transition-all">
                        <ChevronRight size={20} />
                    </div>
                    </div>
                </div>
                </div>
            ))}
            </motion.div>
        )}

        {searched && !isPendingRegistration && selectedRaffleId && selectedGroup && (
            <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
            >
            <button 
                onClick={() => setSelectedRaffleId(null)}
                className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors mb-4"
            >
                <ArrowLeft size={20} /> Voltar para lista
            </button>

            <div className="bg-brand-card border border-brand-border rounded-3xl overflow-hidden shadow-2xl">
                <div className="relative h-48 md:h-64 border-b border-brand-border">
                {selectedGroup.raffleImageUrl ? (
                    <img 
                        src={selectedGroup.raffleImageUrl} 
                        alt={selectedGroup.raffleName} 
                        className="w-full h-full object-cover opacity-30"
                    />
                    ) : (
                    <div className="w-full h-full bg-brand-bg" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-card via-brand-card/60 to-transparent flex items-end p-8">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                        {selectedGroup.raffleStatus === RaffleStatus.ACTIVE ? (
                            <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest border border-green-500/20">
                                ATIVA
                            </span>
                        ) : (
                            <span className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest border border-zinc-700">
                                ENCERRADA
                            </span>
                        )}
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">{selectedGroup.raffleName}</h2>
                    </div>
                    </div>
                </div>

                <div className="p-8 space-y-10">
                {/* PURCHASES & TICKETS LIST */}
                {(() => {
                    const allTickets = selectedGroup.purchases.flatMap(p => p.ticketNumbers || []).sort((a, b) => (a || 0) - (b || 0));
                    const totalQuantity = allTickets.length;

                    return (
                        <div className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-3 bg-brand-bg px-6 py-4 rounded-2xl text-white border border-brand-border shadow-inner">
                                    <TicketIcon size={24} className="text-brand-primary" />
                                    <span className="font-black text-xl uppercase tracking-tighter">{totalQuantity} cotas cadastradas</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {allTickets.length > 0 ? (
                                    allTickets.map(num => (
                                        <div key={num} className="bg-brand-bg border border-brand-border text-brand-primary px-4 py-3 rounded-2xl text-lg font-black font-mono text-center hover:border-brand-primary/50 transition-all cursor-default select-all shadow-sm">
                                            {String(num).padStart(6, '0')}
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full bg-brand-bg border border-brand-border p-8 rounded-3xl text-center">
                                        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Nenhum bilhete encontrado nesta rifa.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
                </div>
            </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
