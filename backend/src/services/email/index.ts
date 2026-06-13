import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../../config/index.js';
import { BRANDING } from '../../config/branding.js';
import type { ISmtpSettings } from '../../models/index.js';
import { prisma } from '../../db/prisma.js';
import { orderConfirmationHtml, bookingConfirmationHtml } from './templates.js';

export interface SendResult {
  sent: boolean;
  previewUrl?: string;
  error?: string;
}

async function createEtherealTransporter(): Promise<Transporter> {
  const testAccount = await nodemailer.createTestAccount();
  console.log('Email: using Ethereal test inbox:', testAccount.user);
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

function createSmtpTransporter(smtp: { host: string; port: number; secure: boolean; user: string; pass: string }): Transporter {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

async function resolvePlatformMailConfig() {
  if (config.email.smtp.host && config.email.smtp.user && config.email.smtp.pass) {
    return {
      transport: createSmtpTransporter(config.email.smtp),
      from: config.email.from,
      source: 'env' as const,
    };
  }

  if (config.nodeEnv === 'development' && config.email.enabled) {
    return {
      transport: await createEtherealTransporter(),
      from: config.email.from,
      source: 'ethereal' as const,
    };
  }

  return null;
}

async function resolveMailConfig(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const smtp = tenant?.smtp as ISmtpSettings | null;

  if (smtp?.enabled && smtp.host && smtp.user && smtp.pass) {
    return {
      transport: createSmtpTransporter(smtp),
      from: smtp.from || config.email.from,
      source: 'tenant' as const,
    };
  }

  if (config.email.smtp.host && config.email.smtp.user && config.email.smtp.pass) {
    return {
      transport: createSmtpTransporter(config.email.smtp),
      from: config.email.from,
      source: 'env' as const,
    };
  }

  if (config.nodeEnv === 'development' && config.email.enabled) {
    return {
      transport: await createEtherealTransporter(),
      from: smtp?.from || config.email.from,
      source: 'ethereal' as const,
    };
  }

  return null;
}

async function deliverMail(
  mailConfig: { transport: Transporter; from: string; source: string },
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  try {
    const info = await mailConfig.transport.sendMail({
      from: mailConfig.from,
      to,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📧 Email preview (${mailConfig.source}): ${previewUrl}`);
      return { sent: true, previewUrl: String(previewUrl) };
    }

    console.log(`📧 Email sent (${mailConfig.source}) to ${to}`);
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    console.error('Email send failed:', message);
    return { sent: false, error: message };
  }
}

export async function sendPlatformMail(to: string, subject: string, html: string): Promise<SendResult> {
  const mailConfig = await resolvePlatformMailConfig();
  if (!mailConfig) {
    return { sent: false, error: 'Email not configured' };
  }
  return deliverMail(mailConfig, to, subject, html);
}

async function sendMail(tenantId: string, to: string, subject: string, html: string): Promise<SendResult> {
  const mailConfig = await resolveMailConfig(tenantId);
  if (!mailConfig) {
    return { sent: false, error: 'Email not configured. Add SMTP in Settings.' };
  }
  return deliverMail(mailConfig, to, subject, html);
}

export async function sendTestEmail(tenantId: string, to: string, parkName: string): Promise<SendResult> {
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;padding:32px;">
      <h2 style="color:#0c8ce9;">${BRANDING.appName} Email Test</h2>
      <p>SMTP is working for <strong>${parkName}</strong>.</p>
      <p style="color:#64748b;font-size:14px;">Customer order and booking confirmations will be sent from this account.</p>
    </div>`;
  return sendMail(tenantId, to, `${BRANDING.appName} SMTP Test — ${parkName}`, html);
}

export async function sendOrderConfirmation(params: {
  tenantId: string;
  to: string;
  parkName: string;
  customerName: string;
  orderNumber: string;
  orderDate: string;
  total: number;
  paymentMethod: string;
  tickets: { ticketTypeName: string; ticketCode: string; qrImage?: string }[];
}): Promise<SendResult> {
  const html = orderConfirmationHtml({
    parkName: params.parkName,
    customerName: params.customerName,
    orderNumber: params.orderNumber,
    orderDate: params.orderDate,
    total: `$${params.total.toFixed(2)}`,
    paymentMethod: params.paymentMethod,
    tickets: params.tickets,
  });

  return sendMail(
    params.tenantId,
    params.to,
    `Your tickets — ${params.orderNumber} | ${params.parkName}`,
    html
  );
}

export async function sendBookingConfirmation(params: {
  tenantId: string;
  to: string;
  parkName: string;
  customerName: string;
  bookingNumber: string;
  visitDate: string;
  ticketTypeName: string;
  quantity: number;
  total: number;
}): Promise<SendResult> {
  const html = bookingConfirmationHtml({
    parkName: params.parkName,
    customerName: params.customerName,
    bookingNumber: params.bookingNumber,
    visitDate: params.visitDate,
    ticketTypeName: params.ticketTypeName,
    quantity: params.quantity,
    total: `$${params.total.toFixed(2)}`,
  });

  return sendMail(
    params.tenantId,
    params.to,
    `Booking confirmed — ${params.bookingNumber} | ${params.parkName}`,
    html
  );
}
