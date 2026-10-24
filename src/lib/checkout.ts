/**
 * Données saisies au moment de passer commande.
 *
 * Le paiement se fait par virement : il n'y a donc aucune page hébergée par
 * un prestataire pour collecter l'adresse. C'est ce formulaire qui le fait, et
 * c'est lui qui doit valider.
 *
 * Règle qui ne doit pas bouger : AUCUN PRIX n'est accepté ici. Le corps de la
 * requête ne porte que des identifiants de produits et des quantités, et les
 * montants sont recalculés par `priceCart`. Sinon il suffirait de modifier le
 * total dans la console du navigateur pour commander un poêle à un euro.
 */

import { z } from 'zod';
import { cartInputSchema } from './cart';

/** Longueur maximale d'un champ libre : au-delà, c'est un collage accidentel. */
const TEXTE = 120;

const champ = (max = TEXTE) => z.string().trim().min(1).max(max);

export const customerSchema = z.object({
  firstName: champ(60),
  lastName: champ(60),
  email: z.string().trim().email().max(180),
  /**
   * Obligatoire, et c'est délibéré : un poêle part sur palette, et le
   * transporteur appelle pour convenir d'un créneau de livraison. Sans
   * téléphone, la palette repart au dépôt et la livraison est refacturée.
   */
  phone: champ(32),
  line1: champ(),
  line2: z.string().trim().max(TEXTE).nullable().default(null),
  postalCode: champ(16),
  city: champ(80),
});

export const checkoutInputSchema = cartInputSchema.extend({
  customer: customerSchema,
  /**
   * Titulaire du compte émetteur, s'il diffère du client. Facultatif : le
   * demander comme obligatoire ferait abandonner ceux qui paient depuis leur
   * propre compte, c'est-à-dire la majorité.
   */
  transferHolder: z.string().trim().max(TEXTE).nullable().default(null),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;

/**
 * Adresse de livraison, au format attendu par les fournisseurs.
 *
 * Le pays vient de `shippingCountry`, celui qui a servi à calculer les frais
 * de port — et non d'un champ séparé du formulaire. Deux champs pays
 * finiraient par diverger, et on expédierait en Espagne une commande facturée
 * au tarif français.
 */
export function toShippingAddress(input: CheckoutInput) {
  const c = input.customer;
  return {
    name: `${c.firstName} ${c.lastName}`,
    line1: c.line1,
    line2: c.line2,
    postalCode: c.postalCode,
    city: c.city,
    country: input.shippingCountry,
    phone: c.phone,
  };
}
