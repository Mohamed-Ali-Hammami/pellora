/**
 * POST /api/orders/declare
 *
 * Le client déclare avoir effectué son virement.
 *
 * CE QUE CETTE ROUTE NE FAIT PAS, et ne doit jamais faire : confirmer un
 * paiement. Une déclaration n'est pas un relevé bancaire. Si elle faisait
 * passer la commande en `confirmed`, il suffirait de cliquer sur un bouton
 * pour déclencher l'expédition d'un poêle sans avoir rien payé.
 *
 * Ce qu'elle fait : horodater la déclaration et prévenir l'équipe. C'est ce
 * qui raccourcit le délai entre le virement réel et sa constatation — sans
 * elle, personne ne sait quand regarder le compte.
 *
 * Autorisation : référence ET adresse e-mail, comme le suivi. La référence
 * seule est courte et circule dans des e-mails transférés.
 */

import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getStore } from '@/lib/store';
import { withTransferDeclared } from '@/lib/store/orders';
import { alertOps } from '@/lib/email/send';
import { price } from '@/lib/format';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { defaultLocale, isLocale } from '@/lib/i18n/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  ref: z.string().trim().min(3).max(32),
  email: z.string().trim().email().max(180),
  locale: z.string().optional(),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const dict = getDictionary(defaultLocale);
    return NextResponse.json({ error: dict.api.unreadableBody }, { status: 400 });
  }

  const demandée = (payload as { locale?: unknown })?.locale;
  const dict = getDictionary(
    typeof demandée === 'string' && isLocale(demandée) ? demandée : defaultLocale,
  );

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: dict.api.lookupMissingFields }, { status: 400 });
    }
    throw error;
  }

  const store = getStore();
  const order = await store.get(input.ref.toUpperCase());

  // Réponse identique si la commande n'existe pas ou si l'e-mail ne
  // correspond pas : distinguer les deux cas permettrait d'énumérer les
  // références valides.
  if (!order || order.email.toLowerCase() !== input.email.toLowerCase()) {
    return NextResponse.json({ error: dict.api.lookupNotFound }, { status: 404 });
  }

  // Déclarer n'a de sens qu'en attente de virement. Sur une commande déjà
  // confirmée ou expédiée, c'est sans objet — et on le dit plutôt que de
  // laisser croire que quelque chose s'est passé.
  if (order.status !== 'awaiting_transfer') {
    return NextResponse.json({ error: dict.api.declareNotPending }, { status: 409 });
  }

  const déjà = order.transferDeclaredAt !== null;
  const updated = withTransferDeclared(order);

  if (!déjà) {
    await store.save(updated);
    await alertOps(
      `Commande ${order.ref} : le client déclare avoir viré ${price(order.total, 'fr')}`,
      [
        `${order.address?.name ?? order.email} indique avoir effectué le virement.`,
        '',
        `Référence  ${order.ref}`,
        `Montant    ${price(order.total, 'fr')}`,
        ...(order.transferHolder ? [`Émis par   ${order.transferHolder}`] : []),
        '',
        'CE N’EST PAS UNE PREUVE DE PAIEMENT. Vérifiez le relevé avant de',
        'confirmer : la confirmation déclenche l’expédition.',
      ].join('\n'),
    );
  }

  return NextResponse.json({ declaredAt: updated.transferDeclaredAt });
}
