/**
 * GET /api/orders/lookup?ref=...&email=...
 *
 * Suivi de commande en libre-service : c’est ce qui évite l’essentiel des
 * e-mails « où est mon colis ? », qui représentent le gros du support en
 * dropshipping.
 *
 * La référence seule ne suffit PAS à autoriser la consultation : elle est
 * courte et apparaît dans des e-mails transférés. On exige donc la référence
 * ET l’adresse e-mail, et on ne renvoie que des données déjà connues du
 * client (cf. `toPublicOrder`).
 */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { toPublicOrder } from '@/lib/store/orders';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { defaultLocale, isLocale } from '@/lib/i18n/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref')?.trim().toUpperCase() ?? '';
  const email = url.searchParams.get('email')?.trim().toLowerCase() ?? '';
  const requested = url.searchParams.get('locale') ?? '';
  const dict = getDictionary(isLocale(requested) ? requested : defaultLocale);

  if (ref === '' || email === '') {
    return NextResponse.json({ error: dict.api.lookupMissingFields }, { status: 400 });
  }

  const order = await getStore().get(ref);

  // Réponse volontairement identique si la commande n’existe pas ou si
  // l’e-mail ne correspond pas : distinguer les deux cas permettrait
  // d’énumérer les références valides.
  if (!order || order.email.toLowerCase() !== email) {
    return NextResponse.json({ error: dict.api.lookupNotFound }, { status: 404 });
  }

  return NextResponse.json({ order: toPublicOrder(order) });
}
