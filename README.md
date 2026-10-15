# 慢记 Manji v3.6.6

**一间由回忆慢慢布置起来的家。小狗是陪伴者，一件纪念物可以藏着两个人对同一天的不同记忆。**

移动端优先的双人回忆 Web 应用：真实账户与会话、共同小家、3D 客厅与三只可互动的小狗、照片与文字回忆、双人视角、说好的承诺、纪念日与电子纪念作品、本地「永恒之链」存证，以及用自己的钱包把承诺指纹写入 BOT Chain 主网。

## 当前状态（2026-10-15）

| 项目 | 状态 |
| --- | --- |
| 本仓库版本 | v3.6.6，`main` 分支 |
| 原网站 [manji.grok.me](https://manji.grok.me) | 运行的是队友在 Grok 中继续开发的 **v4.2**，含「真心话邮箱」等本仓库没有的功能，但没有 BOT Chain 主网功能。两套代码已分叉，修改本仓库不会更新原网站 |
| 新网址发布 | 尚未完成 |
| 真实主网业务交易 | 已完成首笔，见下方「BOT Chain 主网」 |

## BOT Chain 主网

| 项目 | 值 |
| --- | --- |
| 网络 | BOT Chain Mainnet，Chain ID `677`（`0x2a5`） |
| RPC | `https://rpc.botchain.ai` |
| 浏览器 | [scan.botchain.ai](https://scan.botchain.ai) |
| 指定合约 | [`0xDf6d55959BD6abCdE5750D800F782637115b672D`](https://scan.botchain.ai/address/0xDf6d55959BD6abCdE5750D800F782637115b672D) |

链上只读核实结果（2026-10-15）：

- 合约 `VERSION()` 返回 `"1"`。仓库中的 `contracts/ManjiEternalChain.sol` 是 v2 源码，与该地址的实际字节码不对应。
- `owner` 与 `relayer` 均为 `0x4844f22482b0e08dc9b44d153a723863f576b178`。
- **只有这个地址能调用 `seal`**，其他钱包会以 `Unauthorized(address)` 回退。前端发送前会先模拟调用，被拒绝时停止，不会广播交易，也不会改由服务器代发。

首笔真实业务交易：

- 交易：[`0x43a2d644834379e3c31a89ff3703ac625785e8e92844054ee9653a03e917ef0c`](https://scan.botchain.ai/tx/0x43a2d644834379e3c31a89ff3703ac625785e8e92844054ee9653a03e917ef0c)
- 发送方 `0x4844…b178`，接收方为指定合约，区块 26731379，回执 `status = 1`
- `Sealed` 事件中的承诺与应用内日记指纹一致，登记序号 #2

上链的只有内容指纹（哈希），不含正文、照片或身份信息；钱包地址在交易中公开可见；登记后不可撤回。

## 快速开始

需要 Node.js ≥ 22.5（推荐 24）。核心功能没有第三方依赖，不需要 `npm install`。

```bash
npm start                      # 默认 http://127.0.0.1:4173
node scripts/start-home.mjs    # 演示模式：端口 4332，独立演示数据，自动创建演示账户
```

演示账户由 `node scripts/seed-demo.mjs` 创建：`体验官A` / `体验官B`，密码 `manji-2026-10`。

首次启动会创建管理员 `admin`，默认密码 `admin-2026`。**公开部署前必须通过环境变量 `ADMIN_PASSWORD` 设置强密码。** 管理员同样不能查看任何用户的私密回忆。

## 配置

复制 `.env.example` 为 `.env` 按需修改。优先级：平台环境变量 > `.env.local` > `.env` > 代码默认值。私钥和密码只放在 `.env.local` 或部署平台的环境变量里，不要提交到仓库。

| 变量 | 说明 |
| --- | --- |
| `PORT` | 监听端口，默认 `4173` |
| `DB_PATH` | SQLite 数据库文件，默认 `data/manji.db` |
| `MEDIA_ROOT` | 照片与导出文件目录，默认 `data/media` |
| `ADMIN_PASSWORD` | 管理员密码 |
| `ONCHAIN_RPC_URL` / `ONCHAIN_CHAIN_ID` / `ONCHAIN_CONTRACT` / `ONCHAIN_EXPLORER` | BOT Chain 主网配置，取值见上表 |
| `ONCHAIN_RELAYER_KEY` | 留空。用户钱包直发不需要服务器私钥 |
| `PUPPY_IDENTITY_CONTRACT` | 留空。小狗身份合约归属尚未确认 |

如果服务器所在网络无法直连 `rpc.botchain.ai`，交易状态会停在「已发送，等待确认」。可以设置 `HTTPS_PROXY` 和 `NODE_USE_ENV_PROXY=1`，让 Node 通过代理访问 RPC。

## 部署

这是一个完整的 Node.js 应用，前端 `public/` 和后端 `server/` 由同一个进程提供。**不能只发布 `public/` 静态文件**，否则账号、回忆和交易接口都无法使用。

- 数据库和照片目录必须放在持久化磁盘上，否则重启或重新发布后数据会丢失。
- 仓库提供 `Dockerfile` 和 `compose.yaml`，数据保存在容器的 `/data`（`DB_PATH=/data/manji.db`，`MEDIA_ROOT=/data/media`），请挂载持久卷。
- 上线后检查：`/api/public/onchain/config` 返回 `chainId` 677 和指定合约地址，`/wallet.js` 返回 JavaScript 而不是 HTML。
- 迁移或更新前先备份线上数据库（包括 `-wal` 文件）和媒体目录。

详细步骤见 [docs/发布与验收.md](docs/发布与验收.md)。

## 测试

```bash
npm test                  # 业务验收 101 项（自起临时服务和临时数据）
npm run test:navigation   # 3D 客厅寻路 21 项
npm run test:wallet       # 配置、钱包与回执 8 项（模拟钱包，不连接主网）
npm run test:chain        # 本地永恒之链 18 项
npm run test:onchain      # 链上调用数据离线验收 15 项
```

以下脚本会发送**真实主网交易**，未经负责人明确授权不要运行：`scripts/deploy-mainnet.mjs`、`scripts/relay-mainnet.mjs`、`tests/onchain-e2e-mainnet.mjs`。

## 目录结构

```
server/              Node.js 后端（node:sqlite，无第三方依赖）
  index.js           启动入口、路由分发、静态资源、CSRF 防线
  config.js          配置加载
  db.js              数据库结构与种子数据
  domain/            权限裁决、图片校验、ZIP 导出、永恒之链、公共链编码（keccak / ABI）
  routes/            账户与家、回忆、媒体、承诺与纪念日、永恒之链、链上存证
public/              前端单页应用（原生 JS）
  app.js             页面与路由
  wallet.js          EIP-1193 钱包连接、切链、发送前模拟、回执校验
  mainnet.js         指定网络与合约
  mainnet-panel.js   右上角钱包弹窗
  room/              3D 客厅、寻路与动作
  vendor/three/      Three.js 本地内置
contracts/           Solidity 合约源码与历史部署记录
tests/               自动化验收
docs/                发布说明、版本历史、归档资料
design/              原始计划书与 UI 设计稿
data/                运行时生成的数据库与媒体（不入库）
```

## 安全与隐私

- 身份只来自服务端会话（httpOnly Cookie）；请求体中的用户 ID 一律无效。
- 私密内容对非作者返回 404，不泄露是否存在，媒体文件同样经过鉴权。
- 撤回共享或更新内容后，相关授权立即失效。
- 写操作要求 `X-Manji-Client: 1` 请求头作为 CSRF 防线，服务端不启用 CORS。

## 未完成项

- 新公开网址尚未发布，重启后数据持久化未在线上验证。
- 本仓库缺少原网站 v4.2 的功能（如「真心话邮箱」），需要从队友的 Grok 项目导出 v4.2 代码后再合并钱包与主网功能。
- 指定合约只允许部署钱包写入。如需普通用户也能上链，需要负责人决定部署新合约或调整权限方案。
- 合约源码与指定地址的字节码尚未完成独立比对。
- 登录尚未做失败次数限制；系统推送未接入（站内提醒已实现）。

## 版本历史

见 [docs/CHANGELOG.md](docs/CHANGELOG.md)。历史文档中出现的其他合约地址只是当时的记录，不作为当前配置。
