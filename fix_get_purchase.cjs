const fs = require('fs');
const file = 'api/_lib/raffleService.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  ".select('*, raffles(id, name, image_url, status)')",
  ".select('*, raffles(id, name, image_url, status, total_numbers)')"
);

fs.writeFileSync(file, content);
