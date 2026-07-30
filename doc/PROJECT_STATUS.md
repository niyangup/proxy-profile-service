# 项目状态与接手说明

> 最后更新：2026-07-30
>
> 用途：在没有历史对话的新会话中，先阅读本文即可理解项目现状、关键决策和继续工作的方式。

## 1. 项目现在是什么

这是一个公开的、纯静态发布的 **Quantumult X 混合资源解析器**项目：

- GitHub 仓库：<https://github.com/niyangup/proxy-profile-service>
- 正式解析器：<https://niyangup.github.io/proxy-profile-service/resource-parser.js>
- 兼容副本：<https://niyangup.github.io/proxy-profile-service/resource-parser.txt>
- 用户当前的输入资源示例：`https://westdata.niyangup.workers.dev`

Quantumult X 自己下载输入资源，将内容放入 `$resource.content`，再执行本项目生成的 JavaScript。本项目不代理、不保存、也不主动请求订阅内容。

仓库不是 Cloudflare Worker 应用。不要恢复已经废弃的上传页面、后端、Access、KV、R2、密钥或管理员令牌系统，除非用户明确改变产品方向。

## 2. 当前混合架构

项目同时保留两套能力：

1. 自有轻量转换器：负责用户已经在真实 iPhone 上验证可用的 Clash YAML 和 Surge `[Proxy]` 节点转换。
2. KOP-XIAO 解析器：负责其他服务器订阅格式、分流、重写和其参数功能。

运行时路由如下：

- `server` + 可识别的 Clash YAML / Surge CONF：先运行自有转换器。
- 自有转换成功且链接没有 KOP 参数：直接返回原生 Quantumult X 节点文本，保持已经验证过的兼容路径。
- 自有转换成功且资源链接含 `#` 参数：把自有转换结果交给 KOP，以应用筛选、重命名等参数。
- 自有转换失败：把未经修改的原始输入交给 KOP。
- 其他 `server` 格式以及 `filter`、`rewrite`：直接交给 KOP。
- 组合层捕获 KOP 内部的多次 `$done`，最终只向 Quantumult X 调用一次 `$done`。
- KOP 的第一份回调是可执行结果；后续兼容回调可能附带空的 `info: {}`，必须忽略，不能用最后一次覆盖第一份。

KOP 的 `$parser` 参数助手在脚本顶层注册，因此即使资源走自有转换器，Quantumult X 的参数编辑 UI 仍然可用。

## 3. KOP-XIAO 上游与授权

- 上游仓库：<https://github.com/KOP-XIAO/QuantumultX>
- 上游文件：`Scripts/resource-parser.js`
- 当前固定提交：`3e2239c57195592b7c2f92746bf54032db9d8c9d`
- 当前 SHA-256：`7a3a6b2c2a1c87fc15b888aa8120a4a4dde0922835d2787b12028cbecee10114`
- 原样 vendor：`vendor/kop-xiao/resource-parser.js`
- 元数据：`vendor/kop-xiao/upstream.json`

用户已经与 KOP-XIAO 作者沟通，并获得复制、使用该脚本的明确许可。上游文件保留 `资源解析器 © Shawn` 版权头；详细说明见 `THIRD_PARTY_NOTICES.md`。

上游仓库在集成时没有公开 LICENSE，因此不要声称 vendored 文件属于本项目 MIT 代码，也不要移除版权头。`vendor/kop-xiao/resource-parser.js` 必须保持与元数据中固定提交的原文件逐字节一致，禁止直接修改。

## 4. 上游同步方式

手动检查和同步：

```bash
npm run sync:kop
npm run check
```

同步脚本会：

1. 查询 KOP 文件在 `master` 上的最新提交。
2. 按精确提交下载源文件。
3. 计算 SHA-256 并更新 `upstream.json`。
4. 如果内容和提交没有变化，保持 `syncedAt` 不变，避免无意义提交。

`.github/workflows/sync-kop.yml` 每周一运行，也支持手动触发。它只创建更新 PR，不直接合并或发布。即使新上游导致组合构建失败，也应保留更新 PR 和失败状态供人工分析。

