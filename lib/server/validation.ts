import { z } from 'zod';
import { STATUSES } from '../shared';

const maxTables = () => Number(process.env.MAX_TABLES) || 30;

export const cartLineSchema = z.object({
  itemId: z.number().int().positive(),
  variantId: z.number().int().positive(),
  qty: z.number({ invalid_type_error: 'Quantity must be a number' }).int().min(1, 'Quantity must be at least 1').max(20, 'You can order at most 20 of one dish'),
});

// NOTE: there is deliberately no price field. Unknown keys (e.g. a tampered "price") are dropped.
export const orderSchema = z
  .object({
    type: z.enum(['dine_in', 'takeaway'], { errorMap: () => ({ message: 'Choose dine-in or takeaway' }) }),
    tableNumber: z.number({ invalid_type_error: 'Table number must be a number' }).int('Table number must be a whole number').min(1, 'Table number must be 1 or more').nullish(),
    customerName: z.string().trim().max(60, 'Name is too long (max 60 characters)').default(''),
    note: z.string().trim().max(200, 'Note is too long (max 200 characters)').default(''),
    lines: z.array(cartLineSchema).min(1, 'Your cart is empty').max(30, 'Too many different dishes in one order'),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'dine_in') {
      if (v.tableNumber == null) ctx.addIssue({ code: 'custom', path: ['tableNumber'], message: 'Enter your table number' });
      else if (v.tableNumber > maxTables())
        ctx.addIssue({ code: 'custom', path: ['tableNumber'], message: `We only have tables 1 to ${maxTables()}` });
    } else if (!v.customerName) {
      ctx.addIssue({ code: 'custom', path: ['customerName'], message: 'Enter a name so we can call you for pickup' });
    }
  });
export type OrderInput = z.infer<typeof orderSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(50, 'Category name is too long'),
});

const variantSchema = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().trim().min(1, 'Size name is required (e.g. Half, Full)').max(30, 'Size name is too long'),
  pricePaise: z.number({ invalid_type_error: 'Enter a price' }).int('Price is invalid').min(100, 'Minimum price is ₹1').max(1_000_000, 'Maximum price is ₹10,000'),
});

const itemBase = z.object({
  categoryId: z.number().int().positive('Choose a category'),
  name: z.string().trim().min(1, 'Dish name is required').max(80, 'Dish name is too long (max 80)'),
  description: z.string().trim().max(300, 'Description is too long (max 300)').default(''),
  veg: z.boolean().default(true),
  available: z.boolean().default(true),
  variants: z.array(variantSchema).min(1, 'Add at least one size and price').max(4, 'At most 4 sizes per dish'),
});

const uniqueLabels = (v: { variants?: { label: string }[] }, ctx: z.RefinementCtx) => {
  if (!v.variants) return;
  const seen = new Set<string>();
  for (const x of v.variants) {
    const k = x.label.toLowerCase();
    if (seen.has(k)) ctx.addIssue({ code: 'custom', path: ['variants'], message: `Size "${x.label}" is listed twice` });
    seen.add(k);
  }
};
export const itemSchema = itemBase.superRefine(uniqueLabels);
export const itemPatchSchema = itemBase.partial().superRefine(uniqueLabels);
export type ItemInput = z.infer<typeof itemSchema>;
export type ItemPatch = z.infer<typeof itemPatchSchema>;

export const statusSchema = z.object({ status: z.enum(STATUSES, { errorMap: () => ({ message: 'Unknown status' }) }) });
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password').max(200),
});

// A customer's order history lives in their own browser as a list of private order tokens.
export const tokensSchema = z.object({
  tokens: z.array(z.string().min(10).max(64)).min(1, 'No orders to look up').max(20, 'Too many orders requested'),
});
