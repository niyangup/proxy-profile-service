import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const repository = 'KOP-XIAO/QuantumultX';
const repositoryUrl = `https://github.com/${repository}`;
const upstreamPath = 'Scripts/resource-parser.js';
const upstreamBranch = 'master';
const vendorDirectory = new URL('../vendor/kop-xiao/', import.meta.url);
const vendorFile = new URL('resource-parser.js', vendorDirectory);
const metadataFile = new URL('upstream.json', vendorDirectory);

const githubToken = (() => {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
})();

const requestHeaders = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'proxy-profile-service-kop-sync',
  ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
};

const fetchOrThrow = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { ...requestHeaders, ...options.headers },
  });
  if (!response.ok) {
    throw new Error(`上游请求失败：${response.status} ${response.statusText} (${url})`);
  }
  return response;
};

const commitsUrl = new URL(`https://api.github.com/repos/${repository}/commits`);
commitsUrl.searchParams.set('path', upstreamPath);
commitsUrl.searchParams.set('sha', upstreamBranch);
commitsUrl.searchParams.set('per_page', '1');

const commits = await (await fetchOrThrow(commitsUrl)).json();
const commit = Array.isArray(commits) ? commits[0]?.sha : undefined;
if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/.test(commit)) {
  throw new Error('无法确定 KOP-XIAO 解析器的最新提交');
}

const sourceUrl = `https://raw.githubusercontent.com/${repository}/${commit}/${upstreamPath}`;
const contentsUrl = new URL(`https://api.github.com/repos/${repository}/contents/${upstreamPath}`);
contentsUrl.searchParams.set('ref', commit);
const source = Buffer.from(
  await (
    await fetchOrThrow(contentsUrl, {
      headers: { Accept: 'application/vnd.github.raw+json' },
    })
  ).arrayBuffer(),
);
const sourceText = source.toString('utf8');
if (!sourceText.includes('资源解析器') || !sourceText.includes('$done(')) {
  throw new Error('上游文件未通过基本结构检查，拒绝更新');
}

const sha256 = createHash('sha256').update(source).digest('hex');
let previousMetadata;
try {
  previousMetadata = JSON.parse(await readFile(metadataFile, 'utf8'));
} catch {
  previousMetadata = undefined;
}

const unchanged = previousMetadata?.commit === commit && previousMetadata?.sha256 === sha256;
const metadata = {
  repository: repositoryUrl,
  path: upstreamPath,
  branch: upstreamBranch,
  commit,
  sha256,
  sourceUrl,
  syncedAt: unchanged ? previousMetadata.syncedAt : new Date().toISOString(),
};

await mkdir(vendorDirectory, { recursive: true });
await writeFile(vendorFile, source);
await writeFile(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`);

console.log(
  unchanged
    ? `KOP-XIAO 解析器已是最新版本：${commit}`
    : `KOP-XIAO 解析器已更新到：${commit} (${sha256})`,
);
