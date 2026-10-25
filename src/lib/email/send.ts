/**
 * Transport e-mail — SMTP simple.
 *
 * Un serveur SMTP, des identifiants, rien d'autre. Pas de prestataire, pas de
 * clé d'API, pas de webhook de retour : les trois e-mails que ce site envoie
 * (instructions de virement, confirmation, expédition) tiennent dans un
 * `sendMail`, et un compte Gmail suffit à les acheminer.
 *
 * Sans configuration, les messages sont ÉCRITS DANS LA CONSOLE au lieu de
 * partir. Ce n'est pas une commodité : c'est ce qui permet de dérouler le
 * tunnel d'achat entier en développement, de relire l'e-mail client avec son
 * RIB, sans écrire à de vraies adresses.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { brand } from '../brand';

// Ce module parle à un serveur SMTP avec un mot de passe : il ne doit jamais
// se retrouver dans un bundle navigateur.
if (typeof window !== 'undefined') {
  throw new Error('src/lib/email/send.ts est un module serveur.');
}

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

export interface SmtpConfig {
  host: string;
  port: number;
  /** TLS dès la connexion (port 465) plutôt que STARTTLS (port 587). */
  secure: boolean;
  user: string;
  password: string;
}

/**
 * Configuration SMTP lue dans l'environnement.
 *
 * `null` si l'hôte ou les identifiants manquent — et c'est bien un refus
 * global : un transport à moitié configuré échouerait à chaque envoi, ce qui
 * est plus difficile à diagnostiquer qu'un repli console assumé.
 *
 * Pour Gmail : hôte `smtp.gmail.com`, port 465, et un MOT DE PASSE
 * D'APPLICATION (pas le mot de passe du compte, que Google refuse en SMTP).
 */
export function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password) return null;

  // Le port décide du mode TLS par défaut, parce que c'est la source d'erreur
  // la plus fréquente : 465 est chiffré d'emblée, 587 commence en clair puis
  // négocie STARTTLS. `SMTP_SECURE` permet de forcer, pour un serveur exotique.
  const port = Number(process.env.SMTP_PORT ?? 465);
  const forcé = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = forcé ? forcé === 'true' : port === 465;

  return { host, port: Number.isFinite(port) ? port : 465, secure, user, password };
}

export function isEmailConfigured(): boolean {
  return smtpConfig() !== null;
}

let transport: Transporter | null = null;
let empreinte = '';

function getTransport(): Transporter | null {
  const config = smtpConfig();
  if (!config) return null;

  // Le transport est mis en cache — il garde la connexion ouverte — mais
  // recréé si la configuration change, sinon un changement de mot de passe
  // resterait sans effet jusqu'au redémarrage.
  const clef = `${config.host}:${config.port}:${config.secure}:${config.user}`;
  if (transport && empreinte === clef) return transport;

  transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });
  empreinte = clef;
  return transport;
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
  const transporter = getTransport();

  if (!transporter) {
    console.warn(
      `[e-mail:simulation] SMTP non configuré — message NON envoyé.\n` +
        `  à       : ${email.to}\n` +
        `  objet   : ${email.subject}\n` +
        `  ${email.text.split('\n').join('\n  ')}`,
    );
    return { ok: true, id: null };
  }

  try {
    const info = await transporter.sendMail({
      from: brand.email.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
      ...(email.bcc ? { bcc: email.bcc } : {}),
      replyTo: email.replyTo ?? brand.email.support,
    });
    return { ok: true, id: info.messageId ?? null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Alerte interne : nouvelle commande, virement déclaré par le client. */
export async function alertOps(subject: string, detail: string): Promise<void> {
  const to = process.env.OPS_ALERT_EMAIL;
  if (!to) {
    console.error(`[alerte] ${subject}\n${detail}`);
    return;
  }
  await sendRawEmail({ to, subject: `[${brand.name}] ${subject}`, text: detail });
}
