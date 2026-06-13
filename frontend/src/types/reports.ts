export interface ReportPeriod {
  startDate: string;
  endDate: string;
}

export interface OverviewReport {
  period: ReportPeriod;
  revenue: { total: number; orders: number; discount: number; avgOrder: number };
  attendance: { bodyCount: number; denied: number; totalScans: number };
  tickets: { issued: number; valid: number; used: number; expired: number; cancelled: number };
  bookings: { total: number; revenue: number; byStatus: Record<string, { count: number; revenue: number }> };
  memberships: { active: number; newInPeriod: number };
  coupons: { ordersWithCoupon: number; discountTotal: number };
  topTicketTypes: { name: string; color: string; count: number }[];
}

export interface RevenueReport {
  period: { start: string; end: string };
  daily: { date: string; orders: number; revenue: number }[];
  byPayment: { method: string; count: number; revenue: number }[];
  bySource: { source: string; count: number; revenue: number }[];
}

export interface SalesReport {
  summary: { totalRevenue: number; totalOrders: number; totalDiscount: number; avgOrderValue: number };
  orders: {
    id: string; orderNumber: string; customerName?: string; customerEmail?: string;
    customerPhone?: string; ticketCount: number; paymentMethod?: string;
    createdByName?: string; total: number; createdAt: string;
  }[];
}

export interface ScanReport {
  summary: {
    bodyCount: number; ticketEntries: number; membershipEntries: number;
    denied: number; uniqueTickets: number;
  };
  byStaff: { staffId: string; staffName: string; granted: number; denied: number; total: number }[];
  logs: {
    id: string; scannedAt: string; result: string; ticketId: string | null;
    guestLabel: string; scannedByName: string; message: string;
  }[];
}

export interface TicketsReport {
  summary: { total: number; byStatus: { status: string; count: number }[] };
  byType: { name: string; color: string; count: number; price: number }[];
  tickets: {
    id: string; ticketId: string; ticketTypeName: string; orderNumber: string;
    customerName: string; status: string; scannedAt?: string; createdAt?: string;
  }[];
}

export interface BookingsReport {
  summary: { total: number; revenue: number; ticketQuantity: number };
  bookings: {
    id: string; bookingNumber: string; customerName: string; customerEmail: string;
    visitDate: string; ticketTypeName: string; quantity: number; total: number;
    status: string; createdAt: string;
  }[];
}

export interface MembershipsReport {
  summary: { active: number; newInPeriod: number; expiringIn30Days: number };
  byPlan: { planName: string; count: number }[];
  memberships: {
    id: string; memberName: string; memberCode: string; planName: string;
    startsAt: string; expiresAt: string; isActive: boolean;
  }[];
}

export interface CouponsReport {
  summary: { ordersWithCoupon: number; totalDiscount: number; activeCoupons: number; totalCoupons: number };
  usageInPeriod: { code: string; orders: number; discount: number; revenue: number }[];
  allCoupons: {
    id: string; code: string; discountType: string; discountValue: number;
    usedCount: number; maxUses?: number; isActive: boolean;
  }[];
}

export interface StaffReport {
  staff: {
    staffId: string; staffName: string; role: string; orders: number;
    revenue: number; discount: number; scansGranted: number; scansDenied: number;
  }[];
}

export interface AuditReport {
  summary: { total: number; byAction: { action: string; count: number }[] };
  logs: {
    id: string; action: string; userName: string | null; entityType: string;
    details: Record<string, unknown>; createdAt: string;
  }[];
}
