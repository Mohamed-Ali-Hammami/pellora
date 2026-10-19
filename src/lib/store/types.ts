import type { Cents } from '../money';
import type { Locale } from '../i18n/config';
import type { ShippingAddress } from '../suppliers/types';

/**
 * Cycle de vie d’une commande.
 *
 *   pending ──paiement──> paid ──transmission──> forwarded ──suivi──> shipped ──> delivered
 *                           │                       │
 *                           └──> fulfillment_failed (reessai automatique)
 *                           └──> refunded / cancelled
 */
export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'forwarded'
  | 'fulfillment_failed'
  | 'shipped'
  | 'delivered'
  | 'refunded'
  | 'cancelled';

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

  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;

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
  /** Index inverse : retrouver une commande depuis l’identifiant Stripe. */
  findByStripeSession(sessionId: string): Promise<Order | null>;
  /**
   * Verrou d’idempotence. Renvoie `true` si le verrou est obtenu,
   * `false` s’il était déjà pris. Essentiel : Stripe rejoue ses webhooks,
   * et une commande transmise deux fois est expédiée deux fois.
   */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  /** Commandes à réessayer (transmission en échec). */
  listFailed(limit: number): Promise<Order[]>;
}
