import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

import { build, transform } from 'esbuild';

const MAX_OUTPUT_BYTES = 240 * 1024;

await rm('dist', { force: true, recursive: true });
await mkdir('dist', { recursive: true });
const builtAt = new Date().toISOString();
const metadata = JSON.parse(await readFile('vendor/kop-xiao/upstream.json', 'utf8'));
const upstreamSource = await readFile('vendor/kop-xiao/resource-parser.js', 'utf8');
const upstreamHash = createHash('sha256').update(upstreamSource).digest('hex');
if (upstreamHash !== metadata.sha256) {
  throw new Error('KOP-XIAO vendor 文件与 upstream.json 的 SHA-256 不一致');
}
if (!/^[0-9a-f]{40}$/.test(metadata.commit)) {
  throw new Error('KOP-XIAO upstream.json 缺少有效提交号');
}

const runtimeMarker = '//beginning 解析器正常使用，調試註釋此部分';
const markerIndex = upstreamSource.indexOf(runtimeMarker);
if (markerIndex < 0 || upstreamSource.indexOf(runtimeMarker, markerIndex + 1) >= 0) {
  throw new Error('无法安全拆分 KOP-XIAO 参数助手与运行时入口');
}
const helperSource = upstreamSource.slice(0, markerIndex);
const runtimeSource = upstreamSource.slice(markerIndex);
const compactRuntime = await transform(runtimeSource, {
  format: 'esm',
  legalComments: 'none',
  minify: true,
  target: 'es2017',
});

const result = await build({
  bundle: true,
  entryPoints: ['src/resource-parser.ts'],
  // The official Quantumult X parser is a top-level classic script. This
  // format bundles imports without adding an IIFE or a strict-mode prologue.
  format: 'esm',
  legalComments: 'none',
  minify: true,
  platform: 'browser',
  target: ['es2017'],
  write: false,
});
const nativeBundle = result.outputFiles[0]?.text;
if (!nativeBundle) throw new Error('原生解析器 bundle 未生成');

const banner =
  `/* Quantumult X Resource Parser v0.1.0 | Built at ${builtAt} | ` +
  `Project code: MIT | KOP-XIAO: ${metadata.commit.slice(0, 12)} (see THIRD_PARTY_NOTICES.md) */`;
const combined = `${banner}\n${helperSource}\nvar $kopResource;\nvar $useKopFallback = false;\n${nativeBundle}\nif ($useKopFallback) {\nlet $resource = $kopResource;\n${compactRuntime.code}\n}\n`;
const outputBytes = Buffer.byteLength(combined);
if (outputBytes > MAX_OUTPUT_BYTES) {
  throw new Error(`组合解析器为 ${outputBytes} 字节，超过 ${MAX_OUTPUT_BYTES} 字节的兼容性上限`);
}

await writeFile('dist/resource-parser.js', combined);

// GitHub Pages serves .js as application/javascript. Quantumult X is more
// reliable with parser URLs served as text/plain, like GitHub raw URLs.
await copyFile('dist/resource-parser.js', 'dist/resource-parser.txt');
