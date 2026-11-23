import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';

const REPO = process.env.GITHUB_REPOSITORY || 'vibe-webos/repo';
const [owner, name] = REPO.split('/');
const RAW = `https://${owner}.github.io/${name}`;
const cmp = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Страница описания: чистый HTML + CSS, без JS и без CSS-переменных (совместимо со старым Chromium 38 / webOS 3.x).
const css = accent => `
*{-webkit-box-sizing:border-box;box-sizing:border-box}
html,body{margin:0;background:#0d1017;color:#e9ecf3;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.4}
.wrap{padding:16px 20px}
h1{margin:0;font-size:28px;line-height:1.15}
.tag{margin:3px 0 10px;color:#9aa3b5;font-size:16px}
p{margin:0 0 10px}
.notice{border-left:4px solid ${accent};background:#171b26;border-radius:8px;padding:8px 12px;margin:10px 0}
.notice b{display:block;color:${accent};margin-bottom:2px}
.chips{margin:0 0 4px;padding:0;list-style:none}
.chips li{display:inline-block;background:#1a1f2c;border-radius:14px;padding:3px 11px;margin:0 6px 6px 0;font-size:14px;color:#cfd5e3}
h2{margin:10px 0 8px;font-size:18px}
.row{font-size:0;white-space:nowrap}
.row img{display:inline-block;vertical-align:top;height:auto;border-radius:8px;background:#06080c}
`;

function page(a, shots) {
  const about = (a.about || [a.description]).map(p => `<p>${esc(p)}</p>`).join('');
  const chips = (a.features || []).length
    ? `<ul class="chips">${a.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
  const notice = a.notice
    ? `<div class="notice"><b>${esc(a.notice.title)}</b>${esc(a.notice.text)}</div>` : '';
  const n = shots.length;
  const w = n ? Math.floor((100 - (n - 1)) / n) : 100;
  const imgs = shots.map((f, i) =>
    `<img src="${RAW}/screenshots/${a.id}/${encodeURIComponent(f)}" alt="" style="width:${w}%;margin-right:${i < n - 1 ? 1 : 0}%">`).join('');
  const shotsBlock = n ? `<h2>Скриншоты</h2><div class="row">${imgs}</div>` : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.title)}</title>
<style>${css(a.accent || '#a45cf5')}</style></head>
<body><div class="wrap">
<h1>${esc(a.title)}</h1>
<div class="tag">${esc(a.tagline || a.description)}</div>
${about}${chips}${notice}${shotsBlock}
</div></body></html>
`;
}

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
    ? readdirSync(shotDir).filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f)).sort(cmp)
    : [];
  writeFileSync(`descriptions/${a.id}.html`, page(a, shots));
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
