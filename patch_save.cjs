const fs = require('fs');
const file = 'services/raffleService.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /show_ranking: data\.showRanking \?\? true,/g,
    'show_ranking: data.showRanking ?? true,\n          ranking_min_value: data.rankingMinValue || null,'
);

code = code.replace(
    /show_ranking: updates\.showRanking,/g,
    'show_ranking: updates.showRanking,\n          ranking_min_value: updates.rankingMinValue,'
);

fs.writeFileSync(file, code);
