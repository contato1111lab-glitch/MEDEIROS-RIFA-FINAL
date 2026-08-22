const fs = require('fs');
const file = 'components/AdminPanel.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    'showRanking: formData.showRanking ?? true,',
    'showRanking: formData.showRanking ?? true,\n            rankingMinValue: formData.rankingMinValue || null,'
);

code = code.replace(
    'showRanking: formData.showRanking ?? true,',
    'showRanking: formData.showRanking ?? true,\n                  rankingMinValue: formData.rankingMinValue || null,'
);

fs.writeFileSync(file, code);
