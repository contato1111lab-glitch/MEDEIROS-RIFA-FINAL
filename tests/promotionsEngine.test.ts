import { evaluatePromotion } from '../services/promotionEngine';
import { RafflePromotion } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

console.log('Running Promotions Engine Unit Tests...');

const refTime = new Date('2026-09-27T12:00:00Z');

// Scenario 1: Normal purchase without active promotions
{
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 40,
    promotions: [],
    now: refTime
  });
  assert(!result.isError, 'S1: Should not error');
  assert(result.finalTotalValue === 20, 'S1: Total value should be 20');
  assert(result.finalBaseQuantity === 40, 'S1: Base quantity 40');
  assert(result.finalAwardedQuantity === 40, 'S1: Awarded quantity 40');
  assert(result.appliedPromotion === null, 'S1: No applied promotion');
  console.log('✓ Scenario 1 passed');
}

// Scenario 2: Inactive DOUBLE promotion
{
  const doublePromo: RafflePromotion = {
    id: 'p1',
    raffleId: 'r1',
    type: 'DOUBLE',
    triggerAmount: 20,
    multiplier: 2,
    isActive: false
  };
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 40,
    promotions: [doublePromo],
    now: refTime
  });
  assert(!result.isError, 'S2: Should not error');
  assert(result.finalTotalValue === 20, 'S2: Total value 20');
  assert(result.finalAwardedQuantity === 40, 'S2: Awarded quantity 40 (normal)');
  assert(result.appliedPromotion === null, 'S2: Promo should not apply when inactive');
  console.log('✓ Scenario 2 passed');
}

// Scenario 3: Active DOUBLE promo, purchase below triggerAmount
{
  const doublePromo: RafflePromotion = {
    id: 'p1',
    raffleId: 'r1',
    type: 'DOUBLE',
    triggerAmount: 20,
    multiplier: 2,
    isActive: true
  };
  // 20 qty * 0.5 = R$10 (below R$20 trigger)
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 20,
    promotions: [doublePromo],
    now: refTime
  });
  assert(!result.isError, 'S3: Should not error');
  assert(result.finalTotalValue === 10, 'S3: Total value 10');
  assert(result.finalAwardedQuantity === 20, 'S3: Awarded quantity 20 (no double)');
  assert(result.appliedPromotion === null, 'S3: Promo not applied below trigger');
  console.log('✓ Scenario 3 passed');
}

// Scenario 4: Active DOUBLE promo, purchase >= triggerAmount
{
  const doublePromo: RafflePromotion = {
    id: 'p1',
    raffleId: 'r1',
    type: 'DOUBLE',
    triggerAmount: 20,
    multiplier: 2,
    isActive: true
  };
  // 40 qty * 0.5 = R$20 (meets R$20 trigger) -> 80 awarded
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 40,
    promotions: [doublePromo],
    now: refTime
  });
  assert(!result.isError, 'S4: Should not error');
  assert(result.finalTotalValue === 20, 'S4: Customer pays R$20');
  assert(result.finalBaseQuantity === 40, 'S4: Base quantity 40');
  assert(result.finalAwardedQuantity === 80, 'S4: Awarded 80 tickets');
  assert(result.appliedPromotion?.id === 'p1', 'S4: DOUBLE promo applied');
  console.log('✓ Scenario 4 passed');
}

// Scenario 5: DOUBLE promo with expired time window
{
  const doublePromo: RafflePromotion = {
    id: 'p1',
    raffleId: 'r1',
    type: 'DOUBLE',
    triggerAmount: 20,
    multiplier: 2,
    isActive: true,
    endsAt: '2026-09-27T10:00:00Z' // Past
  };
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 40,
    promotions: [doublePromo],
    now: refTime
  });
  assert(result.finalAwardedQuantity === 40, 'S5: Expired promo should not apply');
  console.log('✓ Scenario 5 passed');
}

