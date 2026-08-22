const fs = require('fs');
const file = 'components/AdminPanel.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = '                                        </div>\n\n                                        <div className="flex flex-wrap gap-2 mb-4 items-end">';
const replacement = `                                        </div>

                                        {/* Ranking Minimum Value Config */}
                                        <div className="mb-6 border-b border-zinc-800 pb-6">
                                            <div className="flex items-center gap-3 mb-4">
                                                <input 
                                                    type="checkbox" 
                                                    id="enableRankingMin"
                                                    className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-brand-primary-dark focus:ring-brand-primary"
                                                    checked={!!formData.rankingMinValue}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setFormData({...formData, rankingMinValue: 50});
                                                        } else {
                                                            setFormData({...formData, rankingMinValue: null});
                                                        }
                                                    }}
                                                />
                                                <label htmlFor="enableRankingMin" className="text-sm font-bold text-white cursor-pointer select-none">
                                                    Ativar Valor Mínimo para Top Comprador
                                                </label>
                                            </div>
                                            
                                            {!!formData.rankingMinValue && (
                                                <div className="bg-zinc-900/50 p-4 rounded-lg">
                                                    <label className="label-admin">VALOR MÍNIMO PARA PARTICIPAR DO TOP COMPRADOR (R$)</label>
                                                    <div className="relative max-w-xs">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</span>
                                                        <input 
                                                            type="number"
                                                            min="1"
                                                            step="0.01"
                                                            className="input-admin pl-10"
                                                            value={formData.rankingMinValue}
                                                            onChange={e => setFormData({...formData, rankingMinValue: parseFloat(e.target.value) || 0})}
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-zinc-500 mt-2">Somente compradores com valor total acumulado igual ou superior a este valor aparecerão no ranking.</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-4 items-end">`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
