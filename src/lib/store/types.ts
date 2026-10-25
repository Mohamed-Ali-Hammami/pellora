import type { Cents } from '../money';
import type { Locale } from '../i18n/config';
import type { ShippingAddress } from '../suppliers/types';

/**
 * Cycle de vie d’une commande, en paiement par virement.
 *
 *   awaiting_transfer ──l'équipe constate le virement──> confirmed
 *        │                                                   │
 *        └──> cancelled                          transmission au fournisseur
 *                                                            ↓
 *                                   forwarded ──suivi──> shipped ──> delivered
 *                                        └──> fulfillment_failed (réessai)
 *
 * `awaiting_transfer` est l'état d'entrée : la commande existe, le client a
 * ses coordonnées bancaires et sa référence, mais rien n'est engagé tant que
 * l'argent n'est pas arrivé. Le passage à `confirmed` est MANUEL — c'est une
 * personne qui a vu la ligne sur le relevé. Aucun automatisme ne doit le
 * faire : une commande transmise au fournisseur sans virement reçu est une
 * perte sèche.
 */
export type OrderStatus =
  | 'awaiting_transfer'
  | 'confirmed'
  | 'forwarded'
  | 'fulfillment_failed'
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

export interface SupplierOrderRecord {
  supplier: string;
  /** Référence transmise au fournisseur — clé d’idempotence de son cote. */
  orderRef: string;
  supplierOrderId: string | null;
  status: 'ok' | 'failed';
  error: string | null;
  attempts: number;
  lastAttemptAt: string;
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

  /**
   * État de transmission PAR FOURNISSEUR.
   *
   * Un tableau plat d’identifiants ne suffit pas : sur une commande éclatée
   * entre deux grossistes, si l’un réussit et l’autre échoué, il faut pouvoir
   * réessayer uniquement celui qui a échoué. Sinon le rattrapage considère la
   * commande comme transmise et l’article manquant n’est jamais commande.
   */
  supplierOrders: SupplierOrderRecord[];
  trackingNumber: string | null;
  carrier: string | null;

  /** Journal d’événements : indispensable pour diagnostiquer sans base de données. */
  events: { at: string; type: string; détail?: string }[];
  /** Nombre de tentatives de transmission au fournisseur. */
  fulfillmentAttempts: number;
}

export interface OrderStore {
  get(ref: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
  /**
   * Verrou d’idempotence. Renvoie `true` si le verrou est obtenu,
   * `false` s’il était déjà pris. Protège la transmission au fournisseur :
   * un double clic sur « virement reçu », ou un rattrapage qui croise une
   * confirmation manuelle, expédierait la commande deux fois.
   */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  /**
   * Commandes les plus récentes, pour la page d’administration. Triées de la
   * plus récente à la plus ancienne.
   */
  listRecent(limit: number): Promise<Order[]>;
  /** Commandes à réessayer (transmission en échec). */
  listFailed(limit: number): Promise<Order[]>;
}
