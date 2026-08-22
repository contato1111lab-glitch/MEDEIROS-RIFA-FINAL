import React, { useEffect, useState } from 'react';
import { Trophy, Crown, User } from 'lucide-react';
import { raffleService } from '../services/raffleService';

interface TopBuyersRankingProps {
  raffleId: string;
  config: { position: number; prize: string }[];
  pricePerNumber: number;
  /** Início do ciclo. Antes desta data o ranking ainda não começou. */
  startDate?: string | null;
  /** Fim do ciclo. Depois desta data o ranking fica congelado. */
  endDate?: string | null;
  /**
   * Compradores cadastrados manualmente no admin ("ranking manual").
   *
   * Eram salvos no formulário e devolvidos a ele, mas nunca chegavam a esta
   * tela: o bloco só mostrava compradores reais, então a configuração não
   * produzia efeito nenhum para o visitante.
   */
  manualEntries?: { name: string; phone?: string; totalTickets: number }[];
  rankingMinValue?: number | null;
}

type CycleStatus = 'pending' | 'live' | 'ended';

/**
 * Estado do ciclo de ranking.
 *
 * As datas eram salvas no admin e devolvidas ao formulário, mas nada as
 * comparava com a hora atual: o ranking ficava permanentemente no ar e somava
 * cotas de qualquer época. A contagem em si é filtrada no serviço; aqui só
 * decidimos o que mostrar.
 */
function getCycleStatus(startDate?: string | null, endDate?: string | null): CycleStatus {
  const now = Date.now();
  if (startDate) {
    const start = new Date(startDate).getTime();
    if (!Number.isNaN(start) && now < start) return 'pending';
  }
  if (endDate) {
    const end = new Date(endDate).getTime();
    if (!Number.isNaN(end) && now > end) return 'ended';
  }
  return 'live';
}

function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface RankingItem {
  name: string;
  phone: string;
  totalTickets: number;
  ranking: number;
}

