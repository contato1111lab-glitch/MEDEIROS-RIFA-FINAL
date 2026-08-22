import { ErrorBoundary } from './components/ErrorBoundary';
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CustomerProvider } from './context/CustomerContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { MetaPixelManager } from './components/MetaPixelManager';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { RaffleDetails } from './components/RaffleDetails';
import { MyTickets } from './components/MyTickets';
import { AdminPanel } from './components/AdminPanel';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import { RegisterPage } from './components/RegisterPage';
import { WinnersPage } from './components/WinnersPage';
import { TermsPage } from './components/TermsPage';
import { SupportPage } from './components/SupportPage';
import { AnnouncementsPage } from './components/AnnouncementsPage';
import { CampaignsPage } from './components/CampaignsPage';
import { WinnerNotificationManager } from './components/WinnerNotificationManager';
import { WHITE_LABEL_CONFIG } from './white-label';
import { useParams, useNavigate } from 'react-router-dom';
import { raffleService } from './services/raffleService';
import { Raffle } from './types';

const SplashScreen = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-brand-bg text-white z-50">
    <div className="animate-pulse flex flex-col items-center">
      <h1 className="text-3xl font-black tracking-tighter uppercase mb-6 text-center">
        <span className="text-brand-primary">{WHITE_LABEL_CONFIG.brandPrimary}</span>{' '}
        {WHITE_LABEL_CONFIG.brandSecondary && <span>{WHITE_LABEL_CONFIG.brandSecondary}</span>}
      </h1>
      <div className="w-8 h-8 border-4 border-zinc-800 border-t-brand-primary rounded-full animate-spin"></div>
    </div>
  </div>
);

const AppContent = () => {
  const { isInitialized } = useTheme();

  if (!isInitialized) {
    return <SplashScreen />;
  }

  return (
    <CustomerProvider>
      <Router>
        <MetaPixelManager />
        <WinnerNotificationManager />
        <Routes>
          {/* Admin Routes (No Layout) */}
          <Route path="/adm" element={<AdminPanel onExit={() => window.location.hash = '#/'} />} />
          <Route path="/superadm" element={<SuperAdminPanel onExit={() => window.location.hash = '#/'} />} />

          {/* Main App Routes (With Layout) */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/campanhas" element={<CampaignsPage />} />
                <Route path="/rifa/:id" element={<RaffleDetailsWrapper />} />
                <Route path="/meus-bilhetes" element={<MyTickets />} />
                <Route path="/cadastro" element={<RegisterPage />} />
                <Route path="/ganhadores" element={<WinnersPage />} />
                <Route path="/termos" element={<TermsPage />} />
                <Route path="/suporte" element={<SupportPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </Router>
    </CustomerProvider>
  );
};

const App: React.FC = () => {
  React.useEffect(() => {
    raffleService.getSiteSettings().then(s => {
      if (s) raffleService.applySiteSettingsToDom(s);
    }).catch(console.error);

    // Global image protection against right-click context menu and dragstart
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'IMG' ||
          target.closest('img') ||
          target.closest('[data-protected-image]') ||
          target.closest('.no-context-menu') ||
          target.closest('.protected-card'))
      ) {
        e.preventDefault();
      }
    };

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'IMG' ||
          target.closest('img') ||
          target.closest('[data-protected-image]'))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  return (
    <ErrorBoundary>
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
    </ErrorBoundary>
  );
};

// Wrapper to handle raffle selection from URL

const RaffleDetailsWrapper = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [raffle, setRaffle] = React.useState<Raffle | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (id) {
      raffleService.getRaffleById(id).then(r => {
        setRaffle(r || null);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) return <div className="p-20 text-center text-brand-primary font-black uppercase tracking-widest animate-pulse">Carregando...</div>;
  if (!raffle) return <div className="p-20 text-center text-red-500 font-black uppercase tracking-widest">Rifa não encontrada</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <RaffleDetails 
        raffle={raffle} 
        onBack={() => navigate('/')}
        onBuy={() => {}} // This will be handled inside RaffleDetails or via a modal
      />
    </div>
  );
};

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="max-w-6xl mx-auto px-4 py-20 text-center">
    <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">{title}</h2>
    <p className="text-zinc-500 font-bold uppercase tracking-widest">Esta página está em desenvolvimento.</p>
  </div>
);

export default App;
