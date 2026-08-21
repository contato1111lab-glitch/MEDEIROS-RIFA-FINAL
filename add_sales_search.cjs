const fs = require('fs');
let code = fs.readFileSync('components/AdminPanel.tsx', 'utf8');

const target1 = "const [salesPage, setSalesPage] = useState(1);";
const replacement1 = `const [salesPage, setSalesPage] = useState(1);
  const [salesSearch, setSalesSearch] = useState('');`;

code = code.replace(target1, replacement1);

const target2 = `      // Filter
      if (salesFilterStatus !== 'ALL') {`;
const replacement2 = `      // Filter
      if (salesSearch) {
          const lower = salesSearch.toLowerCase();
          result = result.filter(p => p.name?.toLowerCase().includes(lower) || p.cpf?.includes(lower));
      }
      if (salesFilterStatus !== 'ALL') {`;

code = code.replace(target2, replacement2);

const target3 = `                        <div className="flex flex-wrap gap-2">
                            <select 
                                value={salesFilterStatus}`;
const replacement3 = `                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar por nome ou CPF..." 
                                    value={salesSearch}
                                    onChange={(e) => { setSalesSearch(e.target.value); setSalesPage(1); }}
                                    className="bg-zinc-950 border border-zinc-700 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:border-brand-primary outline-none min-w-[250px]"
                                />
                            </div>
                            <select 
                                value={salesFilterStatus}`;

code = code.replace(target3, replacement3);

const target4 = `                                        <td className="p-4">
                                            <a 
                                                href={\`https://wa.me/55\${(u.phone || '').replace(/\\D/g, '')}\`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-brand-primary hover:text-brand-primary-light bg-zinc-950 rounded hover:bg-zinc-800 transition-colors inline-flex"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>
                                            </a>
                                        </td>`;
const replacement4 = `                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setActiveTab('sales');
                                                        setSalesSearch(u.cpf || '');
                                                    }}
                                                    className="px-3 py-1.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary hover:text-black transition-colors flex items-center gap-1"
                                                >
                                                    <Ticket size={14} /> Ver Bilhetes
                                                </button>
                                                <a 
                                                    href={\`https://wa.me/55\${(u.phone || '').replace(/\\D/g, '')}\`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 text-brand-primary hover:text-brand-primary-light bg-zinc-950 rounded hover:bg-zinc-800 transition-colors inline-flex border border-zinc-800"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>
                                                </a>
                                            </div>
                                        </td>`;
code = code.replace(target4, replacement4);

fs.writeFileSync('components/AdminPanel.tsx', code);
