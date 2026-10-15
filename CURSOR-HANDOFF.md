# 慢记 Manji：Cursor 继续工作提示词

把下面这段直接交给 Cursor Agent。请先用 Cursor 打开 `D:\codexfile\creation\manji\app`，这是实际 Git 仓库；上一级的 review-source、source、live-app.js 等是先前审查材料，不是当前源码。

---

你接手的是现有慢记 Manji 项目，请先检查代码和 git 状态，再继续工作，不要从头生成或重做 UI。

## 项目信息

- 仓库：https://github.com/Chic7777/manji-v3.6 ，分支 main。
- 本地项目：D:\codexfile\creation\manji\app。
- public/ 是原生 JS 前端，server/ 是 Node.js 后端，数据库是 node:sqlite，照片存本地媒体目录。
- 建议 Node.js 24；至少需要 22.5。钱包直发路径无必需 npm 依赖。
- 启动 npm start，默认 4173；上一位助手预览使用 4179，可能仍在运行，先检查端口避免重复启动。
- Dockerfile、compose.yaml 和 docs/发布与验收.md 已提供；Docker 未实际构建验收。
- GitHub 更新不代表原网站已更新。原 manji.grok.me 发布管理入口找不到，现需协助发布新网址。

## 必须保留的设计

首页保留奶油纸色、鼠尾草绿、小狗插画、原标语和「开启我们的小家」。
不要加顶部独立钱包条，也不要恢复欢迎页链上宣传条和大说明卡片。
钱包入口已融入页面右上角；登录后导航栏也有入口。
最新钱包弹窗只显示带图标的 MetaMask、OKX Wallet、TokenPocket 选择卡片，未安装的禁用。
点击已安装钱包直接调用对应 provider 的 eth_requestAccounts，不再使用下拉框加第二个连接按钮。
连接后切换 BOT 主网，成功即关闭弹窗。重新打开可看地址、网络、存证入口和断开操作。
删除了「服务端已配置」「实际权限需模拟」等开发说明，错误只在实际发生时显示。
钱包插件窗口位置由浏览器和插件决定，不能伪造插件右侧弹窗。
主要文件 public/mainnet-panel.js、public/mainnet-panel.css、public/wallet.js、public/app.js、public/index.html。

## 指定合约及验收要求

只使用负责人指定的地址：0xDf6d55959BD6abCdE5750D800F782637115b672D。
网络：BOT Chain Mainnet；chainId=677/0x2a5；RPC=https://rpc.botchain.ai；Explorer=https://scan.botchain.ai。
public/mainnet.js 定义当前目标，前端交易前检查服务器地址与链号一致。
不要换成 0x5955… 或小狗身份合约，也不要擅自重新部署合约。
原仓库存在多个地址的混杂记录，已归档到 docs/archive/；不能把归档声明当作当前链上核验事实。
合约源码与指定地址字节码尚未独立比对；普通钱包写入权限尚未确认。
此前 RPC 和 BOTScan 超时，没有完成真实签名交易，不能声称已通过主网验收。
需检查指定地址的 VERSION/owner/relayer 和 seal(bytes32) 实际权限；可能只允许部署账户或 relayer 写入。
现有前端发送前会用当前钱包 eth_call 模拟，再由用户钱包发送交易。保留模拟失败即停止、拒绝切链即停止、账户校验、重复广播拦截和 Hash 恢复功能。
不得静默回退为服务器代发，也不得把连接成功、消息签名、本地存证或部署交易当作用户业务交易成功。
如果实际合约拒绝普通钱包，说明权限限制及可行方案，先报告负责人，再决定是否更换部署；不能靠 UI 绕过合约权限。

## 当前测试和缺口

