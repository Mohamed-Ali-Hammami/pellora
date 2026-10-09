/**
 * Contrat commun à tous les fournisseurs.
 *
 * L’intérêt de l’abstraction : changer de grossiste ne doit toucher qu’un
 * fichier. En dropshipping, le fournisseur est la pièce qu’on change le plus
 * souvent (rupture, délai qui dérape, qualité qui baisse) — le code ne doit
 * pas le supposer stable.
 */

export interface SupplierOrderLine {
  supplierSku: string;
  quantity: number;
  /** Nom lisible, pour les fournisseurs qui expédient avec un bon de commande. */
  name: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
}

export interface SupplierOrderRequest {
  /** Notre référence interne. Sert de clé d’idempotence chez le fournisseur. */
  orderRef: string;
  lines: SupplierOrderLine[];
  address: ShippingAddress;
  email: string;
  /** Mode d’expédition demande. */
  shippingMethod: string;
  /** Note imprimée sur le bon de livraison (sans mention de notre marge). */
  note?: string;
}

export type SupplierOrderResult =
  | { ok: true; supplierOrderId: string; trackingNumber: string | null; carrier: string | null }
  | { ok: false; error: string; retryable: boolean };

export interface Supplier {
  readonly id: string;
  readonly label: string;
  /** Transmet la commande. DOIT être idempotent sur `orderRef`. */
  placeOrder(request: SupplierOrderRequest): Promise<SupplierOrderResult>;
  /** Interroge le suivi. Optionnel : certains fournisseurs ne poussent que par webhook. */
  fetchTracking?(
    supplierOrderId: string,
  ): Promise<{ trackingNumber: string | null; carrier: string | null; status: string } | null>;
}
