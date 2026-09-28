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
  
  const minVal = Number(rankingMinValue) || 0;
  const minTickets = (minVal > 0 && pricePerNumber > 0) ? Math.ceil(minVal / pricePerNumber) : 0;

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
    .filter(item => {
      if (minTickets <= 0) return true;
      return item.totalTickets >= minTickets;
    })
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
          <Trophy className="text-brand-primary animate-bounce duration-1000" size={20} />
          <h3 className="text-lg font-black uppercase tracking-tighter" style={{ color: '#111111' }}>Top Compradores</h3>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-center shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide" style={{ color: '#111111' }}>Ranking ainda não começou</p>
          {startDate && (
            <p className="mt-1 text-xs font-bold" style={{ color: '#444444' }}>Começa em {formatDateTime(startDate)}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 my-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
            <Trophy className="text-brand-primary animate-bounce duration-1000" size={20} />
            <h3 className="text-lg font-black uppercase tracking-tighter" style={{ color: '#111111' }}>Top Compradores</h3>
        </div>
        {status === 'ended' ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-200 rounded-full border border-zinc-300 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500"></div>
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#444444' }}>Encerrado</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#d1fae5] rounded-full border border-[#6ee7b7] shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#065f46' }}>AO VIVO</span>
          </div>
        )}
      </div>

      {status === 'ended' && (
        <div className="mb-4 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-center shadow-md">
          <p className="text-xs font-black leading-relaxed" style={{ color: '#111111' }}>
            🏆 Ranking encerrado{endDate ? ` em ${formatDateTime(endDate)}` : ''}. Resultado final homologado abaixo.
          </p>
        </div>
      )}

      {status === 'live' && endDate && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-[#fef3c7] px-4 py-3 text-center shadow-md animate-pulse">
          <p className="text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5" style={{ color: '#78350f' }}>
            ⏰ Encerra em {formatDateTime(endDate)}
          </p>
        </div>
      )}

      {status === 'live' && rankingMinValue && rankingMinValue > 0 && (
        <div className="mb-4 rounded-xl border border-brand-primary bg-brand-primary px-4 py-3 text-center flex items-center justify-center gap-2 shadow-md">
          <Trophy size={14} className="text-[#ffffff]" />
          <p className="text-xs font-black text-[#ffffff]">
            Participe com no mínimo <span className="underline font-black">R$ {rankingMinValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> em compras.
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
                relative flex items-center justify-between p-4 rounded-xl border transition-all overflow-hidden group shadow-sm
                ${isLeader ? 'bg-[#fefbf0] border-amber-300 shadow-md' : ''}
                ${position === 2 ? 'bg-zinc-50 border-zinc-200' : ''}
                ${position === 3 ? 'bg-orange-50/70 border-orange-200' : ''}
                ${position > 3 ? 'bg-[#ffffff] border-zinc-200' : ''}
              `}
            >
              {/* Rank Badge */}
              <div className="flex items-center gap-3 sm:gap-4 z-10 min-w-0 flex-1 mr-2">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-md shrink-0
                  ${isLeader ? 'bg-brand-primary text-[#ffffff] ring-2 ring-brand-primary/40' : ''}
                  ${position === 2 ? 'bg-zinc-500 text-[#ffffff]' : ''}
                  ${position === 3 ? 'bg-orange-600 text-[#ffffff]' : ''}
                  ${position > 3 ? 'bg-zinc-200 text-[#111111] border border-zinc-300 font-black' : ''}
                `}>
                  {isLeader ? <Crown size={20} fill="#ffffff" className="text-[#ffffff]" /> : position}
                </div>

                <div className="min-w-0 flex-1">
                  {buyer ? (
                    <>
                        <div className="font-black text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                            <span className="truncate" style={{ color: '#111111' }}>{buyer.name.split(' ')[0]} {buyer.name.split(' ').length > 1 ? buyer.name.split(' ')[1][0] + '.' : ''}</span>
                            {isLeader && <span className="text-[9px] sm:text-[10px] bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded border border-brand-primary/30 font-black tracking-wider shrink-0">LÍDER</span>}
                        </div>
                        <div className="text-[11px] sm:text-xs flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5">
                            <span className="font-extrabold px-2.5 py-0.5 rounded border shrink-0 shadow-inner" style={{ color: '#111111', backgroundColor: '#f4f4f5', borderColor: '#e4e4e7' }}>{buyer.totalTickets} cotas</span>
                            <span className="w-0.5 h-0.5 sm:w-1 sm:h-1 bg-zinc-400 rounded-full shrink-0"></span>
                            <span className="font-black px-2.5 py-0.5 rounded border shrink-0 shadow-sm" style={{ color: '#111111', backgroundColor: '#f4f4f5', borderColor: '#e4e4e7' }}>R$ {(buyer.totalTickets * pricePerNumber).toFixed(2).replace('.', ',')}</span>
                        </div>
                    </>
                  ) : (
                    <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2" style={{ color: '#444444' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#444444]"></span>
                        Disponível
                    </div>
                  )}
                </div>
              </div>

              {/* Prize */}
              <div className="text-right z-10 pl-2 shrink-0">
                {prize ? (
                    <>
                        <div className="text-[10px] uppercase font-black tracking-wider mb-1" style={{ color: '#444444' }}>Prêmio</div>
                        <div className="text-xs font-black px-2.5 py-1.5 rounded-lg border inline-block max-w-[120px] truncate uppercase tracking-tight shadow-sm bg-brand-primary text-[#ffffff] border-brand-primary">
                          {prize}
                        </div>
                    </>
                ) : (
                    <div className="text-[10px] uppercase font-bold" style={{ color: '#444444' }}>
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

      <p className="text-center text-[10px] font-black mt-4 uppercase tracking-widest flex items-center justify-center gap-1.5" style={{ color: '#444444' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></span>
        Atualizado em tempo real
      </p>

      {/* Ranking History */}
      {history.length > 0 && (
          <div className="mt-8 pt-8 border-t border-zinc-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2 mb-4">
                  <Trophy style={{ color: '#111111' }} size={16} />
                  <h3 className="text-sm font-extrabold uppercase tracking-wider" style={{ color: '#111111' }}>Ganhadores Anteriores</h3>
              </div>
              
              <div className="space-y-3">
                  {history.map((h: any) => (
                      <div key={h.id} className="flex items-center justify-between bg-[#ffffff] p-3.5 rounded-xl border border-zinc-200 hover:border-zinc-300 transition-colors shadow-sm">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs text-zinc-600 font-bold border border-zinc-200 shadow-inner">
                                  🏆
                              </div>
                              <div>
                                  <p className="text-sm font-black" style={{ color: '#111111' }}>{h.winnerName}</p>
                                  <p className="text-[10px] font-mono mt-0.5 font-bold" style={{ color: '#444444' }}>
                                      <span>{new Date(h.cycleEndDate).toLocaleDateString()}</span> • <span className="font-black" style={{ color: '#111111' }}>{h.totalTickets} cotas</span>
                                  </p>
                              </div>
                          </div>
                          <div className="text-right">
                              <span className="text-[10px] font-black bg-brand-primary text-[#ffffff] px-2.5 py-1.5 rounded-lg border border-brand-primary uppercase tracking-wider shadow-sm">
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
