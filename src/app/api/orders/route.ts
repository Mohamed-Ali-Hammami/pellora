/**
 * POST /api/orders
 *
 * Enregistre une commande en attente de virement.
 *
 * Point de sécurité central, inchangé depuis la version carte : le corps de
 * la requête ne contient AUCUN PRIX. Les montants sont relus dans le
 * catalogue par `priceCart`. Si le client pouvait envoyer un total, il
 * suffirait de le modifier dans la console du navigateur.
 *
 * Rien n'est engagé ici : la commande naît en `awaiting_transfer`, elle n'est
 * transmise à aucun fournisseur, et seule une personne qui a vu le virement
 * sur le relevé la fera avancer.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { priceCart, CartError } from '@/lib/cart';
import { checkoutInputSchema, toShippingAddress } from '@/lib/checkout';
import { isShippableCountry } from '@/lib/shipping';
import { bankDetails, isBankConfigured } from '@/lib/bank';
import { getStore } from '@/lib/store';
import { createOrder, withEvent } from '@/lib/store/orders';
import { transferInstructions, newOrderForTeam } from '@/lib/email/templates';
import { sendRawEmail, alertOps } from '@/lib/email/send';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n/config';
import { interpolate } from '@/lib/format';

export const runtime = 'nodejs';
/** Jamais de mise en cache : chaque appel crée une commande. */
export const dynamic = 'force-dynamic';

/**
 * Langue du message d'erreur, lue avant toute validation.
 *
 * Une erreur de saisie doit se lire dans la langue du visiteur : c'est
 * l'étape où l'on perd la vente.
 */
function localeOf(payload: unknown): Locale {
  if (typeof payload !== 'object' || payload === null) return defaultLocale;
  const value = (payload as Record<string, unknown>)['locale'];
  return typeof value === 'string' && isLocale(value) ? value : defaultLocale;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const dict = getDictionary(defaultLocale);
    return NextResponse.json({ error: dict.api.unreadableBody }, { status: 400 });
  }

  const locale = localeOf(payload);
  const dict = getDictionary(locale);

  // Sans RIB, la page de confirmation n'aurait rien à afficher au client :
  // on refuse d'enregistrer une commande qu'il ne pourrait pas payer.
  if (!isBankConfigured()) {
    return NextResponse.json({ error: dict.api.notConfigured }, { status: 503 });
  }

  try {
    const input = checkoutInputSchema.parse(payload);

    if (!isShippableCountry(input.shippingCountry)) {
      return NextResponse.json(
        { error: interpolate(dict.api.unknownCountry, { country: input.shippingCountry }) },
        { status: 400 },
      );
    }

    // Seul calcul de prix autorisé.
    const cart = priceCart(input);

    const order = createOrder({
      cart,
      email: input.customer.email,
      address: toShippingAddress(input),
      transferHolder: input.transferHolder,
    });

    await getStore().save(order);

    // L'e-mail porte le RIB et la référence. Son échec ne doit pas annuler la
    // commande — elle est enregistrée, et le client a de toute façon le RIB
    // sous les yeux sur la page suivante — mais il doit être tracé et alerter
    // l'équipe, car un client sans référence paie sans qu'on sache rattacher
    // le virement.
    const bank = bankDetails();
    const message = transferInstructions(order, bank);
    const envoi = await sendRawEmail({
      to: order.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    await getStore().save(
      envoi.ok
        ? withEvent(order, 'email:instructions_sent')
        : withEvent(order, 'email:instructions_failed', envoi.error),
    );

    if (!envoi.ok) {
      await alertOps(
        `Commande ${order.ref} : instructions de virement non envoyées`,
        `Le client ${order.email} n'a pas reçu le RIB ni sa référence.\n` +
          `Contactez-le avant qu'il ne paie sans référence.\n\nErreur : ${envoi.error}`,
      );
    }

    // Notification d'équipe : une commande qui dort sans que personne ne
    // surveille le compte est une vente perdue.
    const pourEquipe = newOrderForTeam(order);
    await alertOps(pourEquipe.subject, pourEquipe.text);

    return NextResponse.json({ ref: order.ref });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: dict.api.invalidCart, details: error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }
    if (error instanceof CartError) {
      // Le code machine part au client, pas le message interne : celui-ci est
      // rédigé pour les journaux et n'est pas traduit.
      return NextResponse.json({ error: dict.api.invalidCart, code: error.code }, { status: 400 });
    }
    console.error('[commande] échec', error);
    return NextResponse.json({ error: dict.api.checkoutFailed }, { status: 500 });
  }
}
