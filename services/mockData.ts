import { Raffle, RaffleStatus } from '../types';

export const INITIAL_RAFFLES: Raffle[] = [
  {
    id: '1',
    name: 'BMW 320i 2024 + 10k no Pix',
    description: 'A máquina dos seus sonhos pode ser sua por apenas centavos!',
    fullDescription: 'Participe agora da ação entre amigos valendo uma BMW 320i M Sport 2024 Zero KM, com teto solar, interior cognac e mais R$ 10.000,00 no Pix para gastar como quiser. O sorteio será realizado pela Loteria Federal assim que 100% das cotas forem vendidas.',
    imageUrl: 'https://images.unsplash.com/photo-1555215695-3004980adade?auto=format&fit=crop&q=80&w=800',
    totalNumbers: 100000,
    soldNumbers: 65420,
    pricePerNumber: 0.99,
    minPurchase: 10,
    status: RaffleStatus.ACTIVE
  },
  {
    id: '2',
    name: 'iPhone 15 Pro Max',
    description: 'O smartphone mais desejado do mundo.',
    fullDescription: 'Leve para casa o novo iPhone 15 Pro Max de 256GB na cor Titânio Natural. Frete grátis para todo o Brasil. Resultado imediato após a conclusão das vendas.',
    imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=800',
    totalNumbers: 1000,
    soldNumbers: 1000,
    pricePerNumber: 15.00,
    minPurchase: 1,
    status: RaffleStatus.FINISHED
  },
  {
    id: '3',
    name: 'PC Gamer "O Monstro"',
    description: 'Setup completo com RTX 4090.',
    fullDescription: 'Setup Gamer completo incluindo Monitor Alienware, Teclado Mecânico, Mouse Logitech e Gabinete Full Tower com RTX 4090 e i9 14900K.',
    imageUrl: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&q=80&w=800',
    totalNumbers: 5000,
    soldNumbers: 1200,
    pricePerNumber: 5.00,
    minPurchase: 2,
    status: RaffleStatus.ACTIVE
  },
  {
    id: '4',
    name: 'Honda CB 650R',
    description: 'Acelere com estilo nessa nave de 4 cilindros.',
    fullDescription: 'Moto Honda CB 650R 2024 Vermelha. Documentação 2024 paga. Tanque cheio. Capacete Norisk incluso.',
    imageUrl: 'https://images.unsplash.com/photo-1628522307223-2895f36e6ea9?auto=format&fit=crop&q=80&w=800',
    totalNumbers: 20000,
    soldNumbers: 19800,
    pricePerNumber: 1.99,
    minPurchase: 5,
    status: RaffleStatus.ACTIVE
  }
];