interface TicketLine {
  ticketTypeName: string;
  ticketCode: string;
  qrImage?: string;
}

export function orderConfirmationHtml(params: {
  parkName: string;
  customerName: string;
  orderNumber: string;
  orderDate: string;
  total: string;
  paymentMethod: string;
  tickets: TicketLine[];
}) {
  const ticketRows = params.tickets.map((t) => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;">${t.ticketTypeName}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-family:monospace;" title="Ticket ID">${t.ticketCode}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;text-align:center;">
        ${t.qrImage ? `<img src="${t.qrImage}" alt="QR" width="100" height="100" />` : ''}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
        <tr><td style="background:#0c8ce9;padding:28px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">Your tickets are ready!</h1>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">${params.parkName}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hi ${params.customerName},</p>
          <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
            Thank you for your purchase. Show the QR codes below at the gate on <strong>${params.orderDate}</strong>.
          </p>
          <table width="100%" style="background:#f8fafc;border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;">Order</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0f172a;">${params.orderNumber}</p>
            </td>
            <td style="padding:16px 20px;text-align:right;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;">Total</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#0c8ce9;">${params.total}</p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr style="background:#f1f5f9;">
              <th style="padding:12px;text-align:left;font-size:12px;color:#64748b;">Ticket</th>
              <th style="padding:12px;text-align:left;font-size:12px;color:#64748b;">Code</th>
              <th style="padding:12px;text-align:center;font-size:12px;color:#64748b;">QR</th>
            </tr>
            ${ticketRows}
          </table>
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">Paid via ${params.paymentMethod}. Keep this email for your records.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function bookingConfirmationHtml(params: {
  parkName: string;
  customerName: string;
  bookingNumber: string;
  visitDate: string;
  ticketTypeName: string;
  quantity: number;
  total: string;
}) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
        <tr><td style="background:#0c8ce9;padding:28px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">Booking Confirmed</h1>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:14px;">${params.parkName}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hi ${params.customerName},</p>
          <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
            Your visit is confirmed. We look forward to seeing you!
          </p>
          <table width="100%" style="background:#f8fafc;border-radius:12px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 8px;"><span style="color:#94a3b8;font-size:12px;">BOOKING #</span><br><strong style="font-size:16px;">${params.bookingNumber}</strong></p>
              <p style="margin:16px 0 8px;"><span style="color:#94a3b8;font-size:12px;">VISIT DATE</span><br><strong>${params.visitDate}</strong></p>
              <p style="margin:16px 0 8px;"><span style="color:#94a3b8;font-size:12px;">TICKETS</span><br><strong>${params.quantity}x ${params.ticketTypeName}</strong></p>
              <p style="margin:16px 0 0;"><span style="color:#94a3b8;font-size:12px;">TOTAL</span><br><strong style="color:#0c8ce9;font-size:18px;">${params.total}</strong></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
