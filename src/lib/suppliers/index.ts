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

/**
 * Identifiants attendus par `sourcing.ts`.
 *
 * Trois fournisseurs distincts parce qu'ils le sont réellement dans cette
 * niche : le grossiste qui livre les appareils sur palette n'est jamais celui
 * qui fournit les conduits, et le granulé se commande chez un négoce local
 * pour éviter de payer le transport d'une tonne sur 1 500 km.
 */
const SUPPLIER_IDS = {
  stoves: 'eu-stoves',
  flues: 'eu-flues',
  pellets: 'eu-pellets',
} as const;

const bcc = (): { bcc?: string } =>
  process.env.SUPPLIER_ORDER_BCC ? { bcc: process.env.SUPPLIER_ORDER_BCC } : {};

function build(): Map<string, Supplier> {
  const map = new Map<string, Supplier>();

  // Grossiste appareils : API REST si disponible, bon de commande par e-mail
  // sinon. Beaucoup de grossistes européens n'ont que l'e-mail, et ce sont
  // souvent les plus réactifs.
  const restUrl = process.env.SUPPLIER_API_URL;
  const restKey = process.env.SUPPLIER_API_KEY;
  if (restUrl && restKey) {
    map.set(
      SUPPLIER_IDS.stoves,
      createRestSupplier({
        id: SUPPLIER_IDS.stoves,
        label: 'Grossiste appareils UE',
        baseUrl: restUrl,
        apiKey: restKey,
        ...(process.env.SUPPLIER_AUTH_HEADER ? { authHeader: process.env.SUPPLIER_AUTH_HEADER } : {}),
      }),
    );
  } else if (process.env.SUPPLIER_ORDER_EMAIL) {
    map.set(
      SUPPLIER_IDS.stoves,
      createEmailSupplier({
        id: SUPPLIER_IDS.stoves,
        label: 'Grossiste appareils UE (e-mail)',
        to: process.env.SUPPLIER_ORDER_EMAIL,
        ...bcc(),
      }),
    );
  }

  // Conduits et accessoires. À défaut d'adresse dédiée, on retombe sur le
  // grossiste appareils : certains distribuent les deux.
  const fluesEmail = process.env.FLUES_ORDER_EMAIL ?? process.env.SUPPLIER_ORDER_EMAIL;
  if (fluesEmail) {
    map.set(
      SUPPLIER_IDS.flues,
      createEmailSupplier({
        id: SUPPLIER_IDS.flues,
        label: 'Grossiste conduits et accessoires',
        to: fluesEmail,
        ...bcc(),
      }),
    );
  }

  if (process.env.PELLETS_ORDER_EMAIL) {
    map.set(
      SUPPLIER_IDS.pellets,
      createEmailSupplier({
        id: SUPPLIER_IDS.pellets,
        label: 'Négoce granulés',
        to: process.env.PELLETS_ORDER_EMAIL,
        ...bcc(),
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
