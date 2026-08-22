const fs = require('fs');
const file = 'components/RaffleDetails.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `            config={raffle.rankingConfig || []} 
            pricePerNumber={raffle.pricePerNumber} 
            startDate={raffle.rankingStartDate}
            endDate={raffle.rankingEndDate}
            manualEntries={raffle.manualRanking}`;

const replacement = `            config={raffle.rankingConfig || []} 
            pricePerNumber={raffle.pricePerNumber} 
            startDate={raffle.rankingStartDate}
            endDate={raffle.rankingEndDate}
            manualEntries={raffle.manualRanking}
            rankingMinValue={raffle.rankingMinValue}`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
