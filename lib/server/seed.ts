import bcrypt from 'bcryptjs';
import { one, type Db } from './db';
import { createCategory, createItem, getMenu } from './menu';
import { placeOrder } from './orders';

const rs = (n: number) => n * 100;

type Dish = [name: string, description: string, veg: boolean, variants: [string, number][], available?: boolean];
const MENU: Record<string, Dish[]> = {
  'Nashta aur Chaat': [
    ['Pyaaz Kachori', 'Crisp flaky shell stuffed with spiced onion, served with tamarind chutney.', true, [['2 pcs', rs(70)]]],
    ['Mirchi Vada', 'Jodhpuri chilli fritters filled with spiced potato, fried golden.', true, [['2 pcs', rs(60)]]],
    ['Mawa Kachori', 'Jaisalmer-style sweet kachori in saffron sugar syrup.', true, [['1 pc', rs(80)]]],
  ],
  'Dal Baati aur Sabzi': [
    ['Dal Baati Churma', 'Ghee-soaked baked wheat baati, five-lentil panchmel dal and sweet churma.', true, [['Half', rs(180)], ['Full', rs(320)]]],
    ['Gatte ki Sabzi', 'Gram flour dumplings simmered in a tangy yoghurt gravy.', true, [['Half', rs(150)], ['Full', rs(260)]]],
    ['Ker Sangri', 'Desert beans and berries, slow cooked with dried red chilli.', true, [['Half', rs(190)], ['Full', rs(340)]]],
    ['Laal Maas', 'Fiery Mathania chilli mutton curry, the royal hunter’s classic.', false, [['Half', rs(320)], ['Full', rs(580)]]],
    ['Safed Maas', 'Mutton in a creamy cashew, almond and yoghurt gravy.', false, [['Half', rs(340)], ['Full', rs(600)]], false],
  ],
  'Roti aur Chawal': [
    ['Bajra Roti', 'Pearl millet flatbread, finished with white butter.', true, [['1 pc', rs(30)]]],
    ['Missi Roti', 'Gram flour and spice flatbread cooked on the tawa.', true, [['1 pc', rs(35)]]],
    ['Jeera Rice', 'Basmati tempered with cumin and ghee.', true, [['Half', rs(90)], ['Full', rs(150)]]],
  ],
  'Mithai': [
    ['Ghevar', 'Honeycomb disc of fried batter soaked in sugar syrup, topped with rabri.', true, [['1 pc', rs(120)]]],
    ['Malpua', 'Fennel-scented pancakes dunked in syrup, served with rabri.', true, [['2 pcs', rs(110)]]],
  ],
  'Peeyush': [
    ['Masala Chaas', 'Cooling buttermilk with roasted cumin and mint.', true, [['Glass', rs(40)]]],
    ['Kesar Lassi', 'Thick sweet lassi with saffron and pistachio.', true, [['Glass', rs(90)], ['Large', rs(140)]]],
    ['Rajasthani Masala Chai', 'Kadak chai brewed with ginger and cardamom.', true, [['Cup', rs(30)]]],
  ],
};

const count = async (db: Db, table: string) => (await one<{ c: number }>(db, `SELECT COUNT(*)::int AS c FROM ${table}`))!.c;

export async function ensureUsers(db: Db) {
  if (await count(db, 'users')) return;
  const ins = 'INSERT INTO users (email,password_hash,role) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING';
  await db.query(ins, ['admin@rasoi.test', bcrypt.hashSync(process.env.SEED_ADMIN_PASSWORD || 'admin123', 10), 'admin']);
  await db.query(ins, ['kitchen@rasoi.test', bcrypt.hashSync(process.env.SEED_KITCHEN_PASSWORD || 'kitchen123', 10), 'kitchen']);
}

export async function ensureMenu(db: Db) {
  if (await count(db, 'categories')) return;
  for (const [cat, dishes] of Object.entries(MENU)) {
    const { id } = await createCategory(db, cat);
    for (const [name, description, veg, variants, available] of dishes)
      await createItem(db, { categoryId: id, name, description, veg, available: available ?? true, variants: variants.map(([label, pricePaise]) => ({ label, pricePaise })) });
  }
}

/** A few orders at different stages, one of them "late", so the kitchen screen has something to show. */
export async function ensureDemoOrders(db: Db) {
  if (await count(db, 'orders')) return;
  const items = (await getMenu(db)).categories.flatMap((c) => c.items);
  const find = (name: string, label?: string) => {
    const it = items.find((i) => i.name === name)!;
    const v = label ? it.variants.find((x) => x.label === label)! : it.variants[0];
    return { itemId: it.id, variantId: v.id };
  };
  const min = 60_000;
  const now = Date.now();
  const demo: [number, string, Parameters<typeof placeOrder>[1]][] = [
    [34, 'served', { type: 'dine_in', tableNumber: 4, customerName: '', note: '', lines: [{ ...find('Dal Baati Churma', 'Full'), qty: 2 }, { ...find('Masala Chaas'), qty: 2 }] }],
    [21, 'preparing', { type: 'dine_in', tableNumber: 7, customerName: 'Meera', note: 'Less spicy please', lines: [{ ...find('Laal Maas', 'Half'), qty: 1 }, { ...find('Bajra Roti'), qty: 4 }] }],
    [9, 'ready', { type: 'takeaway', tableNumber: null, customerName: 'Arjun', note: '', lines: [{ ...find('Pyaaz Kachori'), qty: 2 }, { ...find('Kesar Lassi', 'Large'), qty: 1 }] }],
    [3, 'received', { type: 'dine_in', tableNumber: 2, customerName: '', note: '', lines: [{ ...find('Gatte ki Sabzi', 'Half'), qty: 1 }, { ...find('Missi Roti'), qty: 2 }, { ...find('Ghevar'), qty: 1 }] }],
  ];
  for (const [ago, status, input] of demo) {
    const o = await placeOrder(db, input, now - ago * min);
    await db.query('UPDATE orders SET status=$1 WHERE id=$2', [status, o.id]);
  }
}

export async function seedIfEmpty(db: Db) {
  await ensureUsers(db);
  await ensureMenu(db);
  await ensureDemoOrders(db);
}

export async function resetAndSeed(db: Db) {
  await db.exec('TRUNCATE order_items, orders, variants, items, categories, users, events, rate_hits RESTART IDENTITY CASCADE');
  await seedIfEmpty(db);
}
