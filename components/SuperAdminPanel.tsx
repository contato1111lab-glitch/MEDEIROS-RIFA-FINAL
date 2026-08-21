import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { adminService as raffleService } from '../services/adminService';
import { Raffle, Purchase, Banner, WinningTicket } from '../types';
import { Key, Check, Calendar, Lock } from 'lucide-react';
import { ShieldAlert, Trash2, KeyRound, Save, Activity, Users, Settings, LogOut, CheckCircle, Database, Ghost, RefreshCw, X, Eye, EyeOff, Search, ArrowRightLeft } from 'lucide-react';


export const SuperAdminPanel: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add('admin-force-dark');
    return () => document.documentElement.classList.remove('admin-force-dark');
  }, []);


  const [activeTab, setActiveTab] = useState<'shadow' | 'sales' | 'history'>('shadow');

  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [hiddenPurchases, setHiddenPurchases] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  const [searchPurchaseId, setSearchPurchaseId] = useState('');
  const [purchaseSearchResult, setPurchaseSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [swapTicketNumber, setSwapTicketNumber] = useState('');
  const [newPurchaseDate, setNewPurchaseDate] = useState('');
  const [actionPassword, setActionPassword] = useState('');

  const [secondaryGatewayConfig, setSecondaryGatewayConfig] = useState({
    publicKey: '',
    privateKey: ''
  });

  // --- AUTHENTICATION ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Temporarily store it so the first login call works
      sessionStorage.setItem('master_password', password);
      
      // Check against super_admin_config table
      const isValid = await raffleService.superAdminLogin(password);
      if (isValid) {
        setIsAuthenticated(true);
        loadData();
      } else {
        sessionStorage.removeItem('master_password');
        setError('Acesso negado. Senha incorreta.');
      }
    } catch (err: any) {
      sessionStorage.removeItem('master_password');
      setError('Erro ao autenticar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- DATA LOADING ---
  const loadData = async () => {
    setLoading(true);
    try {
      const [rafflesData, hiddenData, configData, logsData] = await Promise.all([
        raffleService.superAdminGetAllRaffles(),
        raffleService.superAdminGetHiddenPurchases(),
        raffleService.superAdminGetConfig(),
        raffleService.getAuditLogs(true)
      ]);
      
      setRaffles(rafflesData);
      setHiddenPurchases(hiddenData);
      setAuditLogs(logsData);
      if (configData) {
        setSecondaryGatewayConfig({
          publicKey: configData.secondary_gateway_public_key || '',
          privateKey: configData.secondary_gateway_private_key || ''
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---
  const handleToggleShadowMode = async (raffleId: string, currentStatus: boolean) => {
    if (!confirm(`Tem certeza que deseja ${currentStatus ? 'DESATIVAR' : 'ATIVAR'} o Modo Sombra para esta rifa?`)) return;
    
    try {
      await raffleService.superAdminToggleShadowMode(raffleId, !currentStatus);
      loadData(); // Refresh
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  const handleRevealPurchase = async (purchaseId: string) => {
    if (!confirm('ATENÇÃO: Isso irá mover a venda para o painel do Admin Normal. Ela se tornará visível publicamente e contará para a barra de progresso. Confirmar?')) return;

    try {
      await raffleService.superAdminRevealPurchase(purchaseId);
      alert('Venda revelada com sucesso!');
      loadData(); // Refresh
    } catch (err: any) {
      alert('Erro: ' + err.message);
    }
  };

  const handleToggleAuditLog = async (logId: string, currentStatus: boolean) => {
      try {
          await raffleService.toggleAuditLogVisibility(logId, !currentStatus);
          loadData();
      } catch (e) {
          alert('Erro ao alterar visibilidade do log.');
      }
  };

  const handleUpdatePurchaseDate = async () => {
      if (!purchaseSearchResult || !newPurchaseDate) return;
      if (!actionPassword) {
          alert('Digite a Senha Mestra para confirmar a ação.');
          return;
      }
      if (!confirm('Tem certeza que deseja alterar a data desta compra?')) return;
      
      try {
          const isPasswordValid = await raffleService.verifyMasterPassword(actionPassword);
          if (!isPasswordValid) {
              alert('Senha mestra incorreta.');
              return;
          }

          await raffleService.adminUpdatePurchase(purchaseSearchResult.id, {
              purchase_date: new Date(newPurchaseDate).toISOString()
          });
          
          const { data: { session } } = await supabase.auth.getSession();
          const adminEmail = session?.user?.email || 'superadmin';
          await raffleService.logAuditAction(
              adminEmail,
              'EDIÇÃO DE DATA',
              `Alterou a data da compra ID: ${purchaseSearchResult.id} para ${new Date(newPurchaseDate).toLocaleString()}`
          );

          alert('Data da compra atualizada com sucesso!');
          setNewPurchaseDate('');
          setActionPassword('');
          
          // Refresh search
          const e = { preventDefault: () => {} } as React.FormEvent;
          handleSearchPurchase(e);
      } catch (e: any) {
          alert('Erro ao atualizar data: ' + e.message);
      }
  };

  const handleSearchPurchase = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchPurchaseId.trim()) return;
      
      setIsSearching(true);
      setPurchaseSearchResult(null);
      try {
          const { data, error } = await supabase
              .from('purchases')
              .select('*, raffles(name)')
              .eq('id', searchPurchaseId.trim())
              .single();
              
          if (error) throw error;
          
          const { data: ticketsData } = await supabase
              .from('raffle_ticket_pool')
              .select('ticket_number')
              .eq('purchase_id', data.id);
              
          setPurchaseSearchResult({
              ...data,
              tickets: ticketsData?.map(t => t.ticket_number) || []
          });
      } catch (err: any) {
          alert('Compra não encontrada. Verifique o ID.');
      } finally {
          setIsSearching(false);
      }
  };

  const handleManualApprove = async () => {
      if (!purchaseSearchResult) return;
      if (!actionPassword) {
          alert('Digite a Senha Mestra para confirmar a ação.');
          return;
      }
      if (!confirm('Tem certeza que deseja aprovar esta compra manualmente?')) return;
      
      try {
          const { data: { session } } = await supabase.auth.getSession();
          const adminEmail = session?.user?.email || 'superadmin';
          
          const result = await raffleService.approvePurchaseManually(purchaseSearchResult.id, adminEmail, actionPassword);
          if (result.success) {
              alert('Compra aprovada com sucesso!');
              setPurchaseSearchResult(null);
              setSearchPurchaseId('');
              setActionPassword('');
              loadData();
          } else {
              alert(result.message);
          }
      } catch (err: any) {
          alert('Erro: ' + err.message);
      }
  };

  const handleSwapTicket = async () => {
      if (!purchaseSearchResult || !swapTicketNumber) return;
      if (!actionPassword) {
          alert('Digite a Senha Mestra para confirmar a ação.');
          return;
      }
      if (!confirm(`Tem certeza que deseja trocar um bilhete por ${swapTicketNumber}?`)) return;
      
      try {
          const { data: { session } } = await supabase.auth.getSession();
          const adminEmail = session?.user?.email || 'superadmin';
          
          const result = await raffleService.swapTicket(
              purchaseSearchResult.id, 
              parseInt(swapTicketNumber), 
              adminEmail, 
              actionPassword
          );
          
          if (result.success) {
              alert(result.message);
              setPurchaseSearchResult(null);
              setSearchPurchaseId('');
              setSwapTicketNumber('');
              setActionPassword('');
              loadData();
          } else {
              alert(result.message);
          }
      } catch (err: any) {
          alert('Erro: ' + err.message);
      }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await raffleService.superAdminUpdateConfig(secondaryGatewayConfig);
      alert('Configurações salvas!');
      loadData(); // Refresh to ensure UI is in sync
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const handleDeleteConfig = async () => {
      if (!confirm('Tem certeza que deseja APAGAR as chaves do gateway secundário? Isso impedirá vendas no Modo Sombra.')) return;
      
      try {
          // Send empty strings to clear
          await raffleService.superAdminUpdateConfig({ publicKey: '', privateKey: '' });
          setSecondaryGatewayConfig({ publicKey: '', privateKey: '' });
          alert('Configuração removida com sucesso.');
          loadData();
      } catch (err: any) {
          alert('Erro ao remover: ' + err.message);
      }
  };

  // --- RENDER LOGIN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-md bg-zinc-900 border border-red-900/50 p-8 rounded-xl shadow-2xl shadow-red-900/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-purple-600 to-red-600 animate-pulse"></div>
          
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-950 rounded-full border border-red-900 animate-pulse">
              <Ghost className="w-10 h-10 text-red-500" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-red-500 text-center mb-2 tracking-widest">SUPER ADMIN</h1>
          <p className="text-zinc-500 text-center text-xs mb-8 uppercase tracking-wider">Acesso Restrito - Nível 5</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Senha Mestra</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-red-500 focus:border-red-600 outline-none font-mono tracking-widest pl-10"
                  placeholder="••••••••••••"
                />
                <Key className="absolute left-3 top-3.5 w-4 h-4 text-zinc-600" />
              </div>
            </div>
            
            {error && <div className="text-red-500 text-xs text-center bg-red-950/50 p-2 rounded border border-red-900/50">{error}</div>}
            
            <button 
              disabled={loading}
              className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 font-bold py-3 rounded-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <><ShieldAlert className="w-4 h-4" /> Acessar Sistema</>}
            </button>
          </form>
          
          <button onClick={onExit} className="w-full mt-4 text-zinc-600 text-xs hover:text-zinc-400 transition-colors">
            Voltar para segurança
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-red-900 selection:text-white">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-950 rounded-lg border border-red-900/50">
              <Ghost className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wider">SHADOW PROTOCOL</h1>
              <p className="text-[10px] text-red-500 uppercase tracking-widest font-mono">Super Admin Console</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800">
              <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
              <span className="text-xs font-mono text-zinc-400">SYSTEM ACTIVE</span>
            </div>
            <button onClick={onExit} className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-4 border-t border-zinc-900 pt-4 pb-0">
          <button 
            onClick={() => setActiveTab('shadow')}
            className={`px-4 py-2 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'shadow' ? 'border-red-500 text-red-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            Modo Sombra
          </button>
          <button 
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'sales' ? 'border-purple-500 text-purple-500' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            Gerenciar Vendas
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'history' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            Histórico (Auditoria)
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        
        {activeTab === 'shadow' && (
          <div className="space-y-8 animate-in fade-in">
            {/* 1. GATEWAY CONFIGURATION */}
        <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Database size={100} />
          </div>
          
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-purple-900/20 rounded-lg text-purple-400"><Settings size={20} /></div>
            <h2 className="text-xl font-bold text-white">Configuração do Gateway Sombra (Simplify 2)</h2>
          </div>

          <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            <div>
              <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Public Key (Sombra)</label>
              <input 
                type="text" 
                value={secondaryGatewayConfig.publicKey}
                onChange={e => setSecondaryGatewayConfig(prev => ({...prev, publicKey: e.target.value}))}
                className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-purple-400 font-mono text-sm focus:border-purple-500 outline-none placeholder-zinc-800"
                placeholder="pk_live_..."
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Private Key (Sombra)</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={secondaryGatewayConfig.privateKey}
                  onChange={e => setSecondaryGatewayConfig(prev => ({...prev, privateKey: e.target.value}))}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-purple-400 font-mono text-sm focus:border-purple-500 outline-none placeholder-zinc-800"
                  placeholder="sk_live_..."
                />
                <div className="absolute right-3 top-3 text-zinc-700 pointer-events-none">
                    <Lock size={16} />
                </div>
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end items-center gap-4">
               {secondaryGatewayConfig.publicKey && (
                   <span className="text-xs text-brand-primary flex items-center gap-1">
                       <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse"></div>
                       Configuração Carregada
                   </span>
               )}
              
              {secondaryGatewayConfig.publicKey && (
                  <button 
                    type="button" 
                    onClick={handleDeleteConfig}
                    className="bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                  >
                    <LogOut size={16} /> Remover
                  </button>
              )}

              <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-purple-900/20 flex items-center gap-2">
                <Settings size={16} /> Salvar Credenciais
              </button>
            </div>
          </form>
        </section>

        {/* 2. RAFFLE SHADOW MODE TOGGLE */}
        <section>
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldAlert size={16} /> Controle de Rifas
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {raffles.map(raffle => (
              <div key={raffle.id} className={`relative group border rounded-xl p-5 transition-all ${raffle.useSecondaryGateway ? 'bg-red-950/10 border-red-900/50 shadow-lg shadow-red-900/10' : 'bg-zinc-900 border-zinc-800'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-white truncate max-w-[200px]">{raffle.name}</h4>
                    <p className="text-xs text-zinc-500">ID: {raffle.id.slice(0, 8)}...</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${raffle.useSecondaryGateway ? 'bg-red-900/20 text-red-500 border-red-900/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                    {raffle.useSecondaryGateway ? 'SHADOW MODE ON' : 'NORMAL MODE'}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-zinc-400">
                    Gateway: <span className={raffle.useSecondaryGateway ? 'text-purple-400 font-bold' : 'text-zinc-300'}>{raffle.useSecondaryGateway ? 'Simplify 2 (Oculto)' : 'Padrão (Visível)'}</span>
                  </div>
                  
                  <button 
                    onClick={() => handleToggleShadowMode(raffle.id, raffle.useSecondaryGateway || false)}
                    className={`p-2 rounded-lg transition-colors ${raffle.useSecondaryGateway ? 'bg-red-600 text-[#fff] hover:bg-red-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
                    title={raffle.useSecondaryGateway ? "Desativar Modo Sombra" : "Ativar Modo Sombra"}
                  >
                    {raffle.useSecondaryGateway ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. HIDDEN PURCHASES LIST */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Ghost size={16} /> Vendas Ocultas (Shadow Sales)
            </h3>
            <span className="bg-zinc-900 text-zinc-400 px-3 py-1 rounded-full text-xs font-mono border border-zinc-800">
              {hiddenPurchases.length} registros encontrados
            </span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-950 text-zinc-500 uppercase text-xs font-bold border-b border-zinc-800">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Rifa</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {hiddenPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-zinc-600 italic">
                        Nenhuma venda oculta encontrada. O sistema está limpo.
                      </td>
                    </tr>
                  ) : (
                    hiddenPurchases.map(purchase => (
                      <tr key={purchase.id} className="hover:bg-zinc-800/50 transition-colors group">
                        <td className="px-6 py-4 font-mono text-zinc-400">
                          {new Date(purchase.purchase_date).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-white">{purchase.name}</div>
                          <div className="text-xs text-zinc-500">{purchase.cpf}</div>
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          {purchase.raffles?.name || 'Desconhecida'}
                        </td>
                        <td className="px-6 py-4 font-mono text-brand-primary font-bold">
                          R$ {purchase.total_value?.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => handleRevealPurchase(purchase.id)}
                            className="bg-zinc-800 hover:bg-brand-primary-dark hover:text-white text-zinc-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 mx-auto border border-zinc-700 hover:border-brand-primary"
                          >
                            <Eye size={14} /> Mover para Admin
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        </div>
        )}

        {activeTab === 'sales' && (
          <div className="space-y-8 animate-in fade-in">
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-900/20 rounded-lg text-purple-400"><Search size={20} /></div>
                <h2 className="text-xl font-bold text-white">Buscar Venda Específica</h2>
              </div>
              
              <form onSubmit={handleSearchPurchase} className="flex gap-4">
                <input 
                  type="text" 
                  value={searchPurchaseId}
                  onChange={e => setSearchPurchaseId(e.target.value)}
                  placeholder="Cole o ID da compra aqui..."
                  className="flex-1 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none font-mono"
                />
                <button 
                  type="submit"
                  disabled={isSearching}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2"
                >
                  {isSearching ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />}
                  Buscar
                </button>
              </form>
            </section>

            {purchaseSearchResult && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-start mb-6 pb-6 border-b border-zinc-800">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Detalhes da Compra</h3>
                    <p className="text-zinc-400 text-sm">ID: <span className="font-mono text-zinc-300">{purchaseSearchResult.id}</span></p>
                    <p className="text-zinc-400 text-sm">Rifa: <span className="text-zinc-300">{purchaseSearchResult.raffles?.name}</span></p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    purchaseSearchResult.status === 'PAID' ? 'bg-green-900/20 text-green-500 border-green-900/50' :
                    purchaseSearchResult.status === 'PENDING' ? 'bg-green-900/20 text-green-500 border-green-900/50' :
                    'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    {purchaseSearchResult.status}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-500 uppercase mb-3">Dados do Cliente</h4>
                    <p className="text-white font-medium">{purchaseSearchResult.name}</p>
                    <p className="text-zinc-400 text-sm">{purchaseSearchResult.cpf}</p>
                    <p className="text-zinc-400 text-sm">{purchaseSearchResult.phone}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-500 uppercase mb-3">Bilhetes ({purchaseSearchResult.tickets.length})</h4>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                      {purchaseSearchResult.tickets.map((t: number) => (
                        <span key={t} className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs font-mono border border-zinc-700">
                          {t.toString().padStart(6, '0')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-black/50 border border-zinc-800 rounded-xl p-6">
                  <h4 className="text-sm font-bold text-zinc-500 uppercase mb-4">Ações Restritas</h4>
                  
                  <div className="mb-6">
                    <label className="text-xs text-zinc-500 font-bold uppercase mb-1 block">Senha Mestra (Obrigatória)</label>
                    <div className="relative max-w-xs">
                      <input 
                        type="password" 
                        value={actionPassword}
                        onChange={e => setActionPassword(e.target.value)}
                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-red-500 focus:border-red-600 outline-none font-mono pl-10"
                        placeholder="••••••••"
                      />
                      <Key className="absolute left-3 top-3.5 w-4 h-4 text-zinc-600" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    {purchaseSearchResult.status === 'PENDING' && (
                      <button 
                        onClick={handleManualApprove}
                        className="bg-brand-primary-dark hover:bg-brand-primary text-[#fff] px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2"
                      >
                        <Check size={18} /> Aprovar Manualmente
                      </button>
                    )}
                    
                    {purchaseSearchResult.status === 'PAID' && (
                      <div className="flex flex-col gap-4 w-full">
                        <div className="flex items-center gap-3 bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                          <input 
                            type="number" 
                            value={swapTicketNumber}
                            onChange={e => setSwapTicketNumber(e.target.value)}
                            placeholder="Novo Bilhete"
                            className="bg-black border border-zinc-700 rounded-lg p-2 text-white outline-none w-32 font-mono"
                          />
                          <button 
                            onClick={handleSwapTicket}
                            className="bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 border border-purple-900/50 px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
                          >
                            <RefreshCw size={18} /> Trocar Bilhete
                          </button>
                        </div>

                        <div className="flex items-center gap-3 bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                          <input 
                            type="datetime-local" 
                            value={newPurchaseDate}
                            onChange={e => setNewPurchaseDate(e.target.value)}
                            className="bg-black border border-zinc-700 rounded-lg p-2 text-white outline-none flex-1 font-mono"
                          />
                          <button 
                            onClick={handleUpdatePurchaseDate}
                            className="bg-brand-primary-dark/20 text-brand-primary-light hover:bg-brand-primary-dark/40 border border-blue-900/50 px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
                          >
                            <Calendar size={18} /> Alterar Data
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Calendar className="text-brand-primary" /> Histórico de Auditoria
                      </h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-zinc-400">
                          <thead className="text-xs text-zinc-500 uppercase bg-zinc-950/50 border-b border-zinc-800">
                              <tr>
                                  <th className="px-4 py-3 font-bold">Data/Hora</th>
                                  <th className="px-4 py-3 font-bold">Admin</th>
                                  <th className="px-4 py-3 font-bold">Ação</th>
                                  <th className="px-4 py-3 font-bold">Detalhes</th>
                                  <th className="px-4 py-3 font-bold text-right">Visibilidade</th>
                              </tr>
                          </thead>
                          <tbody>
                              {auditLogs.length === 0 ? (
                                  <tr>
                                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                                          Nenhum registro encontrado.
                                      </td>
                                  </tr>
                              ) : (
                                  auditLogs.map((log) => (
                                      <tr key={log.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                                          <td className="px-4 py-3 whitespace-nowrap">
                                              {new Date(log.created_at).toLocaleString('pt-BR')}
                                          </td>
                                          <td className="px-4 py-3 font-medium text-zinc-300">
                                              {log.admin_email}
                                          </td>
                                          <td className="px-4 py-3">
                                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                  log.action_type === 'APROVAÇÃO MANUAL' ? 'bg-green-900/30 text-green-400' :
                                                  log.action_type === 'TROCA DE BILHETE' ? 'bg-purple-900/30 text-purple-400' :
                                                  'bg-zinc-800 text-zinc-300'
                                              }`}>
                                                  {log.action_type}
                                              </span>
                                          </td>
                                          <td className="px-4 py-3 max-w-xs truncate" title={log.details}>
                                              {log.details}
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                              <button 
                                                  onClick={() => handleToggleAuditLog(log.id, log.hidden_from_admins)}
                                                  className={`p-2 rounded-lg transition-colors ${
                                                      log.hidden_from_admins 
                                                      ? 'bg-red-900/20 text-red-400 hover:bg-red-900/40' 
                                                      : 'bg-blue-900/20 text-brand-primary-light hover:bg-blue-900/40'
                                                  }`}
                                                  title={log.hidden_from_admins ? "Oculto para Admins (Clique para mostrar)" : "Visível para Admins (Clique para ocultar)"}
                                              >
                                                  {log.hidden_from_admins ? <Eye size={16} className="opacity-50" /> : <Eye size={16} />}
                                              </button>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
        )}

      </main>
    </div>
  );
};
