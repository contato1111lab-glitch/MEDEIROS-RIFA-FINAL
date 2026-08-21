import React, { useState } from 'react';
import { X, User, Phone, Lock, Mail, FileText, ArrowRight, Loader2, CheckCircle2, ShieldCheck, UserPlus, LogIn, MapPin, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCustomerAuth } from '../context/CustomerContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalMode, login, register } = useCustomerAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(authModalMode || 'login');

  // Sync activeTab when modal mode prop changes
  React.useEffect(() => {
    setActiveTab(authModalMode);
  }, [authModalMode]);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regCep, setRegCep] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regNeighborhood, setRegNeighborhood] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regState, setRegState] = useState('');
  
  const [fetchingCep, setFetchingCep] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  // Format CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    let formatted = val;
    if (val.length > 9) formatted = val.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (val.length > 6) formatted = val.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (val.length > 3) formatted = val.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    setter(formatted);
  };

  // Format Phone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    let formatted = val;
    if (val.length > 10) formatted = val.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    else if (val.length > 5) formatted = val.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    else if (val.length > 2) formatted = val.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    setter(formatted);
  };

  // Handle CEP lookup
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    let formatted = val;
    if (val.length > 5) formatted = val.replace(/^(\d{5})(\d{3})$/, '$1-$2');
    setRegCep(formatted);

    if (val.length === 8) {
      setFetchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${val}/json/`);
        const data = await res.json();
        if (!data.erro) {
          if (data.logradouro) setRegAddress(data.logradouro);
          if (data.bairro) setRegNeighborhood(data.bairro);
          if (data.localidade) setRegCity(data.localidade);
          if (data.uf) setRegState(data.uf);
        }
      } catch (err) {
        console.error('ViaCEP fetch error:', err);
      } finally {
        setFetchingCep(false);
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginIdentifier.trim()) {
      setLoginError('Informe seu Telefone ou CPF.');
      return;
    }

    setLoginLoading(true);
    try {
      await login(loginIdentifier, loginPassword);
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || 'Erro ao realizar login. Verifique seus dados.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    const cleanCpf = regCpf.replace(/\D/g, '');
    const cleanPhone = regPhone.replace(/\D/g, '');
    const cleanCep = regCep.replace(/\D/g, '');

    if (!regName.trim() || regName.trim().length < 3) {
      setRegError('Informe seu nome completo.');
      return;
    }
    if (cleanCpf.length < 11) {
      setRegError('Informe um CPF válido com 11 dígitos.');
      return;
    }
    if (cleanPhone.length < 10) {
      setRegError('Informe um Telefone válido com DDD.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError('Informe um e-mail válido.');
      return;
    }

    if (!regPassword.trim()) {
      setRegError('A senha é obrigatória.');
      return;
    }

    setRegLoading(true);
    try {
      await register({
        fullName: regName.trim(),
        cpf: cleanCpf,
        phone: cleanPhone,
        email: regEmail.trim(),
        password: regPassword.trim(),
        birthDate: regBirthDate || undefined,
        cep: cleanCep || undefined,
        address: regAddress.trim() || undefined,
        number: regNumber.trim() || undefined,
        neighborhood: regNeighborhood.trim() || undefined,
        city: regCity.trim() || undefined,
        state: regState.trim() || undefined
      });
    } catch (err: any) {
      console.error(err);
      setRegError(err.message || 'Erro ao criar conta. Verifique se o CPF ou Telefone já possuem cadastro.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto animate-in fade-in">
      <div className="bg-brand-bg border border-brand-border w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative my-auto">
        
        {/* Header Tabs */}
        <div className="p-4 bg-brand-card border-b border-brand-border flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('login'); setLoginError(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'login'
                  ? 'bg-brand-primary text-black shadow-lg shadow-brand-primary/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-brand-border'
              }`}
            >
              <LogIn size={16} /> Entrar
            </button>
            <button
              onClick={() => { setActiveTab('register'); setRegError(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'register'
                  ? 'bg-brand-primary text-black shadow-lg shadow-brand-primary/20'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-brand-border'
              }`}
            >
              <UserPlus size={16} /> Criar Conta
            </button>
          </div>

          <button
            onClick={closeAuthModal}
            className="p-2 text-zinc-500 hover:text-white transition-colors rounded-xl hover:bg-zinc-800"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-6 md:p-8">
          {activeTab === 'login' ? (
            <motion.form
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleLoginSubmit}
              className="space-y-5"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary-light rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <User size={28} />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Acessar sua Conta</h3>
                <p className="text-zinc-400 text-xs mt-1">Informe seu CPF cadastrado para entrar</p>
              </div>

              {loginError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold text-center">
                  {loginError}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">
                    CPF *
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="000.000.000-00"
                      value={loginIdentifier}
                      onChange={(e) => handleCpfChange(e, setLoginIdentifier)}
                      className="w-full bg-brand-card border-2 border-brand-border rounded-2xl pl-12 pr-4 py-3.5 text-white font-bold text-sm focus:border-brand-primary outline-none transition-all placeholder:text-zinc-700"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">
                    Senha *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="password"
                      required
                      placeholder="Sua senha de acesso"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-brand-card border-2 border-brand-border rounded-2xl pl-12 pr-4 py-3.5 text-white font-bold text-sm focus:border-brand-primary outline-none transition-all placeholder:text-zinc-700"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading || !loginIdentifier.trim()}
                className="w-full bg-brand-primary hover:bg-brand-primary-dark disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 uppercase tracking-tight text-base mt-6 cursor-pointer disabled:cursor-not-allowed"
              >
                {loginLoading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <span>Entrar na Minha Conta</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setRegError(null); }}
                  className="text-xs text-zinc-400 hover:text-brand-primary-light font-bold transition-colors"
                >
                  Ainda não tem conta? <span className="underline text-brand-primary">Cadastre-se aqui</span>
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.form
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleRegisterSubmit}
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
            >
              <div className="text-center mb-4">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Criar Nova Conta</h3>
                <p className="text-zinc-400 text-xs mt-1">Cadastre-se uma única vez e facilite todas as suas compras</p>
              </div>

              {regError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold text-center">
                  {regError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Nome Completo *</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="text"
                      required
                      placeholder="Seu nome e sobrenome"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full bg-brand-card border-2 border-brand-border rounded-2xl pl-12 pr-4 py-3 text-white font-bold text-sm focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">CPF *</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="tel"
                      required
                      placeholder="000.000.000-00"
                      value={regCpf}
                      onChange={(e) => handleCpfChange(e, setRegCpf)}
                      className="w-full bg-brand-card border-2 border-brand-border rounded-2xl pl-12 pr-4 py-3 text-white font-bold text-sm focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Telefone (WhatsApp) *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="tel"
                      required
                      placeholder="(00) 00000-0000"
                      value={regPhone}
                      onChange={(e) => handlePhoneChange(e, setRegPhone)}
                      className="w-full bg-brand-card border-2 border-brand-border rounded-2xl pl-12 pr-4 py-3 text-white font-bold text-sm focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">E-mail *</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="email"
                      required
                      placeholder="seu@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-brand-card border-2 border-brand-border rounded-2xl pl-12 pr-4 py-3 text-white font-bold text-sm focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Criar Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="password"
                      placeholder="Crie uma senha"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-brand-card border-2 border-brand-border rounded-2xl pl-12 pr-4 py-3 text-white font-bold text-sm focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                    CEP {fetchingCep && <span className="text-brand-primary-light animate-pulse">(buscando...)</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="00000-000"
                    maxLength={9}
                    value={regCep}
                    onChange={handleCepChange}
                    className="w-full bg-brand-card border-2 border-brand-border rounded-2xl px-4 py-3 text-white font-bold text-sm focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Endereço</label>
                  <input
                    type="text"
                    placeholder="Rua / Avenida"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    className="w-full bg-brand-card border-2 border-brand-border rounded-2xl px-4 py-3 text-white font-bold text-sm focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Número</label>
                  <input
                    type="text"
                    placeholder="Número"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    className="w-full bg-brand-card border-2 border-brand-border rounded-2xl px-4 py-3 text-white font-bold text-sm focus:border-brand-primary outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Cidade / UF</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Cidade"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      className="w-2/3 bg-brand-card border-2 border-brand-border rounded-2xl px-3 py-3 text-white font-bold text-sm focus:border-brand-primary outline-none"
                    />
                    <input
                      type="text"
                      placeholder="UF"
                      maxLength={2}
                      value={regState}
                      onChange={(e) => setRegState(e.target.value.toUpperCase())}
                      className="w-1/3 bg-brand-card border-2 border-brand-border rounded-2xl px-3 py-3 text-white font-bold text-sm focus:border-brand-primary outline-none uppercase"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full bg-brand-primary hover:bg-brand-primary-dark disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 uppercase tracking-tight text-base mt-6 cursor-pointer disabled:cursor-not-allowed"
              >
                {regLoading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <CheckCircle2 size={20} />
                    <span>Concluir Cadastro e Entrar</span>
                  </>
                )}
              </button>
            </motion.form>
          )}
        </div>
      </div>
    </div>
  );
};
