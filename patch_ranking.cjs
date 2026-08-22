const fs = require('fs');
const file = 'services/raffleService.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    'const top = [...counts.entries()]',
    `const minTicketsRequired = (raffle?.ranking_min_value && raffle?.price_per_number)
      ? Math.ceil(raffle.ranking_min_value / raffle.price_per_number)
      : 0;

    const top = [...counts.entries()]
      .filter(([_, total]) => total >= minTicketsRequired)`
);

fs.writeFileSync(file, code);
