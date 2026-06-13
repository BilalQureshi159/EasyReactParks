type PopulatedScanLog = {
  id: string;
  result: string;
  message?: string | null;
  scannedAt: Date;
  scannedBy?: { firstName: string; lastName: string } | null;
  ticket?: {
    ticketCode: string;
    ticketType?: { name: string } | null;
  } | null;
  membership?: {
    memberName: string;
    memberCode: string;
  } | null;
};

export function mapScanLogEntry(log: PopulatedScanLog) {
  const staff = log.scannedBy;
  const ticket = log.ticket;
  const membership = log.membership;

  let entryType: 'ticket' | 'membership' | 'unknown' = 'unknown';
  let guestLabel = '—';
  let ticketId: string | null = null;
  let ticketTypeName: string | null = null;

  if (ticket) {
    entryType = 'ticket';
    ticketId = ticket.ticketCode;
    ticketTypeName = ticket.ticketType?.name ?? 'Ticket';
    guestLabel = ticketTypeName;
  } else if (membership) {
    entryType = 'membership';
    guestLabel = membership.memberName;
    ticketId = membership.memberCode;
    ticketTypeName = 'Membership';
  }

  return {
    id: log.id,
    scannedAt: log.scannedAt,
    result: log.result,
    message: log.message ?? '',
    entryType,
    guestLabel,
    ticketId,
    ticketTypeName,
    scannedByName: staff ? `${staff.firstName} ${staff.lastName}` : 'Unknown',
  };
}
