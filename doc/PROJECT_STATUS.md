# 项目状态与接手说明

> 最后更新：2026-07-28  
> 已验证的功能基线提交：`50bbaa5`  
> 用途：在没有任何历史对话的全新会话中，先阅读本文即可理解项目现状、关键决策和继续工作的方式。

## 1. 项目现在是什么

这是一个公开的、纯静态发布的 **Quantumult X 资源解析器**项目：

- GitHub 仓库：<https://github.com/niyangup/proxy-profile-service>
- 正式解析器：<https://niyangup.github.io/proxy-profile-service/resource-parser.js>
- 兼容地址：<https://niyangup.github.io/proxy-profile-service/resource-parser.txt>
- 输入资源示例：`https://westdata.niyangup.workers.dev`

Quantumult X 自己下载输入资源，将内容放入 `$resource.content`，然后执行本项目生成的 JavaScript。解析器把 Clash YAML 或 Surge CONF 转换为 Quantumult X 节点行，并通过 `$done({ content })` 返回。

本仓库**不是** Cloudflare Worker 项目，也没有网页、上传页面、Cloudflare Access、KV、R2、管理令牌或运行中的后端服务。早期版本曾经包含这些功能，后来已经全部放弃并移除。`westdata.niyangup.workers.dev` 是输入资源地址，不由本仓库构建或部署。

## 2. Quantumult X 中的使用方式

资源地址：

```text
https://westdata.niyangup.workers.dev
```

资源解析器地址：

```text
https://niyangup.github.io/proxy-profile-service/resource-parser.js
```

修改解析器后如果 Quantumult X 或 GitHub Pages 缓存尚未刷新，可临时加提交号作为查询参数：

```text
https://niyangup.github.io/proxy-profile-service/resource-parser.js?v=<commit>
```

然后在 Quantumult X 中点击 JavaScript 更新按钮，再更新服务器资源。查询参数只用于强制刷新缓存，长期地址不需要携带它。

## 3. 已验证状态

在基线提交 `50bbaa5` 上：

- `npm run check` 全部通过。
- 格式检查、Oxlint、TypeScript 类型检查均通过。
- 共 16 项测试通过。
- GitHub Actions 构建与 GitHub Pages 发布成功。
- 线上 `.js` 响应为 HTTP 200，Content-Type 为 `application/javascript; charset=utf-8`。
- `.js` 与 `.txt` 内容完全一致。
- 使用本机 `/Users/niyangup/Downloads/westData2.yaml` 做过端到端验证，输出 61 行合法 Quantumult X Trojan 节点。
- 用户已在真实 iPhone/Quantumult X 上确认 `.js` 解析器能够正常导入并使用节点。

`westData2.yaml` 是用户的私有订阅文件，只允许由本项目代码在本机读取用于验证。不要上传它，不要交给第三方脚本或在线转换服务，也不要打印其中的服务器、密码或完整节点内容。

## 4. 最重要的兼容性结论

Quantumult X 官方资源解析器示例位于：

<https://github.com/crossutility/Quantumult-X/blob/master/resource-parser.js>

官方接口的核心形式是：

```js
$done({ content: total });
```

本项目必须直接返回 Quantumult X 节点文本。当前入口在 `src/resource-parser.ts` 中执行：

```ts
$done({ content: result.content });
```

构建脚本 `scripts/build.mjs` 特意使用 esbuild 的 `format: 'esm'`，但入口不导出任何模块，因此最终产物是没有 `export` 的顶层脚本。这样可以在打包内部模块的同时，避免生成严格模式前导和 IIFE 包装。

### 曾经发生过的 `Result type error`

故障版本做了两件不符合当前可靠执行形式的事情：

1. 在 Quantumult X 运行时把节点文本重新编码为 Base64。
2. esbuild 使用 `format: 'iife'`，生成了 `"use strict"` 和 IIFE 包装。

预先写死的静态 Base64 节点可以导入，但只要经过构建后的运行时代码就出现 `Result type error`。随后同时改为顶层脚本和原生文本返回，真机问题消失。没有继续做破坏性 A/B 测试来区分两者中哪一个是唯一原因，因此准确结论是：**原构建后的运行时代码形态与 Quantumult X 不兼容，而不是文件后缀、MIME、用户 YAML 或 Trojan 字段有问题。**

不要重新引入运行时 Base64 输出、`format: 'iife'`、`"use strict"` 或临时兼容性探针，除非有新的官方文档和真机验证支持这样做。

## 5. 当前支持范围

### 输入格式

- Clash YAML：读取 `proxies:` 部分。
- Surge CONF：读取 `[Proxy]` 部分。

Clash 使用项目内的轻量解析器，并不是完整 YAML 规范实现。它支持常见的 Clash 节点对象、行内对象、简单嵌套字段、引号、数组和注释；如果未来遇到特别复杂的 YAML 锚点、别名或不常见语法，可能需要扩展 `src/parse-clash.ts`。

### 节点协议

- Shadowsocks
- ShadowsocksR
- Trojan
- VMess
- VLESS
- HTTP/HTTPS
- SOCKS5/SOCKS5-TLS
- AnyTLS

同时处理常见的 TLS/SNI、证书验证、WebSocket、HTTP 传输、obfs、v2ray-plugin、Reality 公钥和 short-id 等字段。

当前不支持 Hysteria/Hysteria2、TUIC、WireGuard、Snell 等未进入 `ProxyType` 的协议。Quantumult X 本身不支持的协议不应强行输出。对于能够由 Quantumult X 支持但项目尚未实现的新协议，应同时补充模型、输入解析、输出渲染和测试。

