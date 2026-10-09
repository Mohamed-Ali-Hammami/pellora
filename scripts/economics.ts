/**
 * Simulateur en ligne de commande : `npm run economics`
 *
 * Répond à la question « que faut-il pour dégager X € de bénéfice par mois ? »
 * et montre lesquels des paramètres comptent vraiment.
 *
 * Options :
 *   --target=5000      objectif de bénéfice mensuel (défaut : 5000)
 *   --aov=92           panier moyen TTC
 *   --cpc=0.70         coût par clic
 *   --cr=0.02          taux de conversion
 *   --cogs=29          coût d’achat moyen par commande
 */

import {
  baselineInputs,
  computeUnitEconomics,
  ordersNeededFor,
  requiredAov,
  requiredConversionRate,
  customerLifetimeValue,
  sensitivity,
  type EconomicsInputs,
} from '../src/lib/economics';

function arg(name: string): number | undefined {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return undefined;
  const value = Number(raw.split('=')[1]);
  return Number.isFinite(value) ? value : undefined;
}

const target = arg('target') ?? 5000;
const inputs: EconomicsInputs = {
  ...baselineInputs,
  aov: arg('aov') ?? baselineInputs.aov,
  cpc: arg('cpc') ?? baselineInputs.cpc,
  conversionRate: arg('cr') ?? baselineInputs.conversionRate,
  cogsPerOrder: arg('cogs') ?? baselineInputs.cogsPerOrder,
};

const eur = (n: number) => `${n.toFixed(2)} €`;
const pct = (n: number) => `${n.toFixed(2)} %`;
const line = (label: string, value: string) => console.log(`  ${label.padEnd(38)} ${value.padStart(14)}`);
const rule = (title?: string) =>
  console.log(title ? `\n${title}\n${'-'.repeat(54)}` : '-'.repeat(54));

const u = computeUnitEconomics(inputs);

console.log(`\n${'='.repeat(54)}`);
console.log('  MODELE ECONOMIQUE — objectif ' + eur(target) + ' / mois');
console.log('='.repeat(54));

rule('HYPOTHÈSES (à remplacer par vos mesures)');
line('Panier moyen TTC', eur(inputs.aov));
line('Coût d’achat par commande', eur(inputs.cogsPerOrder));
line('Port paye au fournisseur', eur(inputs.supplierShippingPerOrder));
line('Coût par clic', eur(inputs.cpc));
line('Taux de conversion', pct(inputs.conversionRate * 100));
line('Taux de retour', pct(inputs.refundRate * 100));
line('Charges fixes mensuelles', eur(inputs.fixedCostsMonthly));

rule('MARGE PAR COMMANDE');
line('CA TTC encaisse', eur(u.grossPerOrder));
line('— TVA reversée', `-${eur(u.grossPerOrder - u.netPerOrder)}`);
line('CA hors taxe', eur(u.netPerOrder));
line('— Coût d’achat', `-${eur(u.cogs)}`);
line('— Port fournisseur', `-${eur(u.supplierShipping)}`);
line('— Frais de paiement', `-${eur(u.paymentFees)}`);
line('— Provision retours', `-${eur(u.refundCost)}`);
line('= Marge avant publicité', eur(u.contributionBeforeAds));
line('Marge brute', pct(u.grossMarginPct));

rule('ACQUISITION — CAC = CPC / conversion');
line('CAC implique', eur(u.cac));
line('CAC maximal avant perte', eur(u.breakEvenCac));
line('= Marge après publicité', eur(u.contributionAfterAds));
line('Valeur client 12 mois', eur(customerLifetimeValue(inputs)));

rule(`ATTEINDRE ${eur(target)} DE BENEFICE MENSUEL`);
const verdict = ordersNeededFor(inputs, target);

if (!verdict.reachable) {
  console.log('\n  >>> INATTEIGNABLE AVEC CES HYPOTHÈSES <<<\n');
  console.log(`  ${verdict.reason}\n`);
  const neededCr = requiredConversionRate(inputs, target, 400);
  console.log('  Pistes de correction :');
  console.log(`    - panier moyen minimal à 400 commandes/mois : ${eur(requiredAov(inputs, target, 400))}`);
  if (neededCr !== null) {
    console.log(`    - conversion requise à 400 commandes/mois  : ${pct(neededCr * 100)}`);
  }
  console.log(`    - CPC maximal à conversion constante       : ${eur(u.breakEvenCac * inputs.conversionRate)}`);
} else {
  const p = verdict.plan;
  line('Commandes / mois', p.ordersPerMonth.toFixed(0));
  line('Commandes / jour', p.ordersPerDay.toFixed(1));
  line('Visites / mois nécessaires', Math.round(p.sessionsPerMonth).toLocaleString('fr-FR'));
  line('Budget publicitaire / mois', eur(p.adSpendMonthly));
  line('CA TTC / mois', eur(p.revenueMonthlyGross));
  line('Bénéfice / mois', eur(p.profitMonthly));
  line('Marge nette', pct(p.netMarginPct));

  rule('TRESORERIE A PREVOIR');
  const cashCycle = 1.5;
  line('Pub + achats avant encaissement', eur((p.adSpendMonthly + inputs.cogsPerOrder * p.ordersPerMonth) / 30.4 * 14 * cashCycle));
  console.log('  (environ 14 jours de dépenses, coefficient de sécurité 1,5)');
}

rule('SENSIBILITE — bénéfice mensuel à 400 commandes');
const show = (label: string, rows: { value: number; profit: number }[], fmt: (n: number) => string) => {
  console.log(`\n  ${label}`);
  for (const r of rows) {
    const flag = r.profit >= target ? ' <= objectif atteint' : '';
    console.log(`    ${fmt(r.value).padStart(9)}  ->  ${eur(r.profit).padStart(12)}${flag}`);
  }
};
show('Taux de conversion', sensitivity(inputs, 'conversionRate', [0.012, 0.016, 0.02, 0.025, 0.03, 0.04], 400), (n) => pct(n * 100));
show('Coût par clic', sensitivity(inputs, 'cpc', [0.4, 0.55, 0.7, 0.9, 1.2], 400), eur);
show('Panier moyen', sensitivity(inputs, 'aov', [70, 80, 92, 110, 130], 400), eur);
show('Coût d’achat', sensitivity(inputs, 'cogsPerOrder', [22, 26, 29, 34, 40], 400), eur);

rule();
console.log(
  '\n  Les deux lignes qui décident de tout sont la conversion et le CPC.\n' +
    '  Elles ne se décrètent pas : elles se mesurent avec de la dépense réelle.\n' +
    '  Tant qu’elles ne sont pas mesurées, ce tableau est une maquette, pas une prévision.\n',
);
