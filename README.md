# Proxy Profile Service

一个部署在 Cloudflare Workers 上的私有代理配置转换与分发服务。手机或电脑分别上传主用、备用代理的 Clash YAML / Surge CONF 后，浏览器本地完成转换，Worker 将两个产物快照分别保存到 Workers KV，并提供两组固定的 Surge 与 Quantumult X 订阅地址。

## 支持范围

- 输入：Clash YAML、Surge CONF，按文件内容自动识别。
- 节点：当前支持 Trojan。
- 策略：当前支持 `select`。
- 规则：支持常见域名、IPv4/IPv6、GEOIP、进程和最终规则；QX 输出会跳过 iOS 不适用的进程规则。
- Surge CONF 原样作为 Surge 输出；其节点、策略和可移植规则转换到 QX。
- Surge Script、MITM、Rewrite、Map Local、SSID 和远程 `RULE-SET` 不会机械转换到 QX。

对当前供应方应优先上传 Clash YAML：YAML 已展开完整规则；Surge CONF 主要引用 Surge 专用远程规则，转换到 QX 时会缺少这些规则。

## 本地开发

需要 Node.js 22.12 或更高版本。

```bash
npm install
npm run dev
```

本地令牌位于被 Git 忽略的 `.dev.vars`。仓库不应包含生产令牌、真实订阅配置或生成产物。

常用验证命令：

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm run deploy:dry-run
```

## 首次部署

1. 登录 Wrangler：

```bash
npx wrangler login
```

2. 使用密码管理器分别生成 `ADMIN_TOKEN` 与 `SUBSCRIPTION_TOKEN`，并通过交互式输入设置，不要把值写进命令历史：

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put SUBSCRIPTION_TOKEN
```

3. 部署：

```bash
npm run deploy
```

`PROFILE_STORE` 已绑定到当前 Cloudflare 账户中的免费 KV namespace `proxy-profile-service-profile-store`，无需 R2 或 R2 结算。

部署后也可以在 Cloudflare Dashboard 为 Worker 绑定自定义域名。

## 使用流程

1. 打开部署后的管理页面并输入 `ADMIN_TOKEN`。令牌仅保存在当前页面内存，不写入浏览器存储。
2. 在“主用配置”上传主力代理的 Clash YAML；只有没有 YAML 时才选 Surge CONF。
3. 在“备用配置”上传备用代理的 YAML 或 CONF。两个槽位可独立更新，不要求同时上传。
4. 分别查看转换统计与警告，确认后发布。
5. 把页面返回的主用、备用固定地址分别保存到 Surge 和 Quantumult X。

地址形式：

```text
https://你的域名/sub/surge.conf?p=<SUBSCRIPTION_TOKEN>
https://你的域名/sub/quanx.conf?p=<SUBSCRIPTION_TOKEN>
https://你的域名/sub/backup/surge.conf?p=<SUBSCRIPTION_TOKEN>
https://你的域名/sub/backup/quanx.conf?p=<SUBSCRIPTION_TOKEN>
```

四个地址共用随机订阅令牌。错误或缺失的 `p` 统一返回 `404`。如果地址泄露，重新设置 `SUBSCRIPTION_TOKEN` 并在客户端更新地址即可。

## 数据与安全

- 配置解析和转换发生在浏览器；Worker 不承担大 YAML 的解析 CPU。
- 状态和发布接口使用 Bearer `ADMIN_TOKEN`；前端不持久化该令牌。
- 主用和备用分别以一个完整 KV 快照保存原始配置、Surge 输出、Quantumult X 输出和元数据；更新一方不会覆盖另一方。
- KV 最终一致：不同地区最多可能短暂读取到上一版完整快照，但不会读到缺文件的半发布版本。
- 为控制免费额度，每个槽位只保留最新快照，不保留历史版本。
- 订阅响应禁止公共缓存和搜索引擎索引。
- 页面不加载第三方脚本、字体或统计资源。
- Worker 应用日志不记录完整 URL、查询参数、令牌或配置正文。
