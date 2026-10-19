/**
 * Gabarits des e-mails transactionnels.
 *
 * HTML volontairement archaïque — tables et styles en ligne. Les clients mail
 * (Outlook en tête) ignorent flexbox, grid et les feuilles de style externes :
 * un gabarit moderne s'affiche correctement à l'écran et casse en boîte de
 * réception. Chaque message a aussi une version texte, que certains clients
 * privilégient et que les filtres anti-spam attendent.
 *
 * La langue vient de la commande (`order.locale`), jamais de la requête : ces
 * messages partent parfois des jours plus tard, depuis une tâche planifiée
 * sans aucun contexte de requête.
 */

import { brand, isLegalPlaceholder } from '../brand';
import { price } from '../format';
import { interpolate } from '../format';
import { getDictionary } from '../i18n/dictionaries';
import { htmlLangs } from '../i18n/config';
import { href } from '../i18n/routes';
import type { Order } from '../store/types';

const C = {
  ink: '#17120f',
  muted: '#776a62',
  line: '#e4dad0',
  accent: '#bc4213',
  bg: '#fbf8f4',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Raison sociale si elle est renseignée, nom commercial sinon. */
function senderName(): string {
  return isLegalPlaceholder(brand.legal.entity) ? brand.name : brand.legal.entity;
}

function layout(order: Order, title: string, inner: string): string {
  const dict = getDictionary(order.locale);

  return `<!doctype html>
<html lang="${htmlLangs[order.locale]}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${C.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${C.line};border-radius:10px;">
<tr><td style="padding:28px 28px 8px;">
<div style="font-size:19px;font-weight:700;letter-spacing:-0.01em;">${brand.name}</div>
<div style="font-size:13px;color:${C.muted};margin-top:2px;">${escapeHtml(brand.tagline[order.locale])}</div>
</td></tr>
${inner}
<tr><td style="padding:20px 28px 28px;border-top:1px solid ${C.line};font-size:12px;color:${C.muted};line-height:1.6;">
${escapeHtml(senderName())} — <a href="mailto:${brand.email.support}" style="color:${C.accent};">${brand.email.support}</a><br>
${escapeHtml(interpolate(dict.emails.footerNote, { domain: brand.domain }))}
</td></tr>
</table></td></tr></table></body></html>`;
}

function lineRows(order: Order): string {
  return order.lines
    .map(
      (line) => `<tr>
<td style="padding:7px 0;font-size:14px;border-bottom:1px solid ${C.line};">${escapeHtml(line.name)}<span style="color:${C.muted};"> &times; ${line.quantity}</span></td>
<td align="right" style="padding:7px 0;font-size:14px;border-bottom:1px solid ${C.line};white-space:nowrap;">${price(line.lineTotal, order.locale)}</td>
</tr>`,
    )
    .join('');
}

function totalsRows(order: Order): string {
  const dict = getDictionary(order.locale);
  const shipping =
    order.shippingPrice === 0 ? dict.emails.free : price(order.shippingPrice, order.locale);

  return `<tr><td style="padding:7px 0;font-size:14px;color:${C.muted};">${escapeHtml(dict.emails.subtotal)}</td>
<td align="right" style="padding:7px 0;font-size:14px;">${price(order.subtotal, order.locale)}</td></tr>
<tr><td style="padding:0 0 7px;font-size:14px;color:${C.muted};">${escapeHtml(order.shippingLabel)}</td>
<td align="right" style="padding:0 0 7px;font-size:14px;">${escapeHtml(shipping)}</td></tr>
<tr><td style="padding:10px 0 0;font-size:15px;font-weight:700;border-top:2px solid ${C.ink};">${escapeHtml(dict.emails.total)}</td>
<td align="right" style="padding:10px 0 0;font-size:15px;font-weight:700;border-top:2px solid ${C.ink};">${price(order.total, order.locale)}</td></tr>
<tr><td colspan="2" style="padding:4px 0 0;font-size:12px;color:${C.muted};">${escapeHtml(dict.emails.vatLine)} ${price(order.vat, order.locale)}</td></tr>`;
}

function trackingUrl(order: Order): string {
  return `${brand.url}${href('tracking', order.locale)}?ref=${encodeURIComponent(order.ref)}`;
}

function button(url: string, label: string): string {
  return `<tr><td style="padding:22px 28px 0;">
<a href="${url}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:7px;font-size:14px;font-weight:600;">${escapeHtml(label)}</a>
</td></tr>`;
}

export function orderConfirmation(order: Order): { subject: string; html: string; text: string } {
  const dict = getDictionary(order.locale);
  const url = trackingUrl(order);
  const subject = interpolate(dict.emails.confirmSubject, { ref: order.ref });

  const inner = `<tr><td style="padding:16px 28px 4px;">
<div style="font-size:21px;font-weight:700;">${escapeHtml(dict.emails.confirmTitle)}</div>
<div style="font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">
${escapeHtml(dict.emails.confirmLead)}
${escapeHtml(dict.emails.reference)} <strong style="color:${C.ink};">${escapeHtml(order.ref)}</strong>.
</div></td></tr>
<tr><td style="padding:18px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lineRows(order)}${totalsRows(order)}</table>
</td></tr>
${button(url, dict.emails.trackCta)}
<tr><td style="padding:18px 28px 22px;font-size:13px;color:${C.muted};line-height:1.6;">
${escapeHtml(dict.emails.confirmFooter)}
</td></tr>`;

  const text = [
    `${dict.emails.confirmTitle} — ${order.ref}`,
    '',
    ...order.lines.map(
      (line) => `  ${line.quantity} x ${line.name}  ${price(line.lineTotal, order.locale)}`,
    ),
    '',
    `  ${dict.emails.subtotal}  ${price(order.subtotal, order.locale)}`,
    `  ${order.shippingLabel}  ${order.shippingPrice === 0 ? dict.emails.free : price(order.shippingPrice, order.locale)}`,
    `  ${dict.emails.total}  ${price(order.total, order.locale)} (${dict.emails.vatLine} ${price(order.vat, order.locale)})`,
    '',
    `${dict.emails.trackCta} : ${url}`,
    '',
    dict.emails.confirmFooter,
  ].join('\n');

  return { subject, html: layout(order, subject, inner), text };
}

export function shippingNotification(order: Order): { subject: string; html: string; text: string } {
  const dict = getDictionary(order.locale);
  const url = trackingUrl(order);
  const carrier = order.carrier ?? dict.emails.defaultCarrier;
  const subject = interpolate(dict.emails.shippedSubject, { ref: order.ref });
  const lead = interpolate(dict.emails.shippedLead, { ref: order.ref, carrier });

  const inner = `<tr><td style="padding:16px 28px 4px;">
<div style="font-size:21px;font-weight:700;">${escapeHtml(dict.emails.shippedTitle)}</div>
<div style="font-size:14px;color:${C.muted};margin-top:6px;line-height:1.6;">${escapeHtml(lead)}</div>
</td></tr>
${
  order.trackingNumber
    ? `<tr><td style="padding:16px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.line};border-radius:8px;">
<tr><td style="padding:14px 16px;">
<div style="font-size:12px;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(dict.emails.trackingNumber)}</div>
<div style="font-size:17px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:4px;">${escapeHtml(order.trackingNumber)}</div>
</td></tr></table></td></tr>`
    : ''
}
${button(url, dict.emails.trackParcelCta)}
<tr><td style="padding:18px 28px 22px;font-size:13px;color:${C.muted};line-height:1.6;">
${escapeHtml(dict.emails.shippedFooter)}
</td></tr>`;

  const text = [
    `${dict.emails.shippedTitle} — ${order.ref}`,
    '',
    order.trackingNumber
      ? `${dict.emails.trackingNumber} : ${order.trackingNumber} (${carrier})`
      : lead,
    '',
    `${dict.emails.trackParcelCta} : ${url}`,
    '',
    dict.emails.shippedFooter,
  ].join('\n');

  return { subject, html: layout(order, subject, inner), text };
}
