const fs = require('fs');
const file = 'components/TopBuyersRanking.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    'endDate, manualEntries }) => {',
    'endDate, manualEntries, rankingMinValue }) => {'
);

fs.writeFileSync(file, code);
