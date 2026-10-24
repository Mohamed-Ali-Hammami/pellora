/**
 * Vue publique d’une commande — module SANS dépendance serveur.
 *
 * Ce type est consomme par la page de suivi, qui est un composant client. Le
 * définir ici plutôt que dans `store/orders.ts` évite qu’un composant client
 * ait à importer quoi que ce soit depuis `lib/store` : un import de type est
 * certes effacé à la compilation, mais la frontière reste nette et le jour où
 * quelqu’un ajoute un import de valeur, rien ne casse silencieusement.
 */

import type { Cents } from './money';

export interface PublicOrderLine {
  name: string;
  quantity: number;
}

/** Champs volontairement absents : e-mail, adresse détaillée, titulaire du virement. */
export interface PublicOrder {
  ref: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lines: PublicOrderLine[];
  total: Cents;
  currency: string;
  shippingLabel: string;
  trackingNumber: string | null;
  carrier: string | null;
  city: string | null;
  country: string | null;
}
