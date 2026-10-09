/**
 * Registre des fournisseurs.
 *
 * Les identifiants employés ici doivent correspondre au champ `supplier` de
 * `sourcing.ts`. En l’absence de configuration, on bascule sur un fournisseur
 * de simulation : le site reste utilisable de bout en bout en développement,
 * sans jamais passer de vraie commande par accident.
 */

import type { Supplier, SupplierOrderRequest, SupplierOrderResult } from './types';
import { createRestSupplier } from './rest-supplier';
import { createEmailSupplier } from './email-supplier';

/** Fournisseur de simulation : journalise et réussit, sans rien envoyer. */
function createDryRunSupplier(id: string): Supplier {
  return {
    id,
    label: `${id} (simulation)`,
    async placeOrder(order: SupplierOrderRequest): Promise<SupplierOrderResult> {
      console.warn(
        `[fournisseur:simulation] commande ${order.orderRef} NON transmise — ` +
          `aucun fournisseur configure pour « ${id} ». Lignes : ` +
          order.lines.map((l) => `${l.quantity}x${l.supplierSku}`).join(', '),
      );
      return {
        ok: true,
        supplierOrderId: `dryrun_${order.orderRef}`,
        trackingNumber: null,
        carrier: null,
      };
    },
  };
}

let registry: Map<string, Supplier> | null = null;

function build(): Map<string, Supplier> {
  const map = new Map<string, Supplier>();

  const restUrl = process.env.SUPPLIER_API_URL;
  const restKey = process.env.SUPPLIER_API_KEY;
  if (restUrl && restKey) {
    map.set(
      'eu-primary',
      createRestSupplier({
        id: 'eu-primary',
        label: 'Grossiste principal UE',
        baseUrl: restUrl,
        apiKey: restKey,
        ...(process.env.SUPPLIER_AUTH_HEADER ? { authHeader: process.env.SUPPLIER_AUTH_HEADER } : {}),
      }),
    );
  } else if (process.env.SUPPLIER_ORDER_EMAIL) {
    map.set(
      'eu-primary',
      createEmailSupplier({
        id: 'eu-primary',
        label: 'Grossiste principal UE (e-mail)',
        to: process.env.SUPPLIER_ORDER_EMAIL,
        ...(process.env.SUPPLIER_ORDER_BCC ? { bcc: process.env.SUPPLIER_ORDER_BCC } : {}),
      }),
    );
  }

  if (process.env.POD_ORDER_EMAIL) {
    map.set(
      'pod-eu',
      createEmailSupplier({
        id: 'pod-eu',
        label: 'Impression à la demande UE',
        to: process.env.POD_ORDER_EMAIL,
        ...(process.env.SUPPLIER_ORDER_BCC ? { bcc: process.env.SUPPLIER_ORDER_BCC } : {}),
      }),
    );
  }

  return map;
}

export function getSupplier(id: string): Supplier {
  registry ??= build();
  return registry.get(id) ?? createDryRunSupplier(id);
}

/** Vrai si au moins un fournisseur réel est configure. */
export function hasRealSupplier(): boolean {
  registry ??= build();
  return registry.size > 0;
}

export type { Supplier, SupplierOrderRequest, SupplierOrderResult } from './types';
