import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { raffleService } from '../services/raffleService';

const MOCK_NAMES = [
  'João M.', 'Maria A.', 'Carlos F.', 'Ana P.', 'Pedro H.',
  'Lucas S.', 'Juliana C.', 'Rafael B.', 'Fernanda T.', 'Marcos V.',
  'Camila R.', 'Bruno G.', 'Amanda L.', 'Diego M.', 'Letícia S.',
  'Thiago P.', 'Beatriz F.', 'Gabriel C.', 'Larissa N.', 'Rodrigo D.',
  'Mariana B.', 'Felipe A.', 'Natália M.', 'Leonardo S.', 'Patrícia C.',
  'Gustavo R.', 'Aline F.', 'Marcelo O.', 'Renata V.', 'Eduardo T.',
  'Carolina M.', 'Vinícius B.', 'Isabela P.', 'Ricardo H.', 'Daniela G.',
  'Henrique S.', 'Vanessa L.', 'Alexandre C.', 'Talita F.', 'Igor M.',
  'Bianca R.', 'André S.', 'Priscila A.', 'Caio T.', 'Jessica M.',
  'Guilherme F.', 'Luana P.', 'Fernando S.', 'Thais C.', 'Vitor B.',
  'Roberto C.', 'Elaine P.', 'Sérgio A.', 'Julio N.', 'Clarice T.',
  'Mauro F.', 'Tatiana O.', 'Fábio R.', 'Michele S.', 'Leandro C.',
  'Paula L.', 'Elias M.'
];

interface NotificationData {
  id: string;
  name: string;
  quantity: number;
}

export function PurchaseNotification() {
  const [notification, setNotification] = useState<NotificationData | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isMounted = true;
    
    const scheduleNextNotification = () => {
      if (!isMounted) return;
      const minMs = 6500;
      const maxMs = 18200;
      const nextInterval = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
      
      timeoutId = setTimeout(() => {
        showNotification();
      }, nextInterval);
    };

    const showNotification = async () => {
      try {
        const settings = await raffleService.getSiteSettings();
        if (settings.notificationEnabled === false) {
            scheduleNextNotification();
            return;
        }

        const raffles = await raffleService.getAllRaffles();
        const activeRaffles = raffles.filter(r => r.status === 'ACTIVE');
        
        if (activeRaffles.length === 0) {
            scheduleNextNotification();
            return;
        }

        const randomRaffle = activeRaffles[Math.floor(Math.random() * activeRaffles.length)];
        
        const raffleMin = randomRaffle.minPurchase || 20;
        const configMin = Math.max(settings.notificationMin, raffleMin);
        const configMax = Math.max(settings.notificationMax, configMin);
        
        const power = 3;
        const mathRandom = Math.pow(Math.random(), power);
        const randomQuantity = Math.floor(configMin + (mathRandom * (configMax - configMin + 1)));
        
        const randomName = MOCK_NAMES[Math.floor(Math.random() * MOCK_NAMES.length)];
        
        if (isMounted) {
            setNotification({
            id: Date.now().toString(),
            name: randomName,
            quantity: randomQuantity,
            });

            setTimeout(() => {
            if (isMounted) {
                setNotification(null);
                scheduleNextNotification();
            }
            }, 4800);
        }
      } catch (error) {
         scheduleNextNotification();
      }
    };

    scheduleNextNotification();

    return () => {
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, []);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          key={notification.id}
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto z-50 flex items-center gap-3 bg-[#ffffff]/95 backdrop-blur-md text-gray-800 px-4 py-3 rounded-2xl shadow-2xl border border-gray-200/50 max-w-sm"
        >
          <div className="flex-shrink-0 bg-brand-primary/10 p-2 rounded-full">
            <ShoppingBag className="w-5 h-5 text-brand-primary-dark" />
          </div>
          <div className="text-sm font-medium leading-tight">
            <span className="font-bold text-gray-900">{notification.name}</span> acabou de comprar <span className="font-bold text-brand-primary-dark">{notification.quantity} {notification.quantity === 1 ? 'cota' : 'cotas'}</span>.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
