/**
 * Fournisseur sans API : la commande part par e-mail, en texte structure.
 *
 * Ce cas n’est pas un repli dégradé, c’est le mode de fonctionnement réel de
 * beaucoup de grossistes européens de taille moyenne — ceux qui ont justement
 * les meilleurs délais et acceptent de ne pas mettre leur marque sur le colis.
 *
 * Limite assumée : aucun numéro de suivi en retour immédiat. Il arrive
 * ensuite par le webhook `/api/webhooks/supplier`, que le fournisseur appelle
 * ou que vous alimentez depuis un e-mail transféré.
 */

import type { Supplier, SupplierOrderRequest, SupplierOrderResult } from './types';
import { sendRawEmail } from '../email/send';

export interface EmailSupplierConfig {
  id: string;
  label: string;
  /** Adresse du service commandes du fournisseur. */
  to: string;
  /** Copie vers votre propre boite, pour la traçabilité. */
  bcc?: string;
}

export function createEmailSupplier(config: EmailSupplierConfig): Supplier {
  return {
    id: config.id,
    label: config.label,

    async placeOrder(order: SupplierOrderRequest): Promise<SupplierOrderResult> {
      const linesText = order.lines
        .map((l) => `  ${l.quantity} x ${l.supplierSku}  (${l.name})`)
        .join('\n');

      const body = [
        `BON DE COMMANDE ${order.orderRef}`,
        '',
        'Articles',
        linesText,
        '',
        'Expédier a',
        `  ${order.address.name}`,
        `  ${order.address.line1}`,
        ...(order.address.line2 ? [`  ${order.address.line2}`] : []),
        `  ${order.address.postalCode} ${order.address.city}`,
        `  ${order.address.country}`,
        ...(order.address.phone ? [`  tel. ${order.address.phone}`] : []),
        '',
        `Mode d’expédition : ${order.shippingMethod}`,
        order.note ? `Note : ${order.note}` : '',
        '',
        `Merci de rappeler la référence ${order.orderRef} sur le bon de livraison,`,
        'et de nous transmettre le numéro de suivi dès que le colis part.',
      ]
        .filter((l) => l !== '')
        .join('\n');

      const result = await sendRawEmail({
        to: config.to,
        bcc: config.bcc,
        subject: `Commande ${order.orderRef}`,
        text: body,
      });

      if (!result.ok) {
        return { ok: false, error: `envoi du bon de commande échoué : ${result.error}`, retryable: true };
      }

      // Pas d’identifiant fournisseur à ce stade : on réutilise notre
      // référence, que le webhook de suivi rapprochera.
      return { ok: true, supplierOrderId: order.orderRef, trackingNumber: null, carrier: null };
    },
  };
}
