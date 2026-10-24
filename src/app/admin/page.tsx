import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isAdminConfigured, isSignedIn } from '@/lib/admin';
import { getStore } from '@/lib/store';
import { price, date as formatDate } from '@/lib/format';
import { formatIban, bankDetails } from '@/lib/bank';
import type { Order, OrderStatus } from '@/lib/store/types';

/**
 * Back-office.
 *
 * Volontairement hors du système de langues : c'est un outil interne, pas une
 * page du site. Le traduire en quatre langues coûterait un quart du travail du
 * reste du projet pour servir trois personnes qui parlent toutes français.
 *
 * Volontairement hors index, aussi — cf. `robots` plus bas et l'exclusion dans
 * le proxy.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Commandes — administration',
  robots: { index: false, follow: false },
};

const ÉTATS: Record<OrderStatus, { label: string; ton: string }> = {
  awaiting_transfer: { label: 'En attente de virement', ton: 'bg-[#fdf6e7] text-[#6b4205]' },
  confirmed: { label: 'Virement reçu', ton: 'bg-[#eaf4ec] text-[#1f5130]' },
  forwarded: { label: 'Transmise au fournisseur', ton: 'bg-[#eaf1f7] text-[#1d3f63]' },
  fulfillment_failed: { label: 'Transmission en échec', ton: 'bg-[#fdf1ec] text-[#7a2d12]' },
  shipped: { label: 'En route', ton: 'bg-[#eaf1f7] text-[#1d3f63]' },
  delivered: { label: 'Livrée', ton: 'bg-[#eef0ee] text-[#3c403c]' },
  cancelled: { label: 'Annulée', ton: 'bg-[#eef0ee] text-[#6b6b6b]' },
};

const MESSAGES: Record<string, string> = {
  confirmed: 'Virement constaté. La commande part chez le fournisseur.',
  'confirmed-not-forwarded':
    'Virement constaté, mais la transmission au fournisseur a échoué. Le rattrapage réessaiera ; une alerte a été envoyée.',
  shipped: 'Commande marquée en route.',
  delivered: 'Commande marquée livrée.',
  cancelled: 'Commande annulée.',
  'bad-password': 'Mot de passe incorrect.',
  denied: 'Session expirée. Reconnectez-vous.',
  'wrong-state': 'Action impossible depuis l’état actuel de cette commande.',
  'not-found': 'Référence introuvable.',
  unconfigured: 'ADMIN_PASSWORD n’est pas configuré.',
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const message = params['m'];
  const avis = typeof message === 'string' ? MESSAGES[message] ?? null : null;
  const demande = (clé: string) => (typeof params[clé] === 'string' ? params[clé] : null);
  const àConfirmer = demande('confirm');
  const àAnnuler = demande('cancel');

  if (!isAdminConfigured()) {
    return (
      <Cadre>
        <h1 className="text-xl font-semibold">Back-office fermé</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          La variable <code className="font-mono">ADMIN_PASSWORD</code> n’est pas renseignée, ou
          fait moins de douze caractères. Tant que c’est le cas, cette page reste close — un défaut
          de configuration ne doit pas ouvrir l’accès aux commandes.
        </p>
      </Cadre>
    );
  }

  const jar = await cookies();
  if (!isSignedIn(jar.get(ADMIN_COOKIE)?.value)) {
    return (
      <Cadre>
        <h1 className="text-xl font-semibold">Commandes</h1>
        {avis ? <Avis texte={avis} /> : null}
        <form method="post" action="/admin/actions" className="mt-5">
          <input type="hidden" name="action" value="signin" />
          <label htmlFor="password" className="block text-sm font-semibold">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm"
          />
          <button type="submit" className="btn-primary mt-4 w-full">
            Entrer
          </button>
        </form>
      </Cadre>
    );
  }

  const orders = await getStore().listRecent(100);
  const attente = orders.filter((o) => o.status === 'awaiting_transfer');
  const bank = bankDetails();

  return (
    <div className="container-page max-w-5xl py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold">Commandes</h1>
        <form method="post" action="/admin/actions">
          <input type="hidden" name="action" value="signout" />
          <button type="submit" className="text-sm text-ink-soft underline underline-offset-4">
            Se déconnecter
          </button>
        </form>
      </div>

      {avis ? <Avis texte={avis} /> : null}

      <p className="mt-4 text-sm text-ink-soft">
        {attente.length === 0
          ? 'Aucune commande en attente de virement.'
          : `${attente.length} commande${attente.length > 1 ? 's' : ''} en attente de virement, sur ${orders.length} au total.`}
        {bank.iban ? (
          <>
            {' · '}
            <span className="font-mono text-xs">{formatIban(bank.iban)}</span>
          </>
        ) : (
          <span className="text-[#7a2d12]"> · aucun RIB configuré</span>
        )}
      </p>

      {orders.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line bg-cream px-5 py-6 text-sm text-ink-soft">
          Aucune commande pour l’instant. Si vous en attendez une, vérifiez que la persistance est
          configurée : sans <code className="font-mono">UPSTASH_REDIS_REST_URL</code>, les commandes
          ne survivent pas au redémarrage.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <Ligne
              key={order.ref}
              order={order}
              confirmer={àConfirmer === order.ref}
              annuler={àAnnuler === order.ref}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Ligne({
  order,
  confirmer,
  annuler,
}: {
  order: Order;
  confirmer: boolean;
  annuler: boolean;
}) {
  const état = ÉTATS[order.status];
  const a = order.address;

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-base font-bold">{order.ref}</p>
          <p className="mt-0.5 text-xs text-muted">
            {formatDate(order.createdAt, 'fr')} · {order.locale.toUpperCase()}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${état.ton}`}>
          {état.label}
        </span>
      </div>

      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="font-semibold">{a?.name ?? '—'}</p>
          <p className="text-ink-soft">
            {order.email}
            {a?.phone ? ` · ${a.phone}` : ''}
          </p>
          <p className="mt-1 text-ink-soft">
            {a ? `${a.line1}${a.line2 ? `, ${a.line2}` : ''}, ${a.postalCode} ${a.city} (${a.country})` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted">{order.shippingLabel}</p>

          {order.transferHolder ? (
            <p className="mt-2 rounded-lg bg-cream px-2.5 py-1.5 text-xs">
              Virement émis par <strong>{order.transferHolder}</strong>
            </p>
          ) : null}

          <ul className="mt-3 space-y-0.5 text-xs text-ink-soft">
            {order.lines.map((l) => (
              <li key={`${l.productId}:${l.variantId ?? ''}`}>
                {l.quantity} × {l.name} — {price(l.lineTotal, 'fr')}
              </li>
            ))}
          </ul>

          {order.trackingNumber ? (
            <p className="mt-2 text-xs">
              Suivi : <span className="font-mono">{order.trackingNumber}</span>
              {order.carrier ? ` (${order.carrier})` : ''}
            </p>
          ) : null}
        </div>

        <div className="text-right">
          <p className="font-display text-xl font-semibold tabular-nums">
            {price(order.total, 'fr')}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {order.status === 'awaiting_transfer' ? (
              confirmer ? (
                <Deuxième
                  ref_={order.ref}
                  action="confirm"
                  question={`Vous avez bien vu ${price(order.total, 'fr')} arriver sur le compte, avec la référence ${order.ref} ?`}
                  consequence="La commande part chez le fournisseur, donc à l’expédition."
                  label="Oui, virement constaté"
                  classe="btn-ember"
                />
              ) : (
                <a href={`/admin?confirm=${encodeURIComponent(order.ref)}`} className="btn-ember w-full whitespace-nowrap text-center text-sm">
                  Virement reçu
                </a>
              )
            ) : null}
            {order.status === 'confirmed' ||
            order.status === 'forwarded' ||
            order.status === 'fulfillment_failed' ? (
              <Action ref_={order.ref} action="ship" label="Marquer en route" classe="btn-primary" />
            ) : null}
            {order.status === 'shipped' ? (
              <Action ref_={order.ref} action="deliver" label="Marquer livrée" classe="btn-primary" />
            ) : null}
            {order.status === 'awaiting_transfer' || order.status === 'confirmed' ? (
              annuler ? (
                <Deuxième
                  ref_={order.ref}
                  action="cancel"
                  question={`Annuler définitivement la commande ${order.ref} ?`}
                  consequence="Le client n’est pas prévenu automatiquement : écrivez-lui."
                  label="Oui, annuler"
                  classe="btn-ghost"
                />
              ) : (
                <a href={`/admin?cancel=${encodeURIComponent(order.ref)}`} className="btn-ghost w-full whitespace-nowrap text-center text-sm">
                  Annuler
                </a>
              )
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Bouton d'action simple, pour ce qui ne prête pas à conséquence.
 */