### 保护与过滤

- 最大输入：5 MB。
- 最大节点数：5000。
- 自动过滤名称包含流量、到期、剩余、套餐等信息的伪节点。
- 拒绝会破坏 Quantumult X 单行配置的逗号或换行字段。
- 单个不支持或无效节点会被跳过；如果 Quantumult X 允许通知，会提示前几条原因。

## 6. 代码结构

```text
src/resource-parser.ts  Quantumult X 入口，读取 $resource 并调用 $done
src/index.ts            格式识别、转换编排、限制与过滤
src/parse-clash.ts      Clash proxies 轻量解析与节点归一化
src/parse-surge.ts      Surge [Proxy] 解析与节点归一化
src/render.ts           将统一节点模型渲染为 Quantumult X 节点行
src/model.ts            输入格式、节点类型和结果类型
src/utils.ts            类型转换、长度、安全检查和通用工具
scripts/build.mjs       生成 dist/resource-parser.js 和 .txt
test/parser.test.ts     协议、格式和安全行为测试
test/runtime.test.ts    Quantumult X 全局对象与最终 bundle 行为测试
.github/workflows/deploy.yml  GitHub Pages 和 Release 自动发布
```

`dist/` 是构建产物，不提交到 Git。GitHub Actions 每次从源码重新构建。

## 7. 构建与发布

项目固定使用：

- Node.js `24.12.0`，见 `.nvmrc` 和 `package.json#engines`。
- npm 锁文件安装，CI 使用 `npm ci`。
- esbuild 生成单文件 JavaScript。

常用命令：

```bash
npm ci
npm run check
npm run build
```

`npm run check` 依次执行：

1. 格式检查
2. Oxlint
3. TypeScript 类型检查
4. Vitest
5. 正式构建

推送到 `main` 后，`.github/workflows/deploy.yml` 会：

1. 安装依赖并执行完整检查。
2. 构建 `dist/resource-parser.js` 和 `dist/resource-parser.txt`。
3. 部署到 GitHub Pages。
4. 创建对应的 GitHub Release，并附带两个构建文件。

构建产物第一行带 UTC 构建时间注释。不要把时间写死到源码中。

## 8. 第三方方案调研结论

2026-07-28 已检查 npm 和 GitHub，未发现一个可以直接、轻量、可靠地替代当前实现的“Quantumult X 资源解析器生成器”。

### `sub-store-convert@2.36.20`

- npm：<https://www.npmjs.com/package/sub-store-convert>
- 仓库：<https://github.com/tbxark/sub-store-convert>
- 基于：<https://github.com/sub-store-org/Sub-Store>

这是能力最接近的候选。通过低层 API 可以把 `$resource.content` 解析后输出 QX 节点。临时实验中：

- 能转换 `westData2.yaml`。
- 输出 63 个 Trojan 节点；当前项目输出 61 个，因为当前项目过滤了两个信息节点。
- esbuild 最小化后的实验 bundle 约 570,955 字节，当前正式 bundle 约 16 KB。
- Node VM 中转换耗时约 548 ms；尚未在 Quantumult X 真机运行时验证。

不直接采用的原因：体积约为当前实现的 35 倍；带入 YAML、Peggy、Lodash、Base64 等完整运行时代码；主要高层 API 自己 `fetch` URL，而 Quantumult X 官方说明资源解析器不支持 HTTP 请求；还可能存在 JavaScriptCore 兼容或执行时间风险。

许可证也需要谨慎：包装项目和 npm 包标注 MIT，但发布代码明确 vendored 了上游 Sub-Store，而 Sub-Store 是 AGPL-3.0。不要在没有明确完成许可证审查前把它复制或打包进当前 MIT 项目。

### 其他候选

- `subconverter-js@1.0.0`：GPL-3.0，主要解析 SS/SSR/VMess/Trojan 分享链接或 Base64 链接列表，不直接读取 Clash YAML 或 Surge CONF，不适合当前输入。
- `surgio@3.17.0`：成熟但属于重型 Node.js CLI/生成系统，依赖文件系统、网络和大量 Node 包，不适合 Quantumult X 资源解析器运行时。
- KOP-XIAO `resource-parser.js`：功能全面的第三方单文件脚本，不是 npm 包。早期测试可导入用户 YAML，但生成节点在用户环境中无法联网；其代码庞大且难以按项目需求审计和维护，因此没有继续作为正式实现。

当前建议：保持轻量自有实现。遇到新协议时，可以研究 Sub-Store 对该协议的解析和 QX 输出规则，但应按需独立实现，并遵守上游许可证，不要直接整体打包。

## 9. 新会话接手流程

开始修改前：

1. 阅读本文。
2. 检查 `git status --short`，不要覆盖用户未提交的改动。
3. 查看当前提交和 GitHub Actions 状态，确认本文基线是否已经过期。
4. 先运行 `npm run check` 建立本地基线。

修改解析器后：

1. 为新格式或协议增加最小、无敏感信息的测试夹具。
2. 执行 `npm run check`。
3. 检查生成文件顶部、结尾和体积，确保仍是顶层脚本并直接调用 `$done({ content })`。
4. 如需用真实订阅验证，只输出节点数量、协议计数和布尔检查，不打印服务器或凭据。
5. 推送后等待 GitHub Actions 成功，再使用带提交号的正式 `.js` URL 做一次真机验证。

不要恢复旧的 Cloudflare 网页上传项目，也不要重新创建 Access、KV、R2、管理员令牌或上传 UI，除非用户明确改变项目方向。
