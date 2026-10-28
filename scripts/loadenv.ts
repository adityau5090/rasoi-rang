import fs from 'node:fs';
import path from 'node:path';

/** Loads .env.local then .env into process.env (existing variables win). Works on every Node version. Returns a status line. */
export function loadEnv(): string {
  const lines: string[] = [];
  for (const name of ['.env.local', '.env']) {
    const file = path.resolve(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    let n = 0;
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || raw.trim().startsWith('#')) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (v !== '' && process.env[m[1]] === undefined) { process.env[m[1]] = v; n++; }
    }
    lines.push(`Loaded ${name} (${n} settings with values)`);
  }
  if (!lines.length) {
    const near = fs.readdirSync(process.cwd()).filter((f) => f.startsWith('.env'));
    lines.push(`No .env.local found in ${process.cwd()}.` + (near.length ? ` Files starting with ".env" here: ${near.join(', ')}` : ' No .env* files at all here.'));
  }
  return lines.join('\n');
}
