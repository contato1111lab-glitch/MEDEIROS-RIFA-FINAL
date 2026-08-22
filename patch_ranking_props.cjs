const fs = require('fs');
const file = 'components/TopBuyersRanking.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    'manualEntries?: { name: string; phone?: string; totalTickets: number }[];\n}',
    'manualEntries?: { name: string; phone?: string; totalTickets: number }[];\n  rankingMinValue?: number | null;\n}'
);

code = code.replace(
    'manualEntries\n}: TopBuyersRankingProps)',
    'manualEntries,\n  rankingMinValue\n}: TopBuyersRankingProps)'
);

fs.writeFileSync(file, code);
