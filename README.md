# Quantumult X Resource Parser

一个自主实现的 Quantumult X 资源解析器。它把 Clash YAML 或 Surge CONF 中的代理节点直接转换成 Quantumult X 节点行，配置内容只在 Quantumult X 本地处理，不上传到本项目的服务器。

项目部署后只提供两个静态文件：

- `/resource-parser.js`：给 Quantumult X 使用的解析脚本。
- `/`：不含管理功能的简要使用说明。

不再包含上传页面、Worker API、KV/R2 存储、Access、管理令牌或订阅令牌。

## 使用方法

把部署域名写入 Quantumult X 配置的 `[general]`：

```ini
resource_parser_url = https://你的域名/resource-parser.js
```

然后在 Quantumult X 中把供应商的 Clash YAML 或 Surge CONF 地址添加为服务器远程资源。刷新资源时，Quantumult X 会下载源配置并在本地调用该脚本，只导入其中的节点。

如果配置来自本地文件，也可以先把文件导入 Quantumult X；是否调用资源解析器取决于 Quantumult X 当前版本和导入入口。长期使用更推荐供应商的 HTTPS 远程地址，这样可以直接刷新。

> 脚本只转换节点，不转换 Clash 策略组、规则、DNS 或 Surge 的 Rewrite/MITM/Script 等配置。

## 支持范围

输入格式按内容自动识别：

- Clash YAML：读取顶层 `proxies`。
- Surge CONF：读取 `[Proxy]`。

当前协议：

- Shadowsocks，包括 simple-obfs 和 v2ray-plugin WebSocket。
- ShadowsocksR。
- Trojan，包括 SNI、WebSocket 和证书校验选项。
- VMess，包括 TCP、WebSocket、TLS。
- VLESS，包括 WebSocket、TLS、Reality 和 flow。
- HTTP/HTTPS。
- SOCKS5/SOCKS5-TLS。
- AnyTLS。

不支持的节点会被跳过；Quantumult X 支持 `$notify` 时会显示转换数量和最多三条原因。流量、到期、剩余套餐等信息节点会自动过滤。如果所有节点都无法转换，脚本返回空内容并通知错误。

限制：源文件最大 5 MB、最多 5000 个节点。为避免配置行注入，包含逗号或换行且无法安全序列化的字段会被跳过。

## Cloudflare 部署

这是纯 Static Assets 项目，不会创建 Worker 入口、KV、R2 或 Secret。

Cloudflare Workers Builds 可使用：

```text
构建命令：npm run build
部署命令：npx wrangler deploy
```

项目通过 `.nvmrc` 和 `package.json` 固定 Node.js `24.12.0`。Cloudflare 自动依赖安装使用构建镜像自带的 npm 版本即可，提交的 `package-lock.json` 供 `npm ci` 使用。

也可以从本地部署：

```bash
npm ci
npm run deploy
```

构建产物位于 `dist/`，不提交 Git。

## 本地开发

```bash
npm ci
npm run dev
```

完整验证：

```bash
npm run check
npm run deploy:dry-run
```

核心模块：

- `src/parse-clash.ts`：Clash YAML 解析。
- `src/parse-surge.ts`：Surge `[Proxy]` 解析。
- `src/render.ts`：Quantumult X 节点输出。
- `src/resource-parser.ts`：Quantumult X `$resource` / `$done` / `$notify` 入口。
- `scripts/build.mjs`：将解析器及 YAML 依赖打包成单个脚本。

## 隐私与许可

本项目不接收、保存或转发代理配置。部署站点没有分析脚本或第三方资源。源码使用 MIT License；打包的 `yaml` 依赖许可见 `THIRD_PARTY_NOTICES.md`。
