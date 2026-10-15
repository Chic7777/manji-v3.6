// 慢记 Manji v3.6 —— BOT Chain 主网钱包直连模块
// 零依赖的 EIP-1193 封装：适配 MetaMask / OKX / TokenPocket 等注入 window.ethereum 的浏览器钱包。
// 职责：连接账户、切换/添加 BOT Chain 主网（链 677）、用用户钱包直发合约交易与 BOT 原生转账、经钱包 RPC 做只读 eth_call。
// 私钥与签名完全在钱包内完成；本模块只发起请求，不接触任何机密。
export const CHAIN_ID_DEC = 677;
export const BOT_CHAIN_PARAMS = {
  chainId: '0x2a5', // 677
  chainName: 'BOT Chain Mainnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: ['https://rpc.botchain.ai'],
  blockExplorerUrls: ['https://scan.botchain.ai'],
};

export const wallet = {
  provider: null,
  address: null,
  chainId: null,
};

const listeners = new Set();
const boundProviders = new WeakSet();
const discovered = new Map();
let selectedProvider = null;
const normalizeChain = (id) => { try { return '0x' + BigInt(id).toString(16); } catch { return null; } };

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('eip6963:announceProvider', (event) => {
    const { info, provider } = event.detail || {};
    if (info?.uuid && provider?.request) {
      discovered.set(info.uuid, { id: info.uuid, name: String(info.name || '浏览器钱包'), provider });
      notify();
    }
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

export function listProviders() {
  const result = [...discovered.values()];
  const eth = window.ethereum;
  const injected = [...(eth?.providers || (eth ? [eth] : [])), window.okxwallet].filter(Boolean);
  for (const p of injected) {
    if (!p.request || result.some((r) => r.provider === p)) continue;
    result.push({ id: `injected-${result.length}`, name: p.isOkxWallet || p.isOKExWallet ? 'OKX Wallet' : p.isMetaMask ? 'MetaMask' : p.isTokenPocket ? 'TokenPocket' : '浏览器钱包', provider: p });
  }
  return result;
}

export function selectProvider(id) {
  if (wallet.address) throw new Error('请先断开当前钱包，再选择另一个钱包');
  const item = listProviders().find((p) => p.id === id);
  if (!item) throw new Error('未找到所选钱包，请刷新后重试');
  selectedProvider = item.provider;
}

export function disconnect() {
  wallet.provider = null;
  wallet.address = null;
  wallet.chainId = null;
  selectedProvider = null;
  notify();
}

/** 多钱包同时注入时 ethereum.providers 是数组；优先挑常见钱包，否则取第一个 */
export function detectProvider() {
  return selectedProvider || listProviders()[0]?.provider || null;
}

export const hasWallet = () => !!detectProvider();
export const isConnected = () => !!wallet.address;
export const onRightChain = () => wallet.chainId === BOT_CHAIN_PARAMS.chainId;

function notify() {
  for (const fn of listeners) {
    try { fn({ ...wallet }); } catch { /* 监听方异常不影响其他监听 */ }
  }
}

export function onWalletChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function bindEvents(p) {
  if (boundProviders.has(p) || !p.on) return;
  boundProviders.add(p);
  p.on('accountsChanged', (accs) => {
    if (wallet.provider !== p) return;
    wallet.address = (accs && accs[0]) || null;
    notify();
  });
  p.on('chainChanged', (cid) => {
    if (wallet.provider !== p) return;
    wallet.chainId = normalizeChain(cid);
    notify();
  });
  p.on('disconnect', () => { if (wallet.provider === p) disconnect(); });
}

/** 请求连接钱包账户（会弹钱包授权框），成功后记录地址与当前链 */
export async function connect() {
  const p = detectProvider();
  if (!p) {
    throw new Error('未检测到浏览器钱包：请先安装 MetaMask / OKX 等插件，或用钱包 App 的内置浏览器打开慢记');
  }
  const accounts = await p.request({ method: 'eth_requestAccounts' });
  if (!accounts?.[0]) throw new Error('钱包没有授权账户，请在钱包中解锁并允许连接');
  wallet.provider = p;
  wallet.address = (accounts && accounts[0]) || null;
  wallet.chainId = normalizeChain(await p.request({ method: 'eth_chainId' }).catch(() => null));
  bindEvents(p);
  notify();
  return wallet.address;
}

/** 切到 BOT Chain 主网；钱包里没有这条链时先添加（wallet_addEthereumChain） */
export async function ensureChain() {
  const p = wallet.provider || detectProvider();
  if (!p) throw new Error('钱包未连接');
  wallet.chainId = normalizeChain(await p.request({ method: 'eth_chainId' }));
  if (onRightChain()) return true;
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BOT_CHAIN_PARAMS.chainId }] });
  } catch (err) {
    const addable = err && (Number(err.code) === 4902 || Number(err.data?.originalError?.code) === 4902 || /Unrecognized chain/i.test(err.message || ''));
    if (!addable) throw err;
    await p.request({ method: 'wallet_addEthereumChain', params: [BOT_CHAIN_PARAMS] });
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BOT_CHAIN_PARAMS.chainId }] });
  }
  wallet.chainId = normalizeChain(await p.request({ method: 'eth_chainId' }));
  notify();
  if (!onRightChain()) throw new Error('钱包尚未切到 BOT Chain 主网（677），已停止交易');
  return true;
}

