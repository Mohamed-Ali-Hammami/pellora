/**
 * POST /admin/actions — toutes les actions du back-office.
 *
 * Un seul point d'entrée, piloté par un champ `action` de formulaire, et des
 * `<form>` natifs plutôt que du JavaScript : la page doit rester utilisable
 * depuis un téléphone sur un réseau médiocre, et une commande qu'on ne peut
 * pas confirmer est une commande qui dort.
 *
 * Ce que ce fichier protège :
 *
 *  - CONFIRMER UN VIREMENT EST IRRÉVERSIBLE DANS SES EFFETS. La confirmation
 *    déclenche la transmission au fournisseur, donc une expédition réelle. On
 *    vérifie donc l'état de départ avant d'agir : seule une commande en
 *    attente de virement peut être confirmée.
 *  - Aucun automatisme n'appelle cette route. C'est une personne qui a vu la
 *    ligne sur le relevé bancaire.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  isAdminConfigured,
  isSignedIn,
  signIn,
} from '@/lib/admin';
import { getStore } from '@/lib/store';
import { withStatus } from '@/lib/store/orders';
import { CANCELLABLE } from '@/lib/store/types';
import { fulfillOrder } from '@/lib/fulfillment';
import { alertOps } from '@/lib/email/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function retour(message?: string) {
  const url = new URL('/admin', process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000');
  if (message) url.searchParams.set('m', message);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const jar = await cookies();

  // ── Connexion ──
  if (action === 'signin') {
    if (!isAdminConfigured()) return retour('unconfigured');
    const token = signIn(String(form.get('password') ?? ''));
    if (!token) return retour('bad-password');

    const response = retour();
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/admin',
      maxAge: ADMIN_SESSION_SECONDS,
    });
    return response;
  }

  if (action === 'signout') {
    const response = retour();
    response.cookies.delete({ name: ADMIN_COOKIE, path: '/admin' });
    return response;
  }

  // ── Tout le reste exige une session ──
  if (!isSignedIn(jar.get(ADMIN_COOKIE)?.value)) {
    return retour('denied');
  }

  const ref = String(form.get('ref') ?? '').trim();
  if (!ref) return retour('no-ref');

  const store = getStore();
  const order = await store.get(ref);
  if (!order) return retour('not-found');

  switch (action) {
    /**
     * Virement constaté. Fait avancer la commande ET déclenche la
     * transmission au fournisseur — donc une expédition réelle.
     */
    case 'confirm': {
      if (order.status !== 'awaiting_transfer') return retour('wrong-state');

      await store.save(
        withStatus(order, 'confirmed', `virement constaté par l’équipe (${ref})`),
      );

      try {
        await fulfillOrder(ref);
      } catch (error) {
        // La commande reste confirmée : l'argent est bien là. Seule la
        // transmission a échoué, et le rattrapage planifié la reprendra.
        await alertOps(
          `Commande ${ref} confirmée mais non transmise`,
          `Le virement est constaté, la transmission au fournisseur a échoué.\n` +
            `Le rattrapage réessaiera.\n\n${error instanceof Error ? error.message : String(error)}`,
        );
        return retour('confirmed-not-forwarded');
      }
      return retour('confirmed');
    }

    /** Expédition constatée sans numéro de suivi du fournisseur. */
    case 'ship': {
      if (order.status === 'delivered' || order.status === 'cancelled') {
        return retour('wrong-state');
      }
      await store.save(withStatus(order, 'shipped', 'expédition saisie par l’équipe'));
      return retour('shipped');
    }

    case 'deliver': {
      if (order.status !== 'shipped') return retour('wrong-state');
      await store.save(withStatus(order, 'delivered', 'réception confirmée par l’équipe'));
      return retour('delivered');
    }

    case 'cancel': {
      if (!CANCELLABLE.includes(order.status)) return retour('wrong-state');
      await store.save(
        withStatus(order, 'cancelled', String(form.get('reason') ?? 'annulée par l’équipe')),
      );
      return retour('cancelled');
    }

    default:
      return retour('unknown-action');
  }
}