export const TopBuyersRanking: React.FC<TopBuyersRankingProps> = ({ raffleId, config, pricePerNumber, startDate, endDate, manualEntries, rankingMinValue }) => {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CycleStatus>(() => getCycleStatus(startDate, endDate));

  useEffect(() => {
    loadRanking();
    loadHistory();

    // Reavalia o estado do ciclo a cada minuto, para a virada do horário de
    // término acontecer sozinha, sem precisar recarregar a página.
    const statusTimer = setInterval(() => {
      setStatus(getCycleStatus(startDate, endDate));
    }, 60000);

    // Encerrado: os números não mudam mais, então não faz sentido continuar
    // consultando o servidor a cada 15 segundos.
    const refresh = getCycleStatus(startDate, endDate) === 'ended'
      ? null
      : setInterval(loadRanking, 15000);

    return () => {
      clearInterval(statusTimer);
      if (refresh) clearInterval(refresh);
    };
  }, [raffleId, startDate, endDate]);

  const loadRanking = async () => {
    try {
      // Fetch enough items to cover the config
      const maxPosition = Math.max(...config.map(c => c.position), 5);
      const data = await raffleService.getRaffleRanking(raffleId, maxPosition);
      setRanking(data);
    } catch (error) {
      console.error("Error loading ranking", error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
      try {
          const data = await raffleService.getRankingHistory(raffleId);
          setHistory(data);
      } catch (e) {
          console.error(e);
      }
  };

  if (loading && ranking.length === 0 && !(manualEntries && manualEntries.length)) return <div className="animate-pulse h-32 bg-zinc-900/50 rounded-xl mx-4 my-4 border border-zinc-800"></div>;
  
  // If no config, don't show anything (or show default top 3? User asked for configured ones)
  // UPDATE: User wants ALWAYS at least 5 positions shown, regardless of config.
  
  // Determine how many rows to show: Max of (configured positions, 5)
  const maxConfigPosition = config.length > 0 ? Math.max(...config.map(c => c.position)) : 0;
  const rowsToShow = Math.max(maxConfigPosition, 5);

  // Create an array of positions [1, 2, 3, 4, 5, ...]
  const positions = Array.from({ length: rowsToShow }, (_, i) => i + 1);
  
  /**
   * Junta os compradores reais com os cadastrados manualmente e reordena por
   * quantidade de cotas, renumerando as posições. Sem isto, o ranking manual
   * configurado no admin não aparecia para o visitante.
   */
  const merged: RankingItem[] = [...ranking, ...(manualEntries || []).map(m => ({
    name: m.name,
    phone: m.phone || '',
    totalTickets: Number(m.totalTickets) || 0,
    ranking: 0,
  }))]
    .sort((a, b) => b.totalTickets - a.totalTickets)
    .map((item, index) => ({ ...item, ranking: index + 1 }));

  // Create a map of actual ranking data for quick lookup
  const rankingMap = new Map(merged.map(item => [item.ranking, item]));

  // Create a map of prize config for quick lookup
  const configMap = new Map(config.map(item => [item.position, item.prize]));

  // Ciclo ainda não começou: anuncia a abertura em vez de mostrar um pódio vazio.
  if (status === 'pending') {
    return (
      <div className="mx-4 my-6">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="text-brand-primary" size={20} />
          <h3 className="text-lg font-bold text-white uppercase tracking-wider">Top Compradores</h3>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
          <p className="text-sm font-bold text-white uppercase tracking-wide">Ranking ainda não começou</p>
          {startDate && (
            <p className="mt-1 text-xs text-zinc-500">Começa em {formatDateTime(startDate)}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 my-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <Trophy className="text-brand-primary" size={20} />
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Top Compradores</h3>
        </div>
        {status === 'ended' ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/60 rounded border border-zinc-700">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500"></div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Encerrado</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-900/20 rounded border border-blue-900/30">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></div>
              <span className="text-[10px] text-brand-primary font-bold uppercase tracking-wide">Ao Vivo</span>
          </div>
        )}
      </div>

      {status === 'ended' && (
        <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-center">
          <p className="text-xs text-zinc-400">
            Ranking encerrado{endDate ? ` em ${formatDateTime(endDate)}` : ''}. Resultado final abaixo.
          </p>
        </div>
      )}

      {status === 'live' && endDate && (
        <div className="mb-4 rounded-lg border border-blue-900/30 bg-blue-900/10 px-4 py-2.5 text-center">
          <p className="text-xs text-blue-300">Encerra em {formatDateTime(endDate)}</p>
        </div>
      )}

      {status === 'live' && rankingMinValue && rankingMinValue > 0 && (
        <div className="mb-4 rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-4 py-2.5 text-center flex items-center justify-center gap-2">
          <Trophy size={14} className="text-brand-primary" />
          <p className="text-xs font-bold text-brand-primary-light">
            Participe com no mínimo R$ {rankingMinValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em compras.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {positions.map((position) => {
          const buyer = rankingMap.get(position);
          const prize = configMap.get(position);
          const isLeader = position === 1;
          
          return (
            <div 
              key={position}
              className={`
                relative flex items-center justify-between p-4 rounded-xl border transition-all overflow-hidden group
                ${isLeader ? 'bg-gradient-to-r from-yellow-950/40 to-black border-brand-primary-dark/50 shadow-lg shadow-blue-900/10' : ''}
                ${position === 2 ? 'bg-gradient-to-r from-zinc-900 to-black border-zinc-700' : ''}
                ${position === 3 ? 'bg-gradient-to-r from-orange-950/30 to-black border-orange-800/50' : ''}
                ${position > 3 ? 'bg-zinc-900/30 border-zinc-800' : ''}
              `}
            >
              {/* Rank Badge */}
              <div className="flex items-center gap-4 z-10">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-inner shrink-0
                  ${isLeader ? 'bg-brand-primary text-black ring-2 ring-brand-primary/50' : ''}
                  ${position === 2 ? 'bg-zinc-400 text-black' : ''}
                  ${position === 3 ? 'bg-orange-700 text-[#fff]' : ''}
                  ${position > 3 ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' : ''}
                `}>
                  {isLeader ? <Crown size={20} fill="black" /> : position}
                </div>

                <div>
                  {buyer ? (
                    <>
                        <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                            {buyer.name.split(' ')[0]} {buyer.name.split(' ').length > 1 ? buyer.name.split(' ')[1][0] + '.' : ''}
                            {isLeader && <span className="text-[9px] sm:text-[10px] bg-brand-primary/20 text-brand-primary px-1 sm:px-1.5 py-0.5 rounded border border-brand-primary/30 font-bold">LÍDER</span>}
                        </div>
                        <div className="text-[10px] sm:text-xs text-zinc-400 font-mono flex items-center gap-1.5 sm:gap-2 mt-0.5">
                            <span className="text-white font-bold">{buyer.totalTickets} cotas</span>
                            <span className="w-0.5 h-0.5 sm:w-1 sm:h-1 bg-zinc-600 rounded-full"></span>
                            <span className="text-brand-primary">R$ {(buyer.totalTickets * pricePerNumber).toFixed(2)}</span>
                        </div>
                    </>
                  ) : (
                    <div className="font-bold text-zinc-500 text-xs sm:text-sm flex items-center gap-2 italic">
                        Disponível
                    </div>
                  )}
                </div>
              </div>

              {/* Prize */}
              <div className="text-right z-10 pl-2">
                {prize ? (
                    <>
                        <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Prêmio</div>
                        <div className={`text-xs font-bold px-2 py-1 rounded border inline-block max-w-[120px] truncate ${
                            buyer 
                            ? 'text-brand-primary-light bg-blue-900/20 border-blue-900/30' 
                            : 'text-zinc-500 bg-zinc-900 border-zinc-800'
                        }`}>
                        {prize}
                        </div>
                    </>
                ) : (
                    <div className="text-[10px] text-zinc-600 uppercase font-bold">
                        -
                    </div>
                )}
              </div>
              
              {/* Background Effects for Leader */}
              {isLeader && buyer && (
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/5 to-transparent pointer-events-none animate-pulse"></div>
              )}
            </div>
          );
        })}
      </div>
      
      <p className="text-center text-[10px] text-zinc-600 mt-4 uppercase tracking-widest">
        Atualizado em tempo real
      </p>

      {/* Ranking History */}
      {history.length > 0 && (
          <div className="mt-8 pt-8 border-t border-zinc-800 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2 mb-4">
                  <Trophy className="text-zinc-500" size={16} />
                  <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Ganhadores Anteriores</h3>
              </div>
              
              <div className="space-y-3">
                  {history.map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50 hover:bg-zinc-900 transition-colors">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-500 font-bold border border-zinc-700">
                                  🏆
                              </div>
                              <div>
                                  <p className="text-sm font-bold text-white">{h.winnerName}</p>
                                  <p className="text-[10px] text-zinc-500 font-mono">
                                      {new Date(h.cycleEndDate).toLocaleDateString()} • {h.totalTickets} cotas
                                  </p>
                              </div>
                          </div>
                          <div className="text-right">
                              <span className="text-[10px] font-bold text-brand-primary bg-blue-900/10 px-2 py-1 rounded border border-blue-900/20 uppercase tracking-wide">
                                  {h.prizeDescription}
                              </span>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};
