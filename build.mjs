import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from 'node:fs';

const REPO = process.env.GITHUB_REPOSITORY || 'USER/REPO';
const BRANCH = process.env.GITHUB_REF_NAME || 'main';
const [owner, name] = REPO.split('/');
const RAW = `https://${owner}.github.io/${name}`;
const cmp = (a, b) => a.localeCompare(b, undefined, { numeric: true });

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
  const fullDescription = [a.description, ...shots.map(f => `![${f}](${RAW}/${shotDir}/${encodeURIComponent(f)})`)].join('\n\n');
  return {
    id: a.id,
    fullDescription,
    title: a.title,
    iconUri,
    shortDescription: a.description,
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
