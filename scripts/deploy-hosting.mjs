// Publishes public/ to Firebase Hosting through the Hosting REST API.
// Used instead of `firebase deploy` because the project's Admin SDK service account
// can publish to Hosting but cannot read Service Usage, which the Firebase CLI checks first.
//
// Credentials: FIREBASE_SERVICE_ACCOUNT (the key's JSON text) or
// GOOGLE_APPLICATION_CREDENTIALS (path to the key file).
import { GoogleAuth } from 'google-auth-library';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SITE = 'quickzu-app';
const API = 'https://firebasehosting.googleapis.com/v1beta1';
const root = new URL('..', import.meta.url).pathname;
const hosting = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8')).hosting;
const publicDir = join(root, hosting.public);

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  ...(process.env.FIREBASE_SERVICE_ACCOUNT ? { credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) } : {}),
});
const token = await auth.getAccessToken();

async function call(method, url, body, contentType = 'application/json') {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// Same files `firebase deploy` would upload: everything in public/ except dotfiles.
function listFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    if (name.startsWith('.') || name === 'node_modules') return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const files = {};
const blobs = {};
for (const full of listFiles(publicDir)) {
  const gz = gzipSync(readFileSync(full), { level: 9 });
  const hash = createHash('sha256').update(gz).digest('hex');
  files['/' + relative(publicDir, full).split(sep).join('/')] = hash;
  blobs[hash] = gz;
}

const config = {};
if (hosting.cleanUrls) config.cleanUrls = true;
if (hosting.trailingSlash === false) config.trailingSlashBehavior = 'REMOVE';
if (hosting.trailingSlash === true) config.trailingSlashBehavior = 'ADD';

const version = await call('POST', `${API}/sites/${SITE}/versions`, { config });
const populated = await call('POST', `${API}/${version.name}:populateFiles`, { files });
for (const hash of populated.uploadRequiredHashes || []) {
  await call('POST', `${populated.uploadUrl}/${hash}`, blobs[hash], 'application/octet-stream');
}
await call('PATCH', `${API}/${version.name}?update_mask=status`, { status: 'FINALIZED' });
await call('POST', `${API}/sites/${SITE}/releases?versionName=${encodeURIComponent(version.name)}`, {});

console.log(`Published ${Object.keys(files).length} files (${(populated.uploadRequiredHashes || []).length} new) to https://${SITE}.web.app`);
