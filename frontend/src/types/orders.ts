export interface OrderListItem {
  id: string;
  orderNumber: string;
  orderDate: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  paymentMethod?: string;
  source: string;
  ticketCount: number;
  createdByName?: string | null;
  createdAt: string;
}

export interface OrderLineItem {
  ticketTypeId: string;
  ticketTypeName: string;
  price: number;
  color: string;
  quantity: number;
}

export interface OrderTicketItem {
  id: string;
  ticketCode: string;
  ticketTypeName: string;
  ticketTypeColor: string;
  status: string;
  validFrom: string;
  validUntil?: string;
  scannedAt?: string;
}

export interface OrderDetail {
  order: OrderListItem & {
    couponCode?: string | null;
    updatedAt: string;
  };
  lineItems: OrderLineItem[];
  tickets: OrderTicketItem[];
}

export interface OrdersListResponse {
  date: string | null;
  total: number;
  summary: { totalRevenue: number; totalOrders: number; totalDiscount: number };
  orders: OrderListItem[];
}