审查同步 PR 时重点检查：

- 上游版权头、参数助手和运行时分隔标记是否仍存在。
- `$resource`、`$parser`、`$done`、`$notify` 的接口是否变化。
- 是否出现网络请求、持久化、Node API 或其他 Quantumult X 不支持的依赖。
- `npm run check` 是否通过。
- 生成脚本是否仍为顶层执行、无模块导出、无严格模式前导、无 IIFE。

不要在每次构建时直接下载 `master`。生产构建必须只使用仓库中经过审查的固定版本。

## 5. Quantumult X 兼容性结论

官方资源解析器示例：<https://github.com/crossutility/Quantumult-X/blob/master/resource-parser.js>

自有成功路径必须继续使用：

```js
$done({ content: result.content });
```

生成文件仍是顶层经典脚本。esbuild 对自有 TypeScript 使用 `format: 'esm'`，但入口没有导出，因此不会生成模块导出、严格模式前导或 IIFE。构建时将 KOP 的参数助手留在顶层，将其运行时放入命名函数，并由自有入口从顶层调用。

构建只对最终产物中的 KOP 运行时副本做压缩；`vendor/kop-xiao/resource-parser.js` 仍保持上游原始字节。最终组合文件有 240 KiB 硬性上限，防止再次接近移动端脚本加载边界。压缩不能生成严格模式、IIFE 或模块导出。

### 历史 `Result type error`

旧故障版本同时做了运行时 Base64 编码，并使用 `format: 'iife'` 生成了 `"use strict"` 和 IIFE。改回顶层脚本与原生文本返回后，用户在真实设备上确认问题消失。

因此：

- 不要给自有成功路径重新加入 Base64。
- 不要改回 `format: 'iife'` 或严格模式前导。
- 不要把文件扩展名、GitHub Pages MIME、用户 YAML 或 Trojan 字段误判为当时的原因。
- KOP 自己在部分服务器路径返回 Base64 是它既有的上游行为，与自有成功路径的兼容约束分开管理。

## 6. 已验证状态

上一套自有转换器基线提交 `50bbaa5` 已完成：

- GitHub Pages 和 Release 发布成功。
- `.js` 返回 HTTP 200 和 JavaScript Content-Type。
- `.js` 与 `.txt` 内容一致。
- 本机私有 YAML 转换出 61 行合法 Trojan 节点。
- 用户在真实 iPhone / Quantumult X 上确认 `.js` 能导入并使用节点。

2026-07-30 的混合解析器本地验证覆盖：

- 自有 Clash 成功路径与原生文本输出。
- KOP 其他服务器格式回退。
- 自有解析失败后的 KOP 回退。
- KOP server 参数应用。
- KOP `filter` 和 `rewrite` 路径。
- KOP 参数助手注册。
- 所有路径对全局 `$done` 恰好调用一次。
- vendor 文件 SHA-256 与元数据一致。
- 生成文件的顶层形态、版权头、上游提交 banner 和无模块导出约束。

混合版本 `4bf96c6` 首次发布后，用户真机反馈很多 KOP 路径出现 `Result type error`。第一轮修复 `478c97a` 将组合层从保留最后一次回调改为保留第一份 `{ content }`，排除了空 `info: {}`，但用户确认真机仍然报错，因此不能把空 `info` 记作唯一根因。

继续排查发现：KOP 原文件为 250,290 字节，首次组合产物为 266,941 字节，刚好越过 256 KiB。官方公开仓库未找到明确的资源解析器大小限制说明，因此“256 KiB”目前是由真实边界数据支持、但仍需真机确认的假设。构建现对 KOP 运行时副本做安全压缩，并用 240 KiB 硬限制防止体积回归。发布后必须再次真机验证，验证前不要把体积判断写成最终根因。

混合版本发布后仍需要用户做一次聚焦真机验证：原有 YAML、一个分流资源和一个重写资源。不要把“Node VM 测试通过”写成“Quantumult X 真机已验证”。