function Action({
  ref_,
  action,
  label,
  classe,
}: {
  ref_: string;
  action: string;
  label: string;
  classe: string;
}) {
  return (
    <form method="post" action="/admin/actions">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="ref" value={ref_} />
      <button type="submit" className={`${classe} w-full whitespace-nowrap text-sm`}>
        {label}
      </button>
    </form>
  );
}

/**
 * Deuxième étape des actions qui engagent.
 *
 * Une boîte de dialogue du navigateur aurait demandé un îlot client, et se
 * serait close sur un appui distrait. Cette étape est rendue par le serveur :
 * elle rappelle le montant exact et ce qui va se produire, elle survit à
 * l'absence de JavaScript, et il faut deux gestes délibérés pour déclencher
 * une expédition.
 */
function Deuxième({
  ref_,
  action,
  question,
  consequence,
  label,
  classe,
}: {
  ref_: string;
  action: string;
  question: string;
  consequence: string;
  label: string;
  classe: string;
}) {
  return (
    <div className="rounded-lg border border-ink bg-paper p-3 text-left">
      <p className="text-sm font-semibold">{question}</p>
      <p className="mt-1 text-xs text-ink-soft">{consequence}</p>
      <form method="post" action="/admin/actions" className="mt-3">
        <input type="hidden" name="action" value={action} />
        <input type="hidden" name="ref" value={ref_} />
        <button type="submit" className={`${classe} w-full whitespace-nowrap text-sm`}>
          {label}
        </button>
      </form>
      <a href="/admin" className="mt-2 block text-center text-xs text-ink-soft underline underline-offset-4">
        Revenir
      </a>
    </div>
  );
}

function Avis({ texte }: { texte: string }) {
  return (
    <p role="status" className="mt-4 rounded-lg border border-line bg-cream px-3 py-2.5 text-sm">
      {texte}
    </p>
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page max-w-md py-16">
      <div className="card p-6">{children}</div>
    </div>
  );
}
