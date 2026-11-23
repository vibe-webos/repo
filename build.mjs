import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';

const REPO = process.env.GITHUB_REPOSITORY || 'USER/REPO';
const BRANCH = process.env.GITHUB_REF_NAME || 'main';
const [owner, name] = REPO.split('/');
const RAW = `https://${owner}.github.io/${name}`;
const cmp = (a, b) => a.localeCompare(b, undefined, { numeric: true });

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
mkdirSync('descriptions', { recursive: true });

const files = readdirSync('ipk').filter(f => f.endsWith('.ipk'));
const apps = JSON.parse(readFileSync('apps.json', 'utf8'));

const packages = apps.map(a => {
  const f = files.filter(f => f.startsWith(a.id + '_')).sort(cmp).pop();
  if (!f) throw new Error(`No ipk for ${a.id}`);
  const version = f.slice(a.id.length + 1).replace(/_[^_]+\.ipk$/, '');
  const buf = readFileSync(`ipk/${f}`);
  const iconUri = `${RAW}/${a.icon}`;
  const shotDir = `screenshots/${a.id}`;
  const shots = existsSync(shotDir)
    ? readdirSync(shotDir).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort(cmp)
    : [];
  const text = a.longDescription || a.description;
  const paras = text.split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
  const imgs = shots.map(f => `<img src="${RAW}/${shotDir}/${encodeURIComponent(f)}" alt="${esc(f)}">`).join('\n');
  writeFileSync(`descriptions/${a.id}.html`, `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:sans-serif;margin:0;padding:8px;line-height:1.5}img{max-width:100%;height:auto;display:block;margin:12px 0;border-radius:8px}</style>
</head><body>
<h2>${esc(a.title)}</h2>
${paras}
${imgs}
</body></html>
`);
  return {
    id: a.id,
    title: a.title,
    iconUri,
    shortDescription: a.description,
    fullDescriptionUrl: `${RAW}/descriptions/${a.id}.html`,
    category: a.category || 'other',
    manifest: {
      id: a.id,
      version,
      type: a.type || 'web',
      title: a.title,
      appDescription: a.description,
      iconUri,
      sourceUrl: a.sourceUrl,
      rootRequired: a.rootRequired ?? false,
      ipkUrl: `${RAW}/ipk/${f}`,
      ipkSize: statSync(`ipk/${f}`).size,
      ipkHash: { sha256: createHash('sha256').update(buf).digest('hex') },
    },
  };
});

writeFileSync('repo.json', JSON.stringify({
  paging: { page: 1, count: packages.length, maxPage: 1, itemsTotal: packages.length },
  packages,
}, null, 2));
console.log(`repo.json: ${packages.length} packages`);
