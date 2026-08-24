const fs = require('fs');

const filesToUpdate = [
    { file: 'components/RaffleDetails.tsx', old: 'String(item.ticketNumber).padStart(item.ticketNumber > 9999 ? 6 : 4, \'0\')', new: 'String(item.ticketNumber).padStart(String(raffle.totalNumbers - 1).length, \'0\')' },
    { file: 'components/RaffleDetails.tsx', old: 'String(raffle.winnerNumber).padStart(6, \'0\')', new: 'String(raffle.winnerNumber).padStart(String(raffle.totalNumbers - 1).length, \'0\')' },
    { file: 'components/SuccessView.tsx', old: 'String(num).padStart(6, \'0\')', new: 'String(num).padStart(String(raffle.totalNumbers - 1).length, \'0\')' },
    { file: 'components/WinnersPage.tsx', old: 'String(winner.ticketNumber).padStart(6, \'0\')', new: 'String(winner.ticketNumber)' },
];

for (let item of filesToUpdate) {
    let content = fs.readFileSync(item.file, 'utf8');
    if (content.includes(item.old)) {
      content = content.replace(item.old, item.new);
      fs.writeFileSync(item.file, content);
      console.log(`Updated ${item.file}`);
    } else {
      console.log(`Pattern not found in ${item.file}`);
    }
}
