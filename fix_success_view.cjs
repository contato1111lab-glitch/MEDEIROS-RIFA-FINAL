const fs = require('fs');
const file = 'components/SuccessView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "String(num).padStart(String(raffle.totalNumbers - 1).length, '0')",
  "String(num).padStart(5, '0')"
);

fs.writeFileSync(file, content);