此前已通过业务验收 101 项、本地存证链 18 项、调用数据验收 15 项、配置/钱包/回执验收 8 项、导航 21 项。
最近两次是钱包 UI 调整，做了 JS 语法和浏览器显示/开关面板检查；本次没有重新执行完整业务测试，也没有点击真实插件授权或签名。
Edge 能检测到 MetaMask；其他钱包未安装，界面显示禁用。
测试命令见 package.json；npm run test:wallet 使用模拟钱包/本机 RPC，不是主网证明。
不要运行 scripts/deploy-mainnet.mjs、scripts/relay-mainnet.mjs、tests/onchain-e2e-mainnet.mjs 等可能发真实交易的脚本，除非负责人明确授权具体操作。
不要读取/打印私钥、助记词或整份 .env；环境文件和线上数据库不在仓库。
缺口：真实插件授权流程、指定合约权限、用户成功交易、公开网址发布及重启后数据持久化。

## 接下来按顺序做

1. 确认 main 最新代码与本地一致，保留负责人未提交改动。不要执行 reset --hard 或覆盖数据。
2. 启动现有程序，确认首页没有额外说明块，钱包选择卡片显示正确；必要时修复实际错误，不扩大改动范围。
3. 协助负责人亲自完成钱包授权及交易确认。检查用户交易 From/To、receipt.status 和匹配承诺的 Sealed 事件，并记录完整 Hash/链接。
4. 优先协助通过负责人自己的 Grok Build 发布新网址。先确认当前界面是否支持导入这个项目，以及平台是否支持 Node.js 后端、node:sqlite 和持久化照片目录；不要假定 Grok 能直接托管任意现有 Node 项目。
5. 如果兼容，按实际界面导入源码、设置环境变量并发布；如果不兼容，清楚说明缺口，提出迁移或独立托管方案，涉及大改或付费时先给具体方案与费用。
6. 检查实际公开网址：前后端接口都可用，/wallet.js 返回 JS，/api/public/onchain/config 返回指定地址和链号677，重启后账号/日记/照片不丢失。
7. 最终报告已发布 URL、Git commit、完成验证项、真实业务交易 Hash；未完成项如实列出。

## 部署配置

ONCHAIN_RPC_URL=https://rpc.botchain.ai
ONCHAIN_CHAIN_ID=677
ONCHAIN_CONTRACT=0xDf6d55959BD6abCdE5750D800F782637115b672D
ONCHAIN_EXPLORER=https://scan.botchain.ai
ONCHAIN_RELAYER_KEY= （留空）
PUPPY_IDENTITY_CONTRACT= （归属未确认，留空）

配置优先级：平台环境变量 > .env.local > .env > 默认值。
数据库 DB_PATH 和媒体 MEDIA_ROOT 必须指向持久化目录，不要公开默认管理员密码。
拿不到原站数据时，新站从空数据开始，链上原有记录仍保留。

---

# 交给 Grok Build 的导入与发布提示词

我有一个已经写好的慢记 Web 应用，GitHub 仓库 https://github.com/Chic7777/manji-v3.6 ，请使用 main 最新版，先检查当前 Grok Build 环境是否支持导入已有代码、Node.js 24/至少22.5、node:sqlite，以及持久化数据库与上传照片。

若支持，请导入并运行现有项目，保留首页原 UI 和右上角钱包选择入口，部署 public/ 与 server/ 完整功能。不要生成一个仅长得相似但没有真实后端的新页面。合约固定为 BOT 主网677的 0xDf6d55959BD6abCdE5750D800F782637115b672D，不更换、不重新部署。用户钱包在页面选择后直接弹授权，成功后可发真实 seal 交易；交易必须由我亲自确认。

若环境不支持现有后端或持久化，请明确说明，列出需要适配的部分，不要声称发布完成，也不要将真实数据库改成浏览器假数据。

兼容性与功能验收通过后，使用当前界面提供的发布功能生成可公开访问的 grok.me 网址，告诉我实际 URL、数据如何持久化和后续从哪里进入项目管理。无法使用原 manji.grok.me 时请生成新地址，不要冒称控制原域名。记录尚未完成的主网权限和签名交易验收。
