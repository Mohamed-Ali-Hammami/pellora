/**
 * Fournisseur expose par API REST — le cas le plus courant chez les
 * grossistes européens (BigBuy, VidaXL, Syncee et consorts ont tous une API
 * de ce type, avec des noms de champs différents).
 *
 * `fieldMap` permet d’adapter le nommage sans reecrire la logique.
 */

import type { Supplier, SupplierOrderRequest, SupplierOrderResult } from './types';

export interface RestSupplierConfig {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  /** En-tête portant la clé. Varie d’un fournisseur à l’autre. */
  authHeader?: string;
  orderPath?: string;
  trackingPath?: string;
  timeoutMs?: number;
}

export function createRestSupplier(config: RestSupplierConfig): Supplier {
  const {
    baseUrl,
    apiKey,
    authHeader = 'Authorization',
    orderPath = '/orders',
    trackingPath = '/orders/:id',
    timeoutMs = 15_000,
  } = config;

  const headers = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    [authHeader]: authHeader === 'Authorization' ? `Bearer ${apiKey}` : apiKey,
  });

  async function request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    id: config.id,
    label: config.label,

    async placeOrder(order: SupplierOrderRequest): Promise<SupplierOrderResult> {
      try {
        const response = await request(orderPath, {
          method: 'POST',
          headers: {
            ...headers(),
            // Clé d’idempotence : si le webhook Stripe est rejoue, le
            // fournisseur ne doit pas expédier deux fois.
            'Idempotency-Key': order.orderRef,
          },
          body: JSON.stringify({
            reference: order.orderRef,
            shipping_method: order.shippingMethod,
            note: order.note ?? '',
            customer: { email: order.email },
            shipping_address: {
              name: order.address.name,
              address_1: order.address.line1,
              address_2: order.address.line2 ?? '',
              postcode: order.address.postalCode,
              city: order.address.city,
              country: order.address.country,
              phone: order.address.phone ?? '',
            },
            items: order.lines.map((l) => ({ sku: l.supplierSku, quantity: l.quantity })),
          }),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          return {
            ok: false,
            error: `${config.id} a répondu ${response.status} : ${body.slice(0, 400)}`,
            // 4xx = requête invalide, inutile de réessayer.
            // 408/429/5xx = incident transitoire, on réessaiera.
            retryable:
              response.status >= 500 || response.status === 429 || response.status === 408,
          };
        }

        const data = (await response.json()) as Record<string, unknown>;
        const supplierOrderId = String(data['id'] ?? data['order_id'] ?? order.orderRef);
        const tracking = data['tracking_number'];
        const carrier = data['carrier'];

        return {
          ok: true,
          supplierOrderId,
          trackingNumber: typeof tracking === 'string' && tracking !== '' ? tracking : null,
          carrier: typeof carrier === 'string' && carrier !== '' ? carrier : null,
        };
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        return {
          ok: false,
          error: aborted
            ? `${config.id} n’a pas répondu en ${timeoutMs} ms`
            : `appel ${config.id} échoué : ${error instanceof Error ? error.message : String(error)}`,
          retryable: true,
        };
      }
    },

    async fetchTracking(supplierOrderId: string) {
      const response = await request(trackingPath.replace(':id', encodeURIComponent(supplierOrderId)), {
        method: 'GET',
        headers: headers(),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as Record<string, unknown>;
      const tracking = data['tracking_number'];
      const carrier = data['carrier'];
      return {
        trackingNumber: typeof tracking === 'string' && tracking !== '' ? tracking : null,
        carrier: typeof carrier === 'string' && carrier !== '' ? carrier : null,
        status: String(data['status'] ?? 'unknown'),
      };
    },
  };
}
