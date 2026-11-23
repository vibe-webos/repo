import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';

const REPO = process.env.GITHUB_REPOSITORY || 'vibe-webos/repo';
const [owner, name] = REPO.split('/');
const RAW = `https://${owner}.github.io/${name}`;
const cmp = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;background:#0d1017;color:#e9ecf3;font:16px/1.45 -apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.wrap{display:flex;flex-wrap:wrap;padding:20px 14px 24px}
.col{flex:1 1 340px;min-width:0;padding:0 10px;margin-bottom:12px}
.col.shots{flex:1.25 1 380px}
h1{margin:0;font-size:30px;line-height:1.15}
.tag{margin:4px 0 14px;color:#9aa3b5;font-size:17px}
p{margin:0 0 12px}
.notice{border-left:4px solid var(--a);background:#171b26;border-radius:8px;padding:10px 14px;margin:14px 0}
.notice b{display:block;color:var(--a);margin-bottom:3px}
.chips{margin:0 0 6px;padding:0;list-style:none}
.chips li{display:inline-block;background:#1a1f2c;border-radius:16px;padding:4px 12px;margin:0 6px 8px 0;font-size:14px;color:#cfd5e3}
.links{margin-top:10px}
.links a{display:inline-block;background:var(--a);color:#fff;text-decoration:none;font-weight:600;border-radius:10px;padding:9px 16px;margin:0 8px 8px 0}
.links a:focus{outline:3px solid #fff}
.hint{color:#7c8599;font-size:13px;margin-top:2px;word-break:break-all}
h2{margin:0 0 10px;font-size:19px}
.stage{position:relative;background:#06080c;border-radius:12px;overflow:hidden;text-align:center}
.stage img{display:block;max-width:100%;margin:0 auto;height:auto}
.js .stage img{max-height:56vh;width:auto}
.js .slide{display:none}
.js .slide.on{display:block}
.nav{display:none}
.js .nav{display:block;position:absolute;top:50%;margin-top:-26px;width:52px;height:52px;border:0;border-radius:26px;background:rgba(0,0,0,.6);color:#fff;font-size:28px;line-height:52px;padding:0;cursor:pointer}
.js .nav:focus{outline:3px solid var(--a)}
.nav.prev{left:10px}.nav.next{right:10px}
.bar{display:none}
.js .bar{display:block;margin-top:10px}
.cnt{color:#9aa3b5;font-size:14px;margin-bottom:8px}
.thumbs img{height:56px;width:auto;border-radius:6px;margin:0 8px 8px 0;border:3px solid transparent;opacity:.6;cursor:pointer;vertical-align:top}
.thumbs img.on{border-color:var(--a);opacity:1}
`;

const JS = `
(function(){
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  if(!slides.length)return;
  var thumbs=[].slice.call(document.querySelectorAll('.thumbs img'));
  var cnt=document.getElementById('cnt');
  var i=0;
  document.documentElement.className+=' js';
  function show(n){
    i=(n+slides.length)%slides.length;
    for(var k=0;k<slides.length;k++){
      slides[k].className=slides[k].className.replace(' on','')+(k===i?' on':'');
      if(thumbs[k])thumbs[k].className=k===i?'on':'';
    }
    if(cnt)cnt.textContent=(i+1)+' / '+slides.length;
  }
  document.getElementById('prev').onclick=function(){show(i-1)};
  document.getElementById('next').onclick=function(){show(i+1)};
  for(var t=0;t<thumbs.length;t++){(function(n){thumbs[n].onclick=function(){show(n)}})(t)}
  for(var s=0;s<slides.length;s++){slides[s].onclick=function(){show(i+1)}}
  document.onkeydown=function(e){
    if(e.keyCode===37){show(i-1)}
    else if(e.keyCode===39){show(i+1)}
  };
  show(0);
})();
`;

function page(a, shots) {
  const about = (a.about || [a.description]).map(p => `<p>${esc(p)}</p>`).join('\n');
  const chips = (a.features || []).length
    ? `<ul class="chips">${a.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
  const notice = a.notice
    ? `<div class="notice"><b>${esc(a.notice.title)}</b>${esc(a.notice.text)}</div>` : '';
  const links = (a.links || []).length
    ? `<div class="links">${a.links.map(l => `<a href="${esc(l.url)}">${esc(l.title)}</a>`).join('')}</div>
<div class="hint">${a.links.map(l => esc(l.url.replace(/^https?:\/\//, '').replace(/\/$/, ''))).join(' · ')}</div>` : '';
  const urls = shots.map(f => `${RAW}/screenshots/${a.id}/${encodeURIComponent(f)}`);
  const shotsBlock = shots.length ? `
<div class="col shots">
  <h2>Скриншоты</h2>
  <div class="stage">
    ${urls.map((u, n) => `<div class="slide"><img src="${u}" alt="Скриншот ${n + 1}"></div>`).join('\n    ')}
    <button class="nav prev" id="prev" aria-label="Назад">&#8249;</button>
    <button class="nav next" id="next" aria-label="Вперёд">&#8250;</button>
  </div>
  <div class="bar">
    <div class="cnt" id="cnt"></div>
    <div class="thumbs">${urls.map((u, n) => `<img src="${u}" alt="${n + 1}">`).join('')}</div>
  </div>
</div>` : '';
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.title)}</title>
<style>:root{--a:${a.accent || '#a45cf5'}}${CSS}</style></head>
<body><div class="wrap">
<div class="col">
  <h1>${esc(a.title)}</h1>
  <div class="tag">${esc(a.tagline || a.description)}</div>
  ${about}
  ${chips}
  ${notice}
  ${links}
</div>${shotsBlock}
</div>
<script>${JS}</script>
</body></html>
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
