import { RafflePromotion } from '../types';

export interface EvaluatePromotionParams {
  pricePerNumber: number;
  minPurchase?: number | null;
  qty: number;
  selectedPromotionId?: string | null;
  promotions?: RafflePromotion[] | any[];
  now?: Date;
}

export interface EvaluatePromotionResult {
  isError: boolean;
  errorMessage: string | null;
  finalTotalValue: number;
  finalBaseQuantity: number | null;
  finalAwardedQuantity: number;
  appliedPromotion: RafflePromotion | any | null;
}

export function evaluatePromotion(params: EvaluatePromotionParams): EvaluatePromotionResult {
  const {
    pricePerNumber,
    minPurchase = 1,
    qty,
    selectedPromotionId = null,
    promotions = [],
    now = new Date()
  } = params;

  // Filter active promotions by current time window
  const validPromos = (promotions || []).filter((p: any) => {
    if (p.isActive === false || p.is_active === false) return false;
    const startsAt = p.startsAt || p.starts_at;
    const endsAt = p.endsAt || p.ends_at;
    if (startsAt && new Date(startsAt) > now) return false;
    if (endsAt && new Date(endsAt) < now) return false;
    return true;
  });

  // 1. If explicit BUNDLE promotion ID is passed
  if (selectedPromotionId) {
    const promo = validPromos.find((p: any) => p.id === selectedPromotionId && p.type === 'BUNDLE');
    if (!promo) {
      return {
        isError: true,
        errorMessage: 'Esta promoção não está disponível ou expirou.',
        finalTotalValue: 0,
        finalBaseQuantity: null,
        finalAwardedQuantity: 0,
        appliedPromotion: null
      };
    }

    const bundlePrice = Number(promo.bundlePrice ?? promo.bundle_price);
    const bundleQuantity = Number(promo.bundleQuantity ?? promo.bundle_quantity);

    if (bundlePrice <= 0 || bundleQuantity <= 0) {
      return {
        isError: true,
        errorMessage: 'Configuração de promoção inválida.',
        finalTotalValue: 0,
        finalBaseQuantity: null,
        finalAwardedQuantity: 0,
        appliedPromotion: null
      };
    }

    return {
      isError: false,
      errorMessage: null,
      finalTotalValue: bundlePrice,
      finalBaseQuantity: null,
      finalAwardedQuantity: bundleQuantity,
      appliedPromotion: promo
    };
  }

  // 2. Normal purchase calculation
  if (minPurchase && qty < minPurchase) {
    return {
      isError: true,
      errorMessage: `A compra mínima é de ${minPurchase} cotas.`,
      finalTotalValue: 0,
      finalBaseQuantity: qty,
      finalAwardedQuantity: 0,
      appliedPromotion: null
    };
  }

  const baseTotalValue = qty * pricePerNumber;
  const doublePromo = validPromos.find((p: any) => p.type === 'DOUBLE');

  if (doublePromo) {
    const triggerAmount = Number(doublePromo.triggerAmount ?? doublePromo.trigger_amount ?? 0);
    const multiplier = Number(doublePromo.multiplier ?? 2);

    if (triggerAmount > 0 && baseTotalValue >= triggerAmount && multiplier >= 2) {
      return {
        isError: false,
        errorMessage: null,
        finalTotalValue: baseTotalValue, // Customer pays normal base value
        finalBaseQuantity: qty,
        finalAwardedQuantity: qty * multiplier, // Receives double/multiplied physical tickets
        appliedPromotion: doublePromo
      };
    }
  }

  // Standard non-promo purchase
  return {
    isError: false,
    errorMessage: null,
    finalTotalValue: baseTotalValue,
    finalBaseQuantity: qty,
    finalAwardedQuantity: qty,
    appliedPromotion: null
  };
}