// Scenario 6: DOUBLE promo with future time window
{
  const doublePromo: RafflePromotion = {
    id: 'p1',
    raffleId: 'r1',
    type: 'DOUBLE',
    triggerAmount: 20,
    multiplier: 2,
    isActive: true,
    startsAt: '2026-09-27T14:00:00Z' // Future
  };
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 40,
    promotions: [doublePromo],
    now: refTime
  });
  assert(result.finalAwardedQuantity === 40, 'S6: Future promo should not apply yet');
  console.log('✓ Scenario 6 passed');
}

// Scenario 7: BUNDLE promotion explicit selection
{
  const bundlePromo: RafflePromotion = {
    id: 'p_bundle_15',
    raffleId: 'r1',
    type: 'BUNDLE',
    title: 'Pacote Especial',
    bundlePrice: 15,
    bundleQuantity: 50,
    isActive: true
  };
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 0,
    selectedPromotionId: 'p_bundle_15',
    promotions: [bundlePromo],
    now: refTime
  });
  assert(!result.isError, 'S7: Should not error');
  assert(result.finalTotalValue === 15, 'S7: Customer pays R$15');
  assert(result.finalBaseQuantity === null, 'S7: Base quantity null for bundle');
  assert(result.finalAwardedQuantity === 50, 'S7: Receives 50 tickets');
  assert(result.appliedPromotion?.id === 'p_bundle_15', 'S7: BUNDLE promo applied');
  console.log('✓ Scenario 7 passed');
}

// Scenario 8: BUNDLE selected when DOUBLE also active (Non-cumulative)
{
  const doublePromo: RafflePromotion = {
    id: 'p_double',
    raffleId: 'r1',
    type: 'DOUBLE',
    triggerAmount: 10,
    multiplier: 2,
    isActive: true
  };
  const bundlePromo: RafflePromotion = {
    id: 'p_bundle',
    raffleId: 'r1',
    type: 'BUNDLE',
    bundlePrice: 15,
    bundleQuantity: 50,
    isActive: true
  };
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 0,
    selectedPromotionId: 'p_bundle',
    promotions: [doublePromo, bundlePromo],
    now: refTime
  });
  assert(result.finalTotalValue === 15, 'S8: Total value is bundle price R$15 (not doubled)');
  assert(result.finalAwardedQuantity === 50, 'S8: Awarded exactly 50 tickets (not 100)');
  assert(result.appliedPromotion?.id === 'p_bundle', 'S8: Applied only BUNDLE');
  console.log('✓ Scenario 8 passed');
}

// Scenario 9: Non-existent promotionId
{
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 20,
    selectedPromotionId: 'invalid_id',
    promotions: [],
    now: refTime
  });
  assert(result.isError, 'S9: Should error for invalid promo ID');
  assert(result.errorMessage?.includes('expirou') || result.errorMessage?.includes('disponível'), 'S9: Error msg');
  console.log('✓ Scenario 9 passed');
}

// Scenario 10: Below min purchase check
{
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 5,
    promotions: [],
    now: refTime
  });
  assert(result.isError, 'S10: Should error for qty below minPurchase');
  console.log('✓ Scenario 10 passed');
}

// Scenario 11: Freezed purchase values (Verification of return payload contract)
{
  const doublePromo: RafflePromotion = {
    id: 'p_double',
    raffleId: 'r1',
    type: 'DOUBLE',
    triggerAmount: 20,
    multiplier: 2,
    isActive: true
  };
  const result = evaluatePromotion({
    pricePerNumber: 0.5,
    minPurchase: 10,
    qty: 100, // R$50 -> 200 tickets
    promotions: [doublePromo],
    now: refTime
  });
  assert(result.finalTotalValue === 50, 'S11: R$50 total value');
  assert(result.finalBaseQuantity === 100, 'S11: Base 100');
  assert(result.finalAwardedQuantity === 200, 'S11: Awarded 200');
  assert(result.appliedPromotion?.id === 'p_double', 'S11: Applied promo ID saved');
  console.log('✓ Scenario 11 passed');
}

console.log('\nAll 11 Core Unit Test Scenarios Passed Successfully!');
