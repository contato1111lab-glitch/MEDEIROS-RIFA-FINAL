const fs = require('fs');
const file = 'services/raffleService.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /showRanking: data\.show_ranking \?\? true,/g,
    'showRanking: data.show_ranking ?? true,\n      rankingMinValue: data.ranking_min_value,'
);

code = code.replace(
    /showRanking: r\.show_ranking \?\? true,/g,
    'showRanking: r.show_ranking ?? true,\n        rankingMinValue: r.ranking_min_value,'
);

fs.writeFileSync(file, code);
