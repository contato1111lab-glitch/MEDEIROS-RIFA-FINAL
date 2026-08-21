import React, { useEffect, useState } from 'react';
import { useCustomerAuth } from '../context/CustomerContext';
import { raffleService } from '../services/raffleService';
import { Trophy, X, Check, Gift } from 'lucide-react';

export const WinnerNotificationManager: React.FC = () => {
  const { customer } = useCustomerAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [currentNotification, setCurrentNotification] = useState<any | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (!customer?.id) {
      setNotifications([]);
      setCurrentNotification(null);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const data = await raffleService.getPendingWinnerNotifications(customer.id);
        if (data && data.length > 0) {
          setNotifications(data);
        }
      } catch (err) {
        console.error('Failed to load winner notifications', err);
      }
    };

    fetchNotifications();
  }, [customer]);

  useEffect(() => {
    if (notifications.length > 0 && !currentNotification) {
      setCurrentNotification(notifications[0]);
    }
  }, [notifications, currentNotification]);

  const handleDismiss = async () => {
    if (!currentNotification || !customer?.id || isDismissing) return;
    setIsDismissing(true);

    try {
      await raffleService.markWinnerAsNotified(customer.id, currentNotification.id);
      
      // Remove the current notification from the list
      setNotifications(prev => prev.slice(1));
      setCurrentNotification(null);
    } catch (err) {
      console.error('Error marking notification as read', err);
    } finally {
      setIsDismissing(false);
    }
  };

  if (!currentNotification) return null;

  const isInstant = currentNotification.prize_type === 'bilhete';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-900 border-2 border-brand-primary/50 shadow-2xl shadow-brand-primary/20 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 relative">
        <button 
          onClick={handleDismiss}
          disabled={isDismissing}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors z-10 bg-black/50 p-2 rounded-full"
        >
          <X size={20} />
        </button>

        <div className="p-8 text-center relative">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/10 to-transparent pointer-events-none"></div>
          
          <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-primary/20 rounded-full mb-6 text-brand-primary animate-bounce">
            {isInstant ? <Gift size={40} /> : <Trophy size={40} />}
          </div>

          <h2 className="text-3xl font-black text-white mb-2 tracking-tight uppercase">Parabéns! 🎉</h2>
          
          <p className="text-zinc-300 text-lg mb-6">
            Você {isInstant ? 'acabou de ganhar um bilhete premiado' : 'foi o ganhador da rifa'}!
          </p>

          <div className="bg-black/50 border border-zinc-800 rounded-xl p-5 mb-6 text-left space-y-3">
            {currentNotification.raffles?.name && (
              <div>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Rifa</p>
                <p className="text-white font-medium">{currentNotification.raffles.name}</p>
              </div>
            )}
            <div>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Bilhete</p>
              <p className="text-brand-primary font-mono text-xl font-bold">{String(currentNotification.ticket_number).padStart(6, '0')}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Prêmio</p>
              <p className="text-white text-lg font-bold">{currentNotification.prize}</p>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4 mb-8">
            <p className="text-blue-200 text-sm font-medium">
              Aguarde! Nossa equipe entrará em contato com você em breve para realizar a entrega do seu prêmio.
            </p>
          </div>

          <button 
            onClick={handleDismiss}
            disabled={isDismissing}
            className="w-full bg-brand-primary-dark hover:bg-brand-primary text-black font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isDismissing ? 'Processando...' : (
              <>
                <Check size={20} /> Entendi
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
