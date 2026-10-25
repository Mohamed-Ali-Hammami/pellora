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
 *  - CONFIRMER UN VIREMENT ENGAGE LA VENTE. Le client reçoit sa confirmation
 *    de commande et attend son colis. On vérifie donc l'état de départ avant
 *    d'agir : seule une commande en attente de virement peut être confirmée.
 *  - Aucun automatisme n'appelle cette route. C'est une personne qui a vu la
 *    ligne sur le relevé bancaire, puis une personne qui a déposé le colis.
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
import { withEvent, hasSentEmail } from '@/lib/store/orders';
import { orderConfirmation, shippingNotification } from '@/lib/email/templates';
import { sendRawEmail } from '@/lib/email/send';
import type { Order } from '@/lib/store/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Retour au back-office, sur L'ORIGINE DE LA REQUÊTE.
 *
 * Et surtout pas sur `NEXT_PUBLIC_SITE_URL` : cette variable décrit l'adresse
 * publique du site, qui n'est pas forcément celle par laquelle on atteint le
 * back-office — un port local différent, un domaine de pré-production, un
 * accès par l'IP. Quand les deux divergent, chaque action renvoie vers une
 * adresse qui ne répond pas, et le back-office paraît cassé alors qu'il a
 * parfaitement travaillé.
 */
/**
 * La requête est-elle arrivée par une connexion chiffrée ?
 *
 * `x-forwarded-proto` d'abord : derrière un hébergeur, le serveur Node reçoit
 * du HTTP en clair même quand le visiteur est en HTTPS, et seul cet en-tête
 * dit la vérité.
 */
function estSécurisé(request: Request): boolean {
  const transmis = request.headers.get('x-forwarded-proto');
  if (transmis) return transmis.split(',')[0]?.trim() === 'https';
  return new URL(request.url).protocol === 'https:';
}

/**
 * Hôte réellement demandé par le navigateur.
 *
 * Pas `new URL(request.url).host` : Next normalise cette valeur en
 * « localhost », si bien qu'un navigateur venu de `127.0.0.1` se faisait
 * rediriger vers `localhost` — un autre hôte pour la politique des cookies,
 * donc un cookie de session jamais renvoyé, donc une page de connexion qui
 * revient sans expliquer pourquoi. Même piège derrière un hébergeur, où seul
 * `x-forwarded-host` porte le vrai domaine.
 */
function hôte(request: Request): string {
  const transmis = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  return transmis?.split(',')[0]?.trim() || new URL(request.url).host;
}

function retour(request: Request, message?: string) {
  const protocole = estSécurisé(request) ? 'https' : 'http';
  const url = new URL('/admin', `${protocole}://${hôte(request)}`);
  if (message) url.searchParams.set('m', message);
  return NextResponse.redirect(url, { status: 303 });
}

/**
 * Écrit au client, une seule fois par type de message.
 *
 * L'idempotence est portée par le journal de la commande : un double clic sur
 * « virement reçu » — ou une page rechargée — ne doit pas envoyer deux
 * confirmations. Renvoie `false` si le message n'a pas pu partir, pour que le
 * back-office puisse le dire au lieu de laisser croire que le client a été
 * prévenu.
 */
async function prévenir(order: Order, kind: 'confirmation' | 'shipping'): Promise<boolean> {
  if (hasSentEmail(order, kind)) return true;

  const message =
    kind === 'confirmation' ? orderConfirmation(order) : shippingNotification(order);
  const envoi = await sendRawEmail({
    to: order.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  await getStore().save(
    envoi.ok
      ? withEvent(order, `email:${kind}_sent`)
      : withEvent(order, `email:${kind}_failed`, envoi.error),
  );
  return envoi.ok;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const jar = await cookies();

  // ── Connexion ──
  if (action === 'signin') {
    if (!isAdminConfigured()) return retour(request, 'unconfigured');
    const token = signIn(String(form.get('password') ?? ''));
    if (!token) return retour(request, 'bad-password');

    const response = retour(request);
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      // `Secure` suit le PROTOCOLE DE LA REQUÊTE, pas `NODE_ENV`.
      //
      // Un cookie `Secure` n'est tout simplement pas conservé par le
      // navigateur en HTTP : avec `NODE_ENV === 'production'`, un
      // `next start` local laissait la connexion échouer en silence — bon
      // mot de passe, cookie posé, puis page de connexion à nouveau, sans
      // le moindre message. Le drapeau reste évidemment actif dès que la
      // connexion est chiffrée, ce qui est le cas en production.
      secure: estSécurisé(request),
      path: '/admin',
      maxAge: ADMIN_SESSION_SECONDS,
    });
    return response;
  }

  if (action === 'signout') {
    const response = retour(request);
    response.cookies.delete({ name: ADMIN_COOKIE, path: '/admin' });
    return response;
  }

  // ── Tout le reste exige une session ──
  if (!isSignedIn(jar.get(ADMIN_COOKIE)?.value)) {
    return retour(request, 'denied');
  }

  const ref = String(form.get('ref') ?? '').trim();
  if (!ref) return retour(request, 'no-ref');

  const store = getStore();
  const order = await store.get(ref);
  if (!order) return retour(request, 'not-found');

  switch (action) {
    /**
     * Virement constaté. La commande avance et le client est prévenu.
     *
     * L'envoi de l'e-mail vient APRÈS l'enregistrement de l'état, et son
     * échec ne le défait pas : l'argent est arrivé, c'est un fait, et une
     * commande qui redeviendrait « en attente » parce qu'un serveur SMTP a
     * eu un hoquet serait une erreur bien plus grave qu'un e-mail manquant.
     * Le message d'échec dit quoi faire : écrire au client à la main.
     */
    case 'confirm': {
      if (order.status !== 'awaiting_transfer') return retour(request, 'wrong-state');

      const confirmée = withStatus(order, 'confirmed', `virement constaté par l’équipe (${ref})`);
      await store.save(confirmée);

      const envoyé = await prévenir(confirmée, 'confirmation');
      return retour(request, envoyé ? 'confirmed' : 'confirmed-no-email');
    }

    /** Expédition constatée. Le numéro de suivi est optionnel. */
    case 'ship': {
      if (order.status === 'delivered' || order.status === 'cancelled') {
        return retour(request, 'wrong-state');
      }
      const suivi = String(form.get('tracking') ?? '').trim();
      const transporteur = String(form.get('carrier') ?? '').trim();
      const expédiée: Order = {
        ...withStatus(order, 'shipped', 'expédition saisie par l’équipe'),
        trackingNumber: suivi || order.trackingNumber,
        carrier: transporteur || order.carrier,
      };
      await store.save(expédiée);

      const envoyé = await prévenir(expédiée, 'shipping');
      return retour(request, envoyé ? 'shipped' : 'shipped-no-email');
    }

    case 'deliver': {
      if (order.status !== 'shipped') return retour(request, 'wrong-state');
      await store.save(withStatus(order, 'delivered', 'réception confirmée par l’équipe'));
      return retour(request, 'delivered');
    }

    case 'cancel': {
      if (!CANCELLABLE.includes(order.status)) return retour(request, 'wrong-state');
      await store.save(
        withStatus(order, 'cancelled', String(form.get('reason') ?? 'annulée par l’équipe')),
      );
      return retour(request, 'cancelled');
    }

    default:
      return retour(request, 'unknown-action');
  }
}
