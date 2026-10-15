# 慢记 Manji 版本历史

> 以下内容从旧版 README 原样迁移。其中提到的合约地址（如 `0x5955…`、`0x9757…`、`0x9acf…`）与「任意钱包可写入」等说法是当时的记录，**不代表当前部署事实**。当前指定合约及其链上实测权限以 [README](../README.md) 为准。

## 2026-10-15

- 钱包入口融入页面右上角，钱包弹窗改为 MetaMask / OKX Wallet / TokenPocket 卡片直选。
- 指定合约固定为 `0xDf6d55959BD6abCdE5750D800F782637115b672D`（BOT Chain 主网 677）。
- 永恒之链页删去宣传与开发说明文字，小屋首页删去「我们的链上足迹」卡片；功能不变。
- 链上只读核实：该合约 `VERSION()` 为 `"1"`，`owner` 与 `relayer` 均为 `0x4844f22482b0e08dc9b44d153a723863f576b178`，其他地址调用 `seal` 会以 `Unauthorized(address)` 回退。
- 首笔真实业务交易：由部署钱包签名，交易 [`0x43a2d644…17ef0c`](https://scan.botchain.ai/tx/0x43a2d644834379e3c31a89ff3703ac625785e8e92844054ee9653a03e917ef0c)，回执成功，`Sealed` 事件承诺与日记一致，登记序号 #2。

## v3.6.x（2026-10-08 ~ 10-10）

v3.6.2（2026-10-10）登录页与首页接入**新 3D 小狗模型**（`puppy.glb`）；完成 **BOT Chain Agent OS（小狗链上身份）集成开发**（规格见 [agentos-api-spec.md](agentos-api-spec.md)）：小狗 ERC-8004 身份 NFT + ownerOf 公开核验 + BOT 打赏钱包，离线验收 9 项（`npm run test:agentos`）全过。**待官方主网 API key 启用后上线**：未配置 key 时功能如实显示「等待官方 API key」，不影响现有主流程（申请话术见 [AGENTOS-APIKEY-申请话术.md](AGENTOS-APIKEY-申请话术.md)）。

v3.6.3（2026-10-10）新增 **链上小狗身份（自托管 ManjiPuppyIdentity）**：每个家的小狗可由成员钱包直接在页面里签名铸造一枚链上身份 NFT（BOT Chain 主网合约 [`0x9acf5f…66d5`](https://scan.botchain.ai/address/0x9acf5fb43b544d4a62ee5b66d78e1d79c87466d5)）——名字写上链不可改、铸造时间即链上生日、自带可收 BOT 打赏的「存钱罐」，ownerOf 任何人可核验；ERC-8004 风格、不可转让、tokenURI 为链上自包含身份文件。官方 Agent OS 托管 API 未获批 key 的自部署替代（规格与申请话术保留在 `docs/`）。离线验收 `node tests/agentos-acceptance.mjs` 8 项（mint calldata 与 ethers ABI 逐字节锚定）。

v3.6.1（2026-10-10）**C 端钱包直连主网上线**：合约升级为 ManjiEternalChain **v2**（`0x59551d78e15ee25e512c678bfd4b6781f065f560`，部署交易 [`0x502c6f30…b1c9`](https://scan.botchain.ai/tx/0x502c6f306d86265c462d2f73ace29f329b157c1aeaaa4d83bda2706e048ab1c9)），`seal/sealBatch` 开放给任何钱包——「永恒之链」页新增 BOT Chain 主网面板：**连接钱包（EIP-1193）→ 自动切换 BOT 主网（链 677）→ 由用户自己的钱包直接签名把承诺哈希写上主网 → 展示交易哈希与浏览器链接 → sealOf 核验**；无钱包环境自动回退到服务端 relayer 代提交（自动模式）或 calldata 指引（手动模式）。任意钱包直写已在主网实测通过（普通钱包 `0xFB57…269A` 直接 seal 成功，交易 [`0x19f0035b…29f2`](https://scan.botchain.ai/tx/0x19f0035b03a29fd839ec31dcad3a559bfd72bd77877cf55fe6dc3340aaa329f2)）。评审证据见 [BOT-CHAIN-集成说明与录屏脚本.md](../BOT-CHAIN-集成说明与录屏脚本.md)。

v3.6.0（2026-10-08）新增 **日记与承诺上公共链**：本地永恒之链之外，可自愿把同一个承诺哈希提交到 **BOT Chain 主网**合约 ManjiEternalChain。链上只有内容指纹与本地链头部哈希——没有正文、照片、成员身份；合约无修改/删除/暂停/升级任何已登记数据的函数，永久 append-only。新增：提交队列与自动代提交（批量 sealBatch）、sealOf 实时核验、本地链头部 anchorHead 锚定、手动提交模式。部署与接入指南见 [contracts/DEPLOY-BOTCHAIN.md](../contracts/DEPLOY-BOTCHAIN.md)，设计说明见 [design/慢记v3.6-日记承诺上链-合约与接入设计.md](../design/慢记v3.6-日记承诺上链-合约与接入设计.md)。历史合约的部署与核验记录见 [contracts/DEPLOYED-mainnet.json](../contracts/DEPLOYED-mainnet.json)。

## v3.4.0（2026-10-08）

新增 **永恒之链**：每个小家一条独立的本地存证链，**约定与日记都可以上链**。上链保存的是内容指纹（带随机盐的哈希承诺），不是原文与身份；链只追加不修改，改掉任何一块全链校验立刻断裂并定位。共同约定须两人都点过「我也愿意」才可镌刻；内容更新可镌刻新块，旧块永存；解除关联后链条定格。新增「永恒之链」页（完整性校验/逐块时间线/存证凭证/整链导出可第三方独立复算）。新增链专项 18 项（`npm run test:chain`）。明细见 [永恒之链说明-v3.4.md](../永恒之链说明-v3.4.md)。

## v3.3.x（2026-10-08）

- v3.3.1：交互首页改为**单犬出场**；「说好的小事」更名为「说好的承诺」；三犬 GLB 更换为精细化高模；修复畸形编码请求路径导致服务崩溃的问题（改为返回 400）。
- v3.3.0：合并 ConsensusBell-V5 交互首页的空间建模与动作：3D 客厅 GLB 场景、三犬 GLB 骨骼动画、每犬 16 动作与队列、地面点选 A* 寻路 + 家具避障 + 连续碰撞检测、近看跟随视角、手机控件、Three.js 0.186.1 本地内置与 WebGL 降级。新增 `npm run test:navigation`（21 项）。明细见 [空间建模及动作说明-v3.3.md](../空间建模及动作说明-v3.3.md)，模型署名见 [MODEL-CREDITS.md](../MODEL-CREDITS.md)。

## v3.2.x（2026-10-08）

- v3.2.2：进入流程三屏 1:1 复刻（Welcome 品牌页 / 选择同伴轮播 / 创建小屋），全局切换 Claymation 色板（陶土红 #9A442D + 奶油 #FFF8F5）。
- v3.2.0：UI 整体切换到 Consensus Bell 设计系统；服务端与 API 契约零改动。明细见 [UI焕新说明-v3.2.md](../UI焕新说明-v3.2.md)。

## v3.1.1（2026-10-08）

修复实测报告确认的 15 类问题（B01–B15）及上传大图预览超出应用宽度（B16）。明细见 [修复说明-v3.1.md](../修复说明-v3.1.md)。

## v3.0（2026-10-07）

依据 2026-10-07《慢记-编程AI执行计划书》全新实现（计划书见 `design/`）。
