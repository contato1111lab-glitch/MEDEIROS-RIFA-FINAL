const fs = require('fs');
const file = 'components/AdminPanel.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    'showRanking: formData.showRanking ?? true,\n                  termsAndRules: formData.termsAndRules || null,',
    'showRanking: formData.showRanking ?? true,\n                  rankingMinValue: formData.rankingMinValue || null,\n                  termsAndRules: formData.termsAndRules || null,'
);

fs.writeFileSync(file, code);
