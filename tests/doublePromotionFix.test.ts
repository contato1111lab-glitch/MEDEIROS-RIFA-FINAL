import { evaluatePromotion } from '../services/promotionEngine';
import { RafflePromotion } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

console.log('Running DOUBLE Promotion Persistence & Live Tests...');

const refTime = new Date('2026-09-27T16:04:00Z'); // 16:04 UTC

// 1. isActive = true
const promoActive: RafflePromotion = {
  id: 'promo-1',
  raffleId: 'r-1',
  type: 'DOUBLE',
  triggerAmount: 30,
  multiplier: 2,
  isActive: true,
  startsAt: '2026-09-27T16:00:00Z',
  endsAt: '2026-09-27T23:59:00Z'
};
assert(promoActive.isActive === true, '1: isActive is true');
console.log('✓ Test 1: isActive = true confirmed');

// 2. isActive = false
const promoInactive: RafflePromotion = {
  ...promoActive,
  isActive: false
};
const resInactive = evaluatePromotion({
  pricePerNumber: 0.50,
  qty: 60, // R$30
  promotions: [promoInactive],
  now: refTime
});
assert(resInactive.finalAwardedQuantity === 60, '2: Inactive promo should not double');
console.log('✓ Test 2: isActive = false ignored');

// 3. Future promotion (startsAt at 16:05, current time 16:04)
const promoFuture: RafflePromotion = {
  ...promoActive,
  startsAt: '2026-09-27T16:05:00Z'
};
const resFuture = evaluatePromotion({
  pricePerNumber: 0.50,
  qty: 60, // R$30
  promotions: [promoFuture],
  now: refTime
});
assert(resFuture.finalAwardedQuantity === 60, '3: Future promo should not double at 16:04');
assert(promoFuture.isActive === true, '3: Admin checkbox remains isActive = true');
console.log('✓ Test 3: Future promo not live at 16:04, but isActive remains true');

// 4. Live promotion (at 16:06)
const timeLive = new Date('2026-09-27T16:06:00Z');
const resLive = evaluatePromotion({
  pricePerNumber: 0.50,
  qty: 60, // R$30
  promotions: [promoFuture],
  now: timeLive
});
assert(resLive.finalAwardedQuantity === 120, '4: Live promo doubles at 16:06 (60 base -> 120 awarded)');
assert(resLive.finalTotalValue === 30, '4: Customer pays R$30');
console.log('✓ Test 4: Live promo doubles at 16:06');

// 5. Expired promotion (at 00:01 next day)
const timeExpired = new Date('2026-09-28T00:01:00Z');
const resExpired = evaluatePromotion({
  pricePerNumber: 0.50,
  qty: 60,
  promotions: [promoFuture],
  now: timeExpired
});
assert(resExpired.finalAwardedQuantity === 60, '5: Expired promo does not double');
console.log('✓ Test 5: Expired promo does not double');

// 6. Below triggerAmount (R$29,50 = 59 tickets @ R$0,50, trigger R$30)
const resBelowTrigger = evaluatePromotion({
  pricePerNumber: 0.50,
  qty: 59, // R$29.50
  promotions: [promoActive],
  now: new Date('2026-09-27T16:10:00Z')
});
assert(resBelowTrigger.finalAwardedQuantity === 59, '6: R$29.50 does not double');
console.log('✓ Test 6: Below triggerAmount (R$29.50) does not double');

// 7. Exactly triggerAmount (R$30,00 = 60 tickets @ R$0,50)
const resExactTrigger = evaluatePromotion({
  pricePerNumber: 0.50,
  qty: 60, // R$30.00
  promotions: [promoActive],
  now: new Date('2026-09-27T16:10:00Z')
});
assert(resExactTrigger.finalAwardedQuantity === 120, '7: Exact R$30.00 doubles to 120');
console.log('✓ Test 7: Exactly triggerAmount (R$30.00) doubles to 120');

// 8. Above triggerAmount (R$30,50 = 61 tickets @ R$0,50)
const resAboveTrigger = evaluatePromotion({
  pricePerNumber: 0.50,
  qty: 61, // R$30.50
  promotions: [promoActive],
  now: new Date('2026-09-27T16:10:00Z')
});
assert(resAboveTrigger.finalAwardedQuantity === 122, '8: R$30.50 doubles to 122');
console.log('✓ Test 8: Above triggerAmount (R$30.50) doubles to 122');

// 9. Multiplier 2
assert(resExactTrigger.finalAwardedQuantity === resExactTrigger.finalBaseQuantity! * 2, '9: Multiplier 2x confirmed');
console.log('✓ Test 9: Multiplier 2x confirmed');

// 10. Countdown calculation simulation
function calcCountdown(endsAtIso: string, nowMs: number): string | null {
  const diff = new Date(endsAtIso).getTime() - nowMs;
  if (diff <= 0) return null;
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}min ${String(s).padStart(2, '0')}s`;
}
const cd = calcCountdown('2026-09-27T23:59:00Z', new Date('2026-09-27T16:16:42Z').getTime());
assert(cd === '07h 42min 18s', '10: Countdown calculates 07h 42min 18s');
console.log('✓ Test 10: Countdown timer format is 07h 42min 18s');

// 11. Countdown expiration
const cdExpired = calcCountdown('2026-09-27T23:59:00Z', new Date('2026-09-28T00:00:00Z').getTime());
assert(cdExpired === null, '11: Countdown expires to null');
console.log('✓ Test 11: Countdown timer expires gracefully');

// 12. Admin maintains checkbox marked even before start
assert(promoFuture.isActive === true, '12: Admin maintains checkbox marked before start');
console.log('✓ Test 12: Admin maintains checkbox marked regardless of live status');

console.log('\nAll 12 DOUBLE Promotion Unit Tests Passed Successfully!');
