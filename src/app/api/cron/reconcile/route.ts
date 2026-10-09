/**
 * GET /api/cron/reconcile
 *
 * Filet de sécurité de l’automatisation. Un fournisseur indisponible pendant
 * dix minutes ne doit pas se traduire par une commande payée jamais expédiée :
 * cette tache reprend les commandes en échec.
 *
 * A planifier toutes les 15 minutes (cf. `vercel.json`). Protégée par
 * `CRON_SECRET` : sans cela, l’URL est publique et déclenchable a volonté.
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { retryFailedOrders } from '@/lib/fulfillment';
import { alertOps } from '@/lib/email/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Marge confortable : le rattrapage appelle plusieurs fournisseurs a la suite. */
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.replace(/^Bearer\s+/i, '');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'non autorise' }, { status: 401 });
  }

  const result = await retryFailedOrders(25);

  // Les commandes a bout de tentatives exigent une action humaine :
  // elles ne doivent jamais rester uniquement dans les journaux.
  if (result.exhausted.length > 0) {
    await alertOps(
      `${result.exhausted.length} commande(s) bloquée(s)`,
      [
        'Ces commandes ont épuisé leurs tentatives automatiques et attendent',
        'une intervention manuelle :',
        '',
        ...result.exhausted.map((ref) => `  - ${ref}`),
        '',
        'Vérifiez la disponibilité chez le fournisseur, puis relancez ou remboursez.',
      ].join('\n'),
    );
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    ...result,
  });
}
