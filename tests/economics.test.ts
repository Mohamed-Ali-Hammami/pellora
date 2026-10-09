import { describe, it, expect } from 'vitest';
import {
  baselineInputs, computeUnitEconomics, monthlyPlanForOrders, ordersNeededFor,
  requiredAov, requiredConversionRate, customerLifetimeValue, sensitivity,
} from '@/lib/economics';

describe('modele economique', () => {
  it('derive le CAC du CPC et de la conversion', () => {
    // L’identite qui gouverne tout le modele : CAC = CPC / taux de conversion.
    const u = computeUnitEconomics({ ...baselineInputs, cpc: 0.7, conversionRate: 0.02 });
    expect(u.cac).toBeCloseTo(35, 5);
  });

  it('retire la TVA du chiffre d’affaires', () => {
    const u = computeUnitEconomics({ ...baselineInputs, aov: 120, vatRate: 0.2 });
    expect(u.netPerOrder).toBeCloseTo(100, 5);
  });

  it('declare l’objectif inatteignable quand la marge ne couvre pas le CAC', () => {
    // Cas realiste : un CPC qui double sans gain de conversion.
    const verdict = ordersNeededFor({ ...baselineInputs, cpc: 2 }, 5000);
    expect(verdict.reachable).toBe(false);
    if (!verdict.reachable) {
      expect(verdict.cac).toBeGreaterThan(verdict.breakEvenCac);
      expect(verdict.reason).toMatch(/perd/);
    }
  });

  it('ne propose jamais « plus de volume » pour sauver une marge negative', () => {
    const inputs = { ...baselineInputs, cpc: 2 };
    const small = monthlyPlanForOrders(inputs, 100);
    const large = monthlyPlanForOrders(inputs, 1000);
    // Le volume aggrave la perte : c’est le piege central du dropshipping.
    expect(large.profitMonthly).toBeLessThan(small.profitMonthly);
  });

  it('atteint l’objectif quand la marge est suffisante', () => {
    const verdict = ordersNeededFor({ ...baselineInputs, aov: 115, conversionRate: 0.028 }, 5000);
    expect(verdict.reachable).toBe(true);
    if (verdict.reachable) {
      expect(verdict.plan.profitMonthly).toBeGreaterThanOrEqual(5000);
      expect(verdict.plan.ordersPerMonth).toBeGreaterThan(0);
    }
  });

  it('resout le panier moyen requis', () => {
    const aov = requiredAov(baselineInputs, 5000, 400);
    const plan = monthlyPlanForOrders({ ...baselineInputs, aov }, 400);
    expect(plan.profitMonthly).toBeGreaterThanOrEqual(4990);
    // Et confirme que l’hypothese de depart ne suffit pas.
    expect(aov).toBeGreaterThan(baselineInputs.aov);
  });

  it('resout le taux de conversion requis', () => {
    const cr = requiredConversionRate(baselineInputs, 5000, 400);
    expect(cr).not.toBeNull();
    if (cr !== null) {
      const plan = monthlyPlanForOrders({ ...baselineInputs, conversionRate: cr }, 400);
      expect(plan.profitMonthly).toBeCloseTo(5000, 0);
    }
  });

  it('valorise le reachat, qui ne coute pas de CAC', () => {
    const once = customerLifetimeValue({ ...baselineInputs, ordersPerCustomerPerYear: 1 });
    const twice = customerLifetimeValue({ ...baselineInputs, ordersPerCustomerPerYear: 2 });
    expect(twice).toBeGreaterThan(once);
  });

  it('montre que le benefice croit avec la conversion et decroit avec le CPC', () => {
    const byCr = sensitivity(baselineInputs, 'conversionRate', [0.015, 0.02, 0.03], 400);
    expect(byCr[0]!.profit).toBeLessThan(byCr[2]!.profit);

    const byCpc = sensitivity(baselineInputs, 'cpc', [0.4, 0.7, 1.2], 400);
    expect(byCpc[0]!.profit).toBeGreaterThan(byCpc[2]!.profit);
  });

  it('tient compte des retours dans la marge', () => {
    const none = computeUnitEconomics({ ...baselineInputs, refundRate: 0 });
    const some = computeUnitEconomics({ ...baselineInputs, refundRate: 0.1 });
    expect(some.contributionBeforeAds).toBeLessThan(none.contributionBeforeAds);
  });

  it('refuse la division par zero sur une conversion nulle', () => {
    const u = computeUnitEconomics({ ...baselineInputs, conversionRate: 0 });
    expect(u.cac).toBe(Number.POSITIVE_INFINITY);
    expect(ordersNeededFor({ ...baselineInputs, conversionRate: 0 }, 5000).reachable).toBe(false);
  });
});
