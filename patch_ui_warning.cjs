const fs = require('fs');
const file = 'components/TopBuyersRanking.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `      {status === 'live' && endDate && (
        <div className="mb-4 rounded-lg border border-blue-900/30 bg-blue-900/10 px-4 py-2.5 text-center">
          <p className="text-xs text-blue-300">Encerra em {formatDateTime(endDate)}</p>
        </div>
      )}`;

const replacement = `      {status === 'live' && endDate && (
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
      )}`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
