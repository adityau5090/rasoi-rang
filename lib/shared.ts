// Types and helpers shared by the server and the browser.
export const STATUSES = ['received', 'preparing', 'ready', 'served'] as const;
export type Status = (typeof STATUSES)[number];
export type OrderType = 'dine_in' | 'takeaway';

export const STATUS_LABEL: Record<Status, { en: string; hi: string; msg: string }> = {
  received: { en: 'Received', hi: 'प्राप्त', msg: 'Your order has reached the kitchen.' },
  preparing: { en: 'Preparing', hi: 'बन रहा है', msg: 'Our cooks are making it fresh for you.' },
  ready: { en: 'Ready', hi: 'तैयार', msg: 'Your food is ready!' },
  served: { en: 'Served', hi: 'परोसा गया', msg: 'Enjoy your meal. Dhanyavaad!' },
};

export type Variant = { id: number; label: string; pricePaise: number };
export type Item = {
  id: number; categoryId: number; name: string; description: string;
  veg: boolean; available: boolean; variants: Variant[];
};
export type Category = { id: number; name: string; items: Item[] };
export type Menu = { categories: Category[] };

export type OrderItem = { name: string; variantLabel: string; unitPricePaise: number; qty: number };
export type Order = {
  id: number; token: string; number: number; type: OrderType; tableNumber: number | null;
  customerName: string; note: string; status: Status; totalPaise: number;
  createdAt: number; updatedAt: number; items: OrderItem[];
};
export type Stats = {
  day: string; revenuePaise: number; orderCount: number; avgPaise: number;
  byStatus: Record<Status, number>; orders: Order[];
};
export type Me = { id: number; email: string; role: 'admin' | 'kitchen' };

export const inr = (paise: number) =>
  '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 });

/** Size labels worth showing to people (Half, Full, Large) vs. plain unit labels (1 pc, Glass). */
export const showLabel = (label: string) => !/(^\d+ pcs?$)|^(glass|cup|regular)$/i.test(label);
