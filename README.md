# Proxy Profile Service

一个部署在 Cloudflare Workers 上的私有代理配置转换与分发服务。手机或电脑上传 Clash YAML / Surge CONF 后，浏览器本地完成转换，Worker 将产物版本化保存到私有 R2，并提供固定的 Surge 与 Quantumult X 订阅地址。

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

2. 创建配置中声明的私有 R2 bucket：

```bash
npx wrangler r2 bucket create proxy-profile-service
```

3. 使用密码管理器分别生成两个至少 32 字节的随机 Base64URL 值，并通过交互式输入设置，不要把值写进命令历史：

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put SUBSCRIPTION_TOKEN
```

4. 部署：

```bash
npm run deploy
```

部署后也可以在 Cloudflare Dashboard 为 Worker 绑定自定义域名。

## 使用流程

1. 打开部署后的页面。
2. 输入 `ADMIN_TOKEN`。令牌只保存在当前页面内，不写入浏览器存储。
3. 上传最新 Clash YAML；只有没有 YAML 时才上传 Surge CONF。
4. 查看转换统计与警告，确认后发布。
5. 把页面返回的固定地址分别保存到 Surge 和 Quantumult X。

地址形式：

```text
https://你的域名/sub/surge.conf?p=<SUBSCRIPTION_TOKEN>
https://你的域名/sub/quanx.conf?p=<SUBSCRIPTION_TOKEN>
```

两个地址共用随机订阅令牌。错误或缺失的 `p` 统一返回 `404`。如果地址泄露，重新设置 `SUBSCRIPTION_TOKEN` 并在两个客户端更新一次地址即可。

## 数据与安全

- 配置解析和转换发生在浏览器；Worker 不承担大 YAML 的解析 CPU。
- 发布接口使用 Bearer 管理令牌。
- R2 先写入不可变版本，全部成功后才切换 `current.json`，失败发布不会破坏当前版本。
- 订阅响应禁止公共缓存和搜索引擎索引。
- 页面不加载第三方脚本、字体或统计资源。
- Worker 应用日志不记录完整 URL、查询参数、令牌或配置正文。
