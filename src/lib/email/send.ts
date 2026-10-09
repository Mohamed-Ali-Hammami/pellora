/**
 * Transport e-mail.
 *
 * Resend si configure, sinon journalisation en console. Le repli n’est pas une
 * commodité : il permet de dérouler tout le tunnel d’achat en développement
 * sans envoyer de vrais messages a de vraies adresses.
 */

import { Resend } from 'resend';
import { brand } from '../brand';

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

let client: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export interface RawEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  bcc?: string;
  replyTo?: string;
}

export async function sendRawEmail(email: RawEmail): Promise<SendResult> {
  const resend = getClient();

  if (!resend) {
    console.warn(
      `[e-mail:simulation] RESEND_API_KEY absente — message NON envoyé.\n` +
        `  à       : ${email.to}\n` +
        `  objet   : ${email.subject}\n` +
        `  ${email.text.split('\n').join('\n  ')}`,
    );
    return { ok: true, id: null };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: brand.email.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
      ...(email.bcc ? { bcc: email.bcc } : {}),
      replyTo: email.replyTo ?? brand.email.support,
    });

    if (error) {
      return { ok: false, error: `${error.name}: ${error.message}` };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Alerte interne : échec de transmission, anomalie de paiement. */
export async function alertOps(subject: string, détail: string): Promise<void> {
  const to = process.env.OPS_ALERT_EMAIL;
  if (!to) {
    console.error(`[alerte] ${subject}\n${détail}`);
    return;
  }
  await sendRawEmail({ to, subject: `[${brand.name}] ${subject}`, text: détail });
}