/** 用户钱包直发交易——页面 C 端写入 BOT 主网的核心一步：合约调用带 data；原生转账（如给小狗 BOT 打赏）只带 value（hex wei 字符串）。按需组装，旧调用不变 */
export async function sendTx({ to, data, from, value }) {
  if (!wallet.provider || !wallet.address) throw new Error('钱包未连接');
  await ensureChain();
  const accounts = await wallet.provider.request({ method: 'eth_accounts' });
  if (!accounts?.[0] || accounts[0].toLowerCase() !== wallet.address.toLowerCase()) throw new Error('钱包账户已变化，请重新连接后再提交');
  if (from && from.toLowerCase() !== wallet.address.toLowerCase()) throw new Error('交易发起者必须是当前连接的钱包');
  const params = { from: wallet.address, to, chainId: BOT_CHAIN_PARAMS.chainId };
  if (data) params.data = data;
  if (value) params.value = value;
  const hash = await wallet.provider.request({ method: 'eth_sendTransaction', params: [params] });
  if (!/^0x[0-9a-f]{64}$/i.test(hash || '')) throw new Error('钱包未返回有效交易 Hash，请先在钱包中检查交易记录，勿重复发送');
  return hash;
}

/** 经用户钱包的 RPC 做只读调用（sealOf 核验：独立于慢记后端的链上直读） */
export async function ethCall({ to, data }) {
  if (!wallet.provider) throw new Error('钱包未连接');
  await ensureChain();
  return await wallet.provider.request({ method: 'eth_call', params: [{ from: wallet.address, to, data }, 'latest'] });
}

/** 通过钱包 RPC 查交易回执（未上块返回 null） */
export async function getReceipt(txHash) {
  if (!wallet.provider) throw new Error('钱包未连接');
  if (!onRightChain()) throw new Error('请先切回 BOT Chain 主网再查询交易');
  return await wallet.provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
}

// 在签名之前只读模拟同一笔调用，能识别旧合约的权限限制；不会产生链上交易。
export async function preflight({ to, data }) {
  if (!wallet.provider || !wallet.address) throw new Error('钱包未连接');
  await ensureChain();
  const code = await wallet.provider.request({ method: 'eth_getCode', params: [to, 'latest'] });
  if (!code || /^0x0*$/i.test(code)) throw new Error('BOT 主网上未读取到指定地址的合约代码，已停止交易');
  try {
    await wallet.provider.request({ method: 'eth_call', params: [{ from: wallet.address, to, data }, 'latest'] });
  } catch (e) {
    const message = String(e?.message || '');
    const reverted = Number(e?.code) === 3 || /revert|Unauthorized|execution error/i.test(message);
    throw new Error(reverted
      ? '指定合约拒绝了这笔调用，可能限制了当前钱包的写入权限，或这条承诺已经登记。未发送交易；请核对合约权限和存证状态。'
      : `无法完成交易模拟，未发送交易：${message}`);
  }
}
