import { access, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_API_BASE_URL = 'https://lavender.artbakerchat.workers.dev';
const MAX_LOCAL_RESPONSES = 8;
const apiBaseUrl = (process.env.RESPONSE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
const outputDirectory = path.resolve(process.cwd(), 'resource', 'response');
const adminToken = process.env.API_ADMIN_TOKEN || '';

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json', ...(adminToken ? { authorization: `Bearer ${adminToken}` } : {}) } });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${url}`);
  }
  return response.json();
}

async function pruneOldResponses() {
  const names = (await readdir(outputDirectory)).filter((name) => name.endsWith('.json'));
  const files = await Promise.all(names.map(async (name) => {
    const filePath = path.join(outputDirectory, name);
    const details = await stat(filePath);
    let createdAt = details.mtimeMs;

    try {
      const trace = JSON.parse(await readFile(filePath, 'utf8'));
      const traceTime = Date.parse(trace.createdAt);
      if (Number.isFinite(traceTime)) createdAt = traceTime;
    } catch {
      // Fall back to the file modification time for malformed or unrelated JSON.
    }

    return { filePath, createdAt };
  }));

  const expired = files
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(0, Math.max(0, files.length - MAX_LOCAL_RESPONSES));

  await Promise.all(expired.map(({ filePath }) => unlink(filePath)));
  return expired.length;
}

async function syncResponses() {
  await mkdir(outputDirectory, { recursive: true });

  const listing = await getJson(`${apiBaseUrl}/api/responses`);
  const objects = Array.isArray(listing.responses) ? listing.responses : [];
  let downloaded = 0;

  for (const object of objects) {
    const key = object?.key;
    if (typeof key !== 'string' || !key.startsWith('response/') || !key.endsWith('.json')) continue;

    const fileName = path.basename(key);
    const destination = path.join(outputDirectory, fileName);
    const temporary = `${destination}.tmp`;

    try {
      await access(destination);
      continue;
    } catch {
      // The object has not been downloaded yet.
    }

    const trace = await getJson(`${apiBaseUrl}/api/responses/${key.split('/').map(encodeURIComponent).join('/')}`);

    await writeFile(temporary, `${JSON.stringify(trace, null, 2)}\n`, 'utf8');
    await rename(temporary, destination);
    downloaded += 1;
  }

  const deleted = await pruneOldResponses();
  console.log(
    `[${new Date().toISOString()}] Synced ${downloaded} new response file(s), `
    + `deleted ${deleted} old file(s), and kept at most ${MAX_LOCAL_RESPONSES} in ${outputDirectory}.`
  );
}

try {
  await syncResponses();
} catch (error) {
  console.error(`[${new Date().toISOString()}] Response sync failed: ${error.message}`);
  process.exitCode = 1;
}
