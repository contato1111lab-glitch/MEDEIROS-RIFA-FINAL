import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Home, 
  Ticket as TicketIcon, 
  UserCheck, 
  AlertTriangle, 
  Loader2, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  FileText, 
  User, 
  ShieldCheck, 
  Lock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { raffleService } from '../services/raffleService';
import { Profile } from '../types';

interface SuccessViewProps {
  purchaseId: string;
  raffleName: string;
  raffleImage: string;
  numbers: number[];
  totalValue: number;
  onHome: () => void;
  onMyTickets: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({ 
    purchaseId,
    raffleName, 
    raffleImage, 
    numbers, 
    totalValue,
    onHome, 
    onMyTickets 
}) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isPendingRegistration, setIsPendingRegistration] = useState(false);
  const [ticketNumbers, setTicketNumbers] = useState<number[]>(numbers || []);

  // Form state
  const [formState, setFormState] = useState({
    fullName: '',
    phone: '',
    phoneConfirm: ''
  });

  const [fetchingCep, setFetchingCep] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);



  useEffect(() => {
    let isMounted = true;
    async function loadPurchaseAndProfile() {
      setLoading(true);
      try {
        const purchase = await raffleService.getPurchaseById(purchaseId);
        if (purchase) {
          if (purchase.ticketNumbers && purchase.ticketNumbers.length > 0) {
            setTicketNumbers(purchase.ticketNumbers);
          }

          let prof: Profile | null = null;
          if (purchase.userId) {
            // The profile comes back with the purchase payload.
            prof = purchase.profile ?? null;
          }

          if (isMounted) {
            setProfile(prof);
            const isComplete = purchase.registrationComplete;
            setIsPendingRegistration(!isComplete);

                        if (prof) {
              let formattedPhone = '';
              if (prof.phone && !prof.phone.includes('*')) {
                const cleanP = prof.phone.replace(/\D/g, '');
                if (cleanP.length === 11) {
                  formattedPhone = cleanP.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
                } else if (cleanP.length === 10) {
                  formattedPhone = cleanP.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
                }
              }

              const safeFullName = prof.fullName && !prof.fullName.includes('*') && !prof.fullName.startsWith('Cliente ') ? prof.fullName : '';
              const safeEmail = prof.email && !prof.email.includes('*') && !prof.email.includes('@example.invalid') ? prof.email : '';

              let formattedCep = prof.cep || '';
              if (formattedCep.includes('*')) formattedCep = '';
              const cleanCepVal = formattedCep.replace(/\D/g, '');
              if (cleanCepVal.length === 8) {
                formattedCep = cleanCepVal.replace(/^(\d{5})(\d{3})$/, '$1-$2');
              }

              let formattedCpf = prof.cpf || '';
              if (formattedCpf.includes('*')) formattedCpf = '';
              const cleanCpfVal = formattedCpf.replace(/\D/g, '');
              if (cleanCpfVal.length === 11) {
                formattedCpf = cleanCpfVal.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
              }

              setFormState({
                fullName: safeFullName,
                phone: formattedPhone,
                phoneConfirm: formattedPhone
              });
            }
          }
        } else {
          if (isMounted) {
            setIsPendingRegistration(true);
          }
        }
      } catch (err) {
        console.error('Error loading purchase in SuccessView:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (purchaseId) {
      loadPurchaseAndProfile();
    } else {
      setLoading(false);
    }

    return () => { isMounted = false; };
  }, [purchaseId]);

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

  const handleSaveRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCpfVal = profile?.cpf || "";
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
          phone: cleanPhoneVal
        });
        targetProfileId = newP.id;
        setProfile(newP);
      } else {
        await raffleService.updateProfile(targetProfileId, {
          fullName: formState.fullName.trim(),
          phone: cleanPhoneVal
        });
      }

      setIsPendingRegistration(false);
      setSuccessMsg('Cadastro concluído com sucesso! Suas cotas foram liberadas.');
      setTimeout(() => setSuccessMsg(null), 6000);

      // Reload purchase tickets
      if (purchaseId) {
        const updatedPurchase = await raffleService.getPurchaseById(purchaseId);
        if (updatedPurchase?.ticketNumbers) {
          setTicketNumbers(updatedPurchase.ticketNumbers);
        }
      }
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setFormError(err.message || 'Erro ao salvar cadastro. Tente novamente.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Loader2 className="w-12 h-12 text-brand-primary animate-spin" />
        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Carregando informações da participação...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-6 animate-in fade-in duration-700 max-w-3xl mx-auto pb-20">
      {/* Status Header */}
      <div className="flex flex-col items-center gap-4 mb-8 mt-4 text-center">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
            <CheckCircle2 className="w-10 h-10 text-black" strokeWidth={3} />
        </div>
        <div>
            <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter">Pagamento identificado!</h2>
            <p className="text-zinc-400 text-xs font-black uppercase tracking-widest mt-1">Sua participação foi confirmada com sucesso</p>
        </div>
      </div>

      {/* Campaign Card */}
      <div className="w-full bg-brand-card border border-brand-border rounded-3xl overflow-hidden mb-8 shadow-xl">
        <div 
          className="relative aspect-[21/9] protected-img-bg select-none"
          style={{ backgroundImage: `url("${raffleImage}")` }}
          data-protected-image
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
            <img 
              src={raffleImage} 
              alt={raffleName} 
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              className="w-full h-full object-cover opacity-0 pointer-events-none select-none" 
            />
            <div className="absolute top-4 left-4 z-10">
                <span className="bg-green-500 text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-md">
                    Corre, compre agora!
                </span>
            </div>
        </div>
        <div className="p-5 flex items-center justify-between">
            <h3 className="text-white font-black uppercase tracking-tight text-lg leading-tight">{raffleName}</h3>
            {totalValue > 0 && (
              <span className="text-brand-primary-light font-black text-lg">R$ {totalValue.toFixed(2).replace('.', ',')}</span>
            )}
        </div>
      </div>

      {/* SUCCESS TOAST */}
      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-green-500/10 border-2 border-green-500/40 rounded-3xl p-5 mb-8 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-green-400 font-black text-base uppercase tracking-tight">
            <CheckCircle2 size={22} /> {successMsg}
          </div>
        </motion.div>
      )}

      {/* PENDING REGISTRATION FORM */}
      {isPendingRegistration ? (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full space-y-8"
        >
          {/* Warning Header */}
          <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-6 md:p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
              Conclua seu cadastro para garantir seu prêmio!
            </h3>
            <p className="text-white text-xs md:text-sm max-w-xl mx-auto leading-relaxed">
              Pagamento aprovado com sucesso! Para validar sua participação nos sorteios e possibilitar a entrega dos prêmios, preencha seus dados completos abaixo.
            </p>
          </div>

          {/* Form Box */}
          <div className="bg-brand-card border border-brand-border rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center gap-3 pb-6 mb-6 border-b border-brand-border">
              <div className="w-10 h-10 bg-green-500/20 rounded-2xl flex items-center justify-center text-green-400 font-bold">
                <UserCheck size={20} />
              </div>
              <div>
                <h4 className="text-lg font-black text-white uppercase tracking-tight">Cadastro Obrigatório do Participante</h4>
                <p className="text-xs text-zinc-500 font-bold">Preencha todos os campos para liberar a visualização completa das suas cotas</p>
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
                      value={profile?.cpf || ''}
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
      ) : (
        /* COMPLETED REGISTRATION -> SHOW TICKETS & ACTIONS */
        <div className="w-full space-y-6">
          {/* Ticket Numbers Card */}
          <div className="bg-brand-card border border-brand-border rounded-3xl p-6 md:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <TicketIcon className="text-brand-primary" size={24} />
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Seus Bilhetes da Sorte</h3>
            </div>

            {ticketNumbers && ticketNumbers.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {ticketNumbers.map(num => (
                  <div 
                    key={num} 
                    className="bg-brand-bg border border-brand-border text-brand-primary-light px-4 py-3 rounded-2xl text-lg font-black font-mono text-center hover:border-brand-primary/50 transition-all select-all shadow-sm"
                  >
                    #{String(num).padStart(6, '0')}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-zinc-500 text-xs font-bold uppercase tracking-widest">
                Carregando bilhetes atribuídos...
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button 
                onClick={onMyTickets}
                className="w-full bg-brand-primary hover:bg-brand-primary-dark text-black font-black uppercase tracking-widest py-4 rounded-2xl transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 text-base"
            >
                <TicketIcon size={20} /> Ver Meus Bilhetes
            </button>
            <button 
                onClick={onHome}
                className="w-full bg-zinc-900 border border-brand-border text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-brand-card transition-all flex items-center justify-center gap-2 text-base"
            >
                <Home size={20} /> Voltar para o Início
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
