import type { Cents } from '../money';
import type { Locale } from '../i18n/config';
/**
 * Adresse de livraison.
 *
 * Définie ici, avec la commande, et non dans un module tiers : c'est la
 * commande qui la porte, et plus rien d'autre dans le site n'en a besoin.
 */
export interface ShippingAddress {
  name: string;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
}

/**
 * Cycle de vie d’une commande, en paiement par virement.
 *
 *   awaiting_transfer ──virement constaté──> confirmed ──> shipped ──> delivered
 *        │                                       │
 *        └──────────────> cancelled <────────────┘
 *
 * QUATRE ÉTATS, ET CHACUN CORRESPOND À UN GESTE HUMAIN. `awaiting_transfer`
 * est l'état d'entrée : la commande existe, le client a le RIB et sa
 * référence, mais rien n'est engagé tant que l'argent n'est pas arrivé.
 * Chaque transition suivante est saisie par une personne — celle qui a vu la
 * ligne sur le relevé, celle qui a déposé le colis, celle qui a eu le client
 * au téléphone. Aucun automatisme ne fait avancer une commande : c'est nous
 * qui vendons, et nous le savons avant le logiciel.
 */
export type OrderStatus =
  | 'awaiting_transfer'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

/** Les états depuis lesquels l'équipe peut encore annuler sans conséquence. */
export const CANCELLABLE: readonly OrderStatus[] = ['awaiting_transfer', 'confirmed'];

export interface OrderLine {
  productId: string;
  variantId: string | null;
  name: string;
  quantity: number;
  unitPrice: Cents;
  lineTotal: Cents;
}

export interface Order {
  /** Référence publique, communiquée au client (ex. PEL-7F2K9A). */
  ref: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;

  /**
   * Langue du parcours d'achat.
   *
   * Stockée avec la commande et non recalculée : les e-mails de suivi sont
   * envoyés des jours plus tard, parfois depuis une tâche planifiée qui n'a
   * aucun contexte de requête. Un client qui a commandé en néerlandais doit
   * recevoir son numéro de suivi en néerlandais.
   */
  locale: Locale;

  email: string;
  lines: OrderLine[];
  subtotal: Cents;
  shippingPrice: Cents;
  total: Cents;
  vat: Cents;
  currency: string;

  shippingLabel: string;
  address: ShippingAddress | null;

  /**
   * Nom du titulaire du compte qui émettra le virement, quand il diffère de
   * celui du client. Sert uniquement au rapprochement : sur un relevé, le
   * libellé porte le nom du compte, pas celui de l'acheteur, et sans cette
   * information une commande payée par un conjoint reste introuvable.
   */
  transferHolder: string | null;

  /**
   * Horodatage auquel le CLIENT a déclaré avoir effectué le virement.
   *
   * Ce n'est pas une preuve de paiement et ça ne fait avancer aucun état :
   * seule l'équipe, relevé bancaire sous les yeux, peut confirmer. C'est un
   * signal — « regardez le compte » — et c'est ce qui raccourcit le délai
   * entre le virement réel et sa constatation.
   */
  transferDeclaredAt: string | null;

  trackingNumber: string | null;
  carrier: string | null;

  /** Journal d’événements : indispensable pour diagnostiquer sans base de données. */
  events: { at: string; type: string; détail?: string }[];
}

export interface OrderStore {
  get(ref: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
  /**
   * Verrou d’idempotence. Renvoie `true` si le verrou est obtenu, `false`
   * s’il était déjà pris. Sert aux envois d’e-mails : un double clic sur
   * « virement reçu » ne doit pas écrire deux fois au client.
   */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  /**
   * Commandes les plus récentes, pour la page d’administration. Triées de la
   * plus récente à la plus ancienne.
   */
  listRecent(limit: number): Promise<Order[]>;
}
