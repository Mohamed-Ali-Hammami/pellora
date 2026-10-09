/**
 * Gabarits des e-mails transactionnels.
 *
 * HTML volontairement archaïque — tables et styles en ligne. Les clients mail
 * (Outlook en tête) ignorent flexbox, grid et les feuilles de style externes :
 * un gabarit moderne s’affiche correctement à l’écran et casse en boite de
 * réception. Chaque message a aussi une version texte, que certains clients
 * privilégient et que les filtres anti-spam attendent.
 */

import { brand } from '../brand';
import { formatPrice } from '../money';
import type { Order } from '../store/types';

const C = {
  ink: '#1c1917',
  muted: '#78716c',
  line: '#e7e5e4',
  accent: '#7c2d12',
  bg: '#faf9f7',
};

function layout(title: string, inner: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${C.ink};">
<table role="présentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
<tr><td align="center">
<table role="présentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${C.line};border-radius:10px;">
<tr><td style="padding:28px 28px 8px;">
<div style="font-size:19px;font-weight:700;letter-spacing:-0.01em;">${brand.name}</div>
<div style="font-size:13px;color:${C.muted};margin-top:2px;">${brand.tagline}</div>
</td></tr>
${inner}
<tr><td style="padding:20px 28px 28px;border-top:1px solid ${C.line};font-size:12px;color:${C.muted};line-height:1.6;">
${brand.legalName} — <a href="mailto:${brand.email.support}" style="color:${C.accent};">${brand.email.support}</a><br>
Vous recevez ce message parce que vous avez passe commande sur ${brand.domain}.
</td></tr>
</table></td></tr></table></body></html>`;
}

function lineRows(order: Order): string {
  return order.lines
    .map(
      (l) => `<tr>
<td style="padding:7px 0;font-size:14px;border-bottom:1px solid ${C.line};">${escapeHtml(l.name)}<span style="color:${C.muted};"> &times; ${l.quantity}</span></td>
<td align="right" style="padding:7px 0;font-size:14px;border-bottom:1px solid ${C.line};white-space:nowrap;">${formatPrice(l.lineTotal)}</td>
</tr>`,
    )
    .join('');
}

function totalsRows(order: Order): string {
  return `<tr><td style="padding:7px 0;font-size:14px;color:${C.muted};">Sous-total</td>
<td align="right" style="padding:7px 0;font-size:14px;">${formatPrice(order.subtotal)}</td></tr>
<tr><td style="padding:0 0 7px;font-size:14px;color:${C.muted};">${escapeHtml(order.shippingLabel)}</td>
<td align="right" style="padding:0 0 7px;font-size:14px;">${order.shippingPrice === 0 ? 'Offerte' : formatPrice(order.shippingPrice)}</td></tr>
<tr><td style="padding:10px 0 0;font-size:15px;font-weight:700;border-top:2px solid ${C.ink};">Total</td>
<td align="right" style="padding:10px 0 0;font-size:15px;font-weight:700;border-top:2px solid ${C.ink};">${formatPrice(order.total)}</td></tr>
<tr><td colspan="2" style="padding:4px 0 0;font-size:12px;color:${C.muted};">dont TVA ${formatPrice(order.vat)}</td></tr>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function orderConfirmation(order: Order): { subject: string; html: string; text: string } {
  const trackUrl = `${brand.url}/suivi?ref=${encodeURIComponent(order.ref)}`;

  const inner = `<tr><td style="padding:16px 28px 4px;">
<div style="font-size:21px;font-weight:700;">Commande confirmée</div>
<div style="font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">
Merci. Votre paiement est enregistre et votre commande part en préparation.
Référence <strong style="color:${C.ink};">${escapeHtml(order.ref)}</strong>.
</div></td></tr>
<tr><td style="padding:18px 28px 0;">
<table role="présentation" width="100%" cellpadding="0" cellspacing="0">${lineRows(order)}${totalsRows(order)}</table>
</td></tr>
<tr><td style="padding:22px 28px 0;">
<a href="${trackUrl}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:7px;font-size:14px;font-weight:600;">Suivre ma commande</a>
</td></tr>
<tr><td style="padding:18px 28px 22px;font-size:13px;color:${C.muted};line-height:1.6;">
Vous recevrez un numéro de suivi dès que le colis quittera l’entrepôt, généralement sous 1 à 2 jours ouvrés.
Vous disposez de 30 jours pour changer d’avis — il suffit de répondre à ce message.
</td></tr>`;

  const text = [
    `Commande confirmée — ${order.ref}`,
    '',
    ...order.lines.map((l) => `  ${l.quantity} x ${l.name}  ${formatPrice(l.lineTotal)}`),
    '',
    `  Sous-total        ${formatPrice(order.subtotal)}`,
    `  ${order.shippingLabel}  ${order.shippingPrice === 0 ? 'Offerte' : formatPrice(order.shippingPrice)}`,
    `  Total             ${formatPrice(order.total)} (dont TVA ${formatPrice(order.vat)})`,
    '',
    `Suivi : ${trackUrl}`,
    '',
    `Une question ? Répondez à ce message ou écrivez à ${brand.email.support}.`,
  ].join('\n');

  return {
    subject: `Commande ${order.ref} confirmée`,
    html: layout(`Commande ${order.ref}`, inner),
    text,
  };
}

export function shippingNotification(order: Order): { subject: string; html: string; text: string } {
  const trackUrl = `${brand.url}/suivi?ref=${encodeURIComponent(order.ref)}`;
  const carrier = order.carrier ?? 'Le transporteur';

  const inner = `<tr><td style="padding:16px 28px 4px;">
<div style="font-size:21px;font-weight:700;">Votre colis est parti</div>
<div style="font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">
Commande <strong style="color:${C.ink};">${escapeHtml(order.ref)}</strong> expédiée par ${escapeHtml(carrier)}.
</div></td></tr>
${
  order.trackingNumber
    ? `<tr><td style="padding:16px 28px 0;">
<table role="présentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.line};border-radius:8px;">
<tr><td style="padding:14px 16px;">
<div style="font-size:12px;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">Numéro de suivi</div>
<div style="font-size:17px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:4px;">${escapeHtml(order.trackingNumber)}</div>
</td></tr></table></td></tr>`
    : ''
}
<tr><td style="padding:22px 28px 0;">
<a href="${trackUrl}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:7px;font-size:14px;font-weight:600;">Suivre le colis</a>
</td></tr>
<tr><td style="padding:18px 28px 22px;font-size:13px;color:${C.muted};line-height:1.6;">
Le suivi peut mettre quelques heures à s’activer chez le transporteur. Si rien ne bouge après 48 h, répondez à ce message : on s’en occupe.
</td></tr>`;

  const text = [
    `Votre colis est parti — commande ${order.ref}`,
    '',
    order.trackingNumber
      ? `Numéro de suivi : ${order.trackingNumber} (${carrier})`
      : `Expédié par ${carrier}.`,
    '',
    `Suivi : ${trackUrl}`,
    '',
    "Le suivi peut mettre quelques heures à s’activer. Sans mouvement après 48 h, répondez à ce message.",
  ].join('\n');

  return { subject: `Commande ${order.ref} expédiée`, html: layout('Colis expédié', inner), text };
}