## 7. 自有转换器支持范围

自有转换器支持：

- Clash YAML 的 `proxies:`。
- Surge CONF 的 `[Proxy]`。
- Shadowsocks、ShadowsocksR、Trojan、VMess、VLESS、HTTP/HTTPS、SOCKS5/SOCKS5-TLS、AnyTLS。
- 常见 TLS/SNI、证书验证、WebSocket、HTTP 传输、obfs、v2ray-plugin、Reality 公钥和 short-id。
- 最大输入 5 MB，最大节点数 5000，信息伪节点过滤和单行注入保护。

Clash 解析器是轻量实现，不是完整 YAML。遇到它不支持但 KOP 支持的语法会自动回退。若扩展自有协议，必须同步更新模型、解析、渲染和合成测试，并确认 Quantumult X 官方支持输出协议。

KOP 宣称的广泛格式和参数能力属于 vendored 上游能力；本项目只对测试中覆盖的路径作本地保证。

## 8. 代码结构

```text
src/resource-parser.ts                 混合路由、单次 $done 和 KOP 调用入口
src/index.ts                           自有格式识别与转换编排
src/parse-clash.ts                     Clash proxies 轻量解析
src/parse-surge.ts                     Surge [Proxy] 解析
src/render.ts                          自有 Quantumult X 节点渲染
src/model.ts                           自有统一节点模型
scripts/build.mjs                      生成组合 .js 与 .txt
scripts/sync-kop.mjs                   固定并同步 KOP 上游
vendor/kop-xiao/resource-parser.js     KOP 原文件，禁止手改
vendor/kop-xiao/upstream.json          上游提交和 SHA-256
test/parser.test.ts                    自有解析与安全测试
test/runtime.test.ts                   组合运行时路由测试
test/vendor.test.ts                    vendor 完整性测试
.github/workflows/deploy.yml           GitHub Pages 与 Release
.github/workflows/sync-kop.yml         定期检查并创建上游更新 PR
```

`dist/` 是构建产物，不提交。正式输出第一行包含 UTC 构建时间和 KOP 固定提交短号，方便排查与回退。

## 9. 构建、发布与接手流程

项目固定使用 Node.js `24.12.0`，CI 使用 `npm ci`。

开始修改前：

1. 阅读本文。
2. 运行 `git status --short`，保留用户未提交改动。
3. 阅读相关源码、vendor 元数据和测试。
4. 实际可行时运行 `npm run check` 建立基线。

交付前：

```bash
npm run check
git diff --check
```

推送 `main` 后，`.github/workflows/deploy.yml` 会执行完整检查、构建 GitHub Pages，并创建含 `.js` 和 `.txt` 的 Release。运行时变更发布后：

1. 等待 Actions 成功。
2. 用 `?v=<commit>` 检查线上新文件与 banner。
3. 只在本地验证无法证明真机兼容时，请用户做一次聚焦设备测试。

## 10. 隐私和安全

- 永远不要提交订阅内容、真实节点、私有 URL、密码、UUID、令牌或真实输出。
- `/Users/niyangup/Downloads/westData2.yaml` 是用户私有数据，只能在用户明确要求的相关本地验证中由本项目代码读取。
- 不得把私有订阅上传或交给 KOP 上游、npm 包、网站或其他第三方服务。
- 使用真实输入时只报告节点数、协议数、结果类型或布尔校验，不打印服务器、tag、密码、UUID 或完整节点行。
- 提交测试只使用不可路由示例域名和虚假凭据。
- 自动同步的第三方代码永远先进入 PR；不要自动合并。

## 11. 既往第三方调研

`sub-store-convert@2.36.20` 能转换用户 YAML，但实验 bundle 约 571 KB，并带来运行时与 AGPL 来源审查问题。`subconverter-js` 不直接支持当前输入，`surgio` 依赖 Node 环境。除非重新完成许可、体积和 Quantumult X 真机评估，否则不要引入这些依赖。
