import nodemailer from 'nodemailer';
import { createHash, randomUUID } from 'node:crypto';
import sql from 'mssql';
import { getPool } from '../../db/connection.js';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

function loadConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;
  if (!host || !user || !pass || !from) return null;
  return { host, port, user, pass, from, fromName: process.env.EMAIL_FROM_NAME || 'NutriClínica' };
}

async function getTransporter(config: EmailConfig): Promise<nodemailer.Transporter> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
  await transporter.verify();
  return transporter;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = loadConfig();
  if (!config) {
    console.log(`[email] SMTP no configurado. Simulando envío a ${input.to}: ${input.subject}`);
    return { success: true, messageId: `simulated-${randomUUID()}` };
  }

  try {
    const transporter = await getTransporter(config);
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.from}>`,
      to: input.to,
      subject: input.subject,
      text: input.text ?? '',
      html: input.html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Error desconocido al enviar email';
    console.error(`[email] Error enviando a ${input.to}:`, error);
    return { success: false, error };
  }
}

export async function logEmailSent(input: {
  pacienteId: string;
  tipo: string;
  destinatario: string;
  asunto: string;
  contenidoHtml: string;
  messageId?: string;
  error?: string | null;
}): Promise<void> {
  const pool = await getPool();
  const id = randomUUID();
  const contentHash = createHash('sha256').update(input.contenidoHtml, 'utf8').digest('hex');
  await pool
    .request()
    .input('id', sql.UniqueIdentifier(), id)
    .input('paciente_id', sql.UniqueIdentifier(), input.pacienteId)
    .input('tipo', sql.NVarChar(40), input.tipo)
    .input('destinatario', sql.NVarChar(200), input.destinatario)
    .input('asunto', sql.NVarChar(200), input.asunto)
    .input('contenido_hash', sql.NVarChar(64), contentHash)
    .input('message_id', sql.NVarChar(200), input.messageId ?? null)
    .input('error', sql.NVarChar(500), input.error ?? null)
    .query(
      `INSERT INTO notificaciones_email
         (id, paciente_id, tipo, destinatario, asunto, contenido_hash, message_id, error)
       VALUES
         (@id, @paciente_id, @tipo, @destinatario, @asunto, @contenido_hash, @message_id, @error)`,
    );
}

export function renderTemplate(templateName: string, variables: Record<string, string>): string {
  const templates: Record<string, string> = {
    appointment_reminder: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;">
<h2 style="color:#2563eb;">NutriClínica — Recordatorio de cita</h2>
<p>Hola <strong>{{patientName}}</strong>,</p>
<p>Te recordamos que tienes una cita próxima con tu nutrióloga:</p>
<table style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;">
<tr><td style="padding:4px 8px;color:#64748b;">Fecha:</td><td style="font-weight:600;">{{appointmentDate}}</td></tr>
<tr><td style="padding:4px 8px;color:#64748b;">Motivo:</td><td style="font-weight:600;">{{appointmentReason}}</td></tr>
</table>
<p style="color:#64748b;font-size:14px;">Si no puedes asistir, por favor contacta a tu nutrióloga para reagendar.</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
<p style="color:#94a3b8;font-size:12px;">NutriClínica — Portal del Paciente</p>
</div>`,

    adherence_confirmation: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;">
<h2 style="color:#16a34a;">NutriClínica — Registro de adherencia recibido</h2>
<p>Hola <strong>{{patientName}}</strong>,</p>
<p>Hemos recibido tu registro de adherencia del <strong>{{recordDate}}</strong>.</p>
<table style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;">
<tr><td style="padding:4px 8px;color:#64748b;">Plan de alimentación:</td><td style="font-weight:600;">{{adherenceMenu}}%</td></tr>
<tr><td style="padding:4px 8px;color:#64748b;">Agua:</td><td style="font-weight:600;">{{adherenceWater}}%</td></tr>
<tr><td style="padding:4px 8px;color:#64748b;">Actividad física:</td><td style="font-weight:600;">{{adherenceActivity}}%</td></tr>
<tr><td style="padding:4px 8px;color:#64748b;">Suplementos:</td><td style="font-weight:600;">{{adherenceSupplements}}%</td></tr>
<tr><td style="padding:4px 8px;color:#64748b;">Sueño:</td><td style="font-weight:600;">{{adherenceSleep}}%</td></tr>
</table>
<p style="color:#64748b;font-size:14px;">Tu nutrióloga revisará esta información en tu próxima consulta.</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
<p style="color:#94a3b8;font-size:12px;">NutriClínica — Portal del Paciente</p>
</div>`,
  };

  let html = templates[templateName] ?? `<p>Notificación de NutriClínica</p>`;
  for (const [key, value] of Object.entries(variables)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), escapeHtml(value));
  }
  return html;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
