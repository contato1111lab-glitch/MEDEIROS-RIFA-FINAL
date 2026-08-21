import React, { useState, useEffect } from 'react';
import { Navbar } from './Navbar';
import { AuthModal } from './AuthModal';
import { useCustomerAuth } from '../context/CustomerContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Trophy, 
  Ticket, 
  UserPlus, 
  Users, 
  FileText, 
  MessageCircle, 
  X,
  LogIn,
  LogOut,
  User
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { useTheme } from '../context/ThemeContext';

import { PurchaseNotification } from './PurchaseNotification';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { brandPrimary, brandSecondary } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { customer, openAuthModal, logout } = useCustomerAuth();

  const baseMenuItems = [
    { icon: Home, label: 'Início', path: '/' },
    { icon: Trophy, label: 'Campanhas', path: '/campanhas' },
    { icon: Ticket, label: 'Meus bilhetes', path: '/meus-bilhetes' },
    { icon: UserPlus, label: 'Cadastro', path: '/cadastro' },
    { icon: Trophy, label: 'Ganhadores', path: '/ganhadores' },
    { icon: FileText, label: 'Termos de uso', path: '/termos' },
    { icon: MessageCircle, label: 'Suporte', path: '/suporte' },
  ];

  const menuItems = baseMenuItems.filter(item => {
    if (customer && item.path === '/cadastro') return false;
    return true;
  });

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg font-sans selection:bg-brand-primary selection:text-black relative">
      {/* Auth Modal */}
      <AuthModal />

      {/* Navbar */}
      <Navbar onMenuClick={() => setIsMenuOpen(true)} />

      {/* Side Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-80 bg-brand-bg z-50 flex flex-col shadow-2xl border-r border-brand-border"
            >
              <div className="p-6 flex items-center justify-between border-b border-brand-border bg-black/50">
                <div className="flex items-center gap-2">
                    <BrandLogo className="font-black text-xl tracking-tighter" />
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-4 space-y-1">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-4 px-8 py-3.5 transition-all relative group ${
                      isActive(item.path)
                        ? 'text-brand-primary bg-brand-primary/5'
                        : 'text-zinc-500 hover:text-white hover:bg-zinc-900/50'
                    }`}
                  >
                    {isActive(item.path) && (
                        <motion.div 
                            layoutId="active-indicator"
                            className="absolute left-0 top-0 bottom-0 w-1 bg-brand-primary shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                        />
                    )}
                    <item.icon size={20} className={isActive(item.path) ? 'text-brand-primary' : 'text-zinc-600 group-hover:text-zinc-400'} />
                    <span className="font-black uppercase tracking-widest text-[10px]">{item.label}</span>
                  </Link>
                ))}
              </nav>

              {/* Customer Account Box at bottom of Drawer */}
              <div className="border-t border-brand-border py-2">
                {customer ? (
                  <>
                    <div className="flex items-center gap-4 px-8 py-3 mb-1">
                      <div className="w-8 h-8 rounded-xl bg-brand-primary text-black flex items-center justify-center font-black text-sm">
                        {customer.fullName?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="overflow-hidden text-left">
                        <p className="text-xs font-black text-white uppercase tracking-wider truncate">{customer.fullName}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{customer.phone}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { logout(); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-4 px-8 py-3.5 transition-all group text-red-500/70 hover:text-red-400 hover:bg-red-500/10 cursor-pointer text-left"
                    >
                      <LogOut size={20} className="text-red-500/50 group-hover:text-red-400/70" />
                      <span className="font-black uppercase tracking-widest text-[10px]">Sair da Conta</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { openAuthModal('login'); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-4 px-8 py-3.5 transition-all group text-brand-primary hover:text-brand-primary-light hover:bg-brand-primary/10 cursor-pointer text-left"
                  >
                    <LogIn size={20} className="text-brand-primary-dark group-hover:text-brand-primary" />
                    <span className="font-black uppercase tracking-widest text-[10px]">Entrar na Minha Conta</span>
                  </button>
                )}
              </div>

              <div className="p-6 border-t border-brand-border bg-black/50">
                <div className="text-center">
                    <span className="text-[9px] text-zinc-700 font-black uppercase tracking-[0.2em]">Versão 1.9.3</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 relative">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-black border-t border-brand-border py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
                <BrandLogo className="font-black text-2xl tracking-tighter" />
            </div>
            <div className="text-zinc-500 text-sm text-center md:text-right">
                <p>© {new Date().getFullYear()} {brandPrimary} {brandSecondary}. Todos os direitos reservados.</p>
                <div className="flex gap-4 mt-2 justify-center md:justify-end">
                    <Link to="/termos" className="hover:text-brand-primary transition-colors">Termos de uso</Link>
                    <Link to="/suporte" className="hover:text-brand-primary transition-colors">Suporte</Link>
                </div>
            </div>
        </div>
      </footer>
      <PurchaseNotification />
    </div>
  );
};
