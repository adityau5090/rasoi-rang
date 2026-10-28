import { one, type Db } from './db';
import { AppError } from './errors';
import { publishMenu } from './events';
import type { Category, Item, Menu } from '../shared';
import type { ItemInput, ItemPatch } from './validation';

export async function getMenu(db: Db): Promise<Menu> {
  const [cats, items, variants] = await Promise.all([
    db.query<{ id: number; name: string }>('SELECT id, name FROM categories ORDER BY sort, id'),
    db.query<Omit<Item, 'variants'>>('SELECT id, category_id AS "categoryId", name, description, veg, available FROM items ORDER BY sort, id'),
    db.query<{ id: number; itemId: number; label: string; pricePaise: number }>('SELECT id, item_id AS "itemId", label, price_paise AS "pricePaise" FROM variants ORDER BY sort, id'),
  ]);
  const byItem = new Map<number, Item>();
  for (const i of items) byItem.set(i.id, { ...i, variants: [] });
  for (const v of variants) byItem.get(v.itemId)?.variants.push({ id: v.id, label: v.label, pricePaise: v.pricePaise });
  const out: Category[] = cats.map((c) => ({ ...c, items: [] }));
  const catMap = new Map(out.map((c) => [c.id, c]));
  for (const i of byItem.values()) catMap.get(i.categoryId)?.items.push(i);
  return { categories: out };
}

export async function createCategory(db: Db, name: string) {
  const r = await db.query<{ id: number }>(
    'INSERT INTO categories (name, sort) VALUES ($1, (SELECT COALESCE(MAX(sort),0)+1 FROM categories)) RETURNING id', [name]);
  await publishMenu(db);
  return { id: r[0].id, name };
}
export async function renameCategory(db: Db, id: number, name: string) {
  const r = await db.query('UPDATE categories SET name=$1 WHERE id=$2 RETURNING id', [name, id]);
  if (!r.length) throw new AppError(404, 'Category not found');
  await publishMenu(db);
  return { id, name };
}
export async function deleteCategory(db: Db, id: number) {
  const r = await db.query('DELETE FROM categories WHERE id=$1 RETURNING id', [id]);
  if (!r.length) throw new AppError(404, 'Category not found');
  await publishMenu(db);
  return { ok: true };
}

async function assertCategory(db: Db, id: number) {
  if (!(await one(db, 'SELECT 1 FROM categories WHERE id=$1', [id])))
    throw new AppError(400, 'That category no longer exists', { fields: { categoryId: 'Choose a category' } });
}

export async function createItem(db: Db, input: ItemInput): Promise<number> {
  await assertCategory(db, input.categoryId);
  const id = await db.tx(async (t) => {
    const r = await t.query<{ id: number }>(
      `INSERT INTO items (category_id,name,description,veg,available,sort)
       VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(sort),0)+1 FROM items)) RETURNING id`,
      [input.categoryId, input.name, input.description, input.veg, input.available]);
    for (const [i, v] of input.variants.entries())
      await t.query('INSERT INTO variants (item_id,label,price_paise,sort) VALUES ($1,$2,$3,$4)', [r[0].id, v.label, v.pricePaise, i]);
    return r[0].id;
  });
  await publishMenu(db);
  return id;
}

/** Partial update. Variants are diffed by id so existing carts keep pointing at valid variants. */
export async function updateItem(db: Db, id: number, patch: ItemPatch) {
  if (!(await one(db, 'SELECT 1 FROM items WHERE id=$1', [id]))) throw new AppError(404, 'Dish not found');
  if (patch.categoryId !== undefined) await assertCategory(db, patch.categoryId);
  await db.tx(async (t) => {
    const cols: string[] = [];
    const vals: unknown[] = [];
    const set = (c: string, v: unknown) => { vals.push(v); cols.push(`${c}=$${vals.length}`); };
    if (patch.categoryId !== undefined) set('category_id', patch.categoryId);
    if (patch.name !== undefined) set('name', patch.name);
    if (patch.description !== undefined) set('description', patch.description);
    if (patch.veg !== undefined) set('veg', patch.veg);
    if (patch.available !== undefined) set('available', patch.available);
    if (cols.length) await t.query(`UPDATE items SET ${cols.join(',')} WHERE id=$${vals.length + 1}`, [...vals, id]);

    if (patch.variants) {
      const existing = new Set((await t.query<{ id: number }>('SELECT id FROM variants WHERE item_id=$1', [id])).map((r) => r.id));
      const keep = new Set<number>();
      for (const [i, v] of patch.variants.entries()) {
        if (v.id !== undefined) {
          if (!existing.has(v.id)) throw new AppError(400, 'A size does not belong to this dish');
          await t.query('UPDATE variants SET label=$1, price_paise=$2, sort=$3 WHERE id=$4', [v.label, v.pricePaise, i, v.id]);
          keep.add(v.id);
        } else {
          const r = await t.query<{ id: number }>('INSERT INTO variants (item_id,label,price_paise,sort) VALUES ($1,$2,$3,$4) RETURNING id', [id, v.label, v.pricePaise, i]);
          keep.add(r[0].id);
        }
      }
      for (const vid of existing) if (!keep.has(vid)) await t.query('DELETE FROM variants WHERE id=$1', [vid]);
    }
  });
  await publishMenu(db);
  return { ok: true };
}

export async function deleteItem(db: Db, id: number) {
  const r = await db.query('DELETE FROM items WHERE id=$1 RETURNING id', [id]);
  if (!r.length) throw new AppError(404, 'Dish not found');
  await publishMenu(db);
  return { ok: true };
}
