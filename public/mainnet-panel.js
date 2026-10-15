import * as wallet from './wallet.js';
import { MAINNET, assertMainnetTarget } from './mainnet.js';

const STORAGE_KEY = 'manji.mainnet.transaction.v1';
const $ = (id) => document.getElementById(id);
let transaction = null;
let polling = false;
let pollTimer = null;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && /^0x[0-9a-f]{64}$/i.test(saved.txHash) && saved.contract?.toLowerCase() === MAINNET.contract.toLowerCase()) transaction = saved;
} catch { /* 浏览器可禁用存储，当前页面仍可展示回执 */ }

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(transaction)); } catch { /* 无存储权限 */ }
}

export function transactionForAnchor(anchorId) {
  return transaction?.anchorId === anchorId && transaction.status !== 'failed' ? transaction : null;
}

export function trackTransaction(record) {
  transaction = { ...record, contract: MAINNET.contract, status: 'pending', sentAt: Date.now() };
  save();
  renderTransaction();
  pollTransaction();
}

function renderTransaction() {
  const box = $('mn-transaction');
  if (!box || !transaction) return;
  box.hidden = false;
  box.replaceChildren();
  const text = document.createElement('p');
  text.textContent = transaction.status === 'confirmed' ? '交易执行成功 · BOT Chain 主网' : transaction.status === 'failed' ? '交易执行失败，未完成本次存证' : '交易已广播，等待主网确认（尚未成功）';
  text.className = transaction.status === 'confirmed' ? 'mn-success' : transaction.status === 'failed' ? 'mn-error' : '';
  const link = document.createElement('a');
  link.href = `${MAINNET.explorer}/tx/${transaction.txHash}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = transaction.txHash + ' ↗';
  box.append(text, link);
  const refresh = document.createElement('button');
  refresh.textContent = '查询回执';
  refresh.onclick = async () => {
    try {
      if (!wallet.isConnected()) await wallet.connect();
      await wallet.ensureChain();
      await pollTransaction();
    } catch (e) { $('mn-message').textContent = e.message; }
  };
  box.append(document.createTextNode(' '), refresh);
  if (transaction.syncError && transaction.anchorId) {
    const message = document.createElement('p');
    message.textContent = '交易 Hash 已保存，但应用记录同步失败。请登录原账号后重新关联，勿重复发送交易。';
    const retry = document.createElement('button');
    retry.textContent = '重新关联交易';
    retry.onclick = async () => {
      retry.disabled = true;
      try {
        const res = await fetch(`/api/chain/onchain/${encodeURIComponent(transaction.anchorId)}/bind`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Manji-Client': '1' },
          body: JSON.stringify({ txHash: transaction.txHash }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || '同步失败，请确认当前登录账号');
        transaction.syncError = false;
        save(); renderTransaction();
      } catch (e) { message.textContent = e.message; }
      finally { retry.disabled = false; }
    };
    box.append(message, retry);
  }
}

async function pollTransaction() {
  clearTimeout(pollTimer);
  if (polling || !transaction || !wallet.isConnected() || !wallet.onRightChain()) return;
  polling = true;
  const hash = transaction.txHash;
  try {
    const receipt = await wallet.getReceipt(hash);
    if (!transaction || transaction.txHash !== hash) return;
    if (receipt) {
      const targetMatches = receipt.to?.toLowerCase() === MAINNET.contract.toLowerCase();
      transaction.status = targetMatches && BigInt(receipt.status || 0) === 1n ? 'confirmed' : 'failed';
      save(); renderTransaction();
    }
  } catch (e) {
    $('mn-message').textContent = `回执查询暂不可用：${e.message}。交易 Hash 已保留，可点浏览器链接核验。`;
  } finally {
    polling = false;
    if (transaction?.txHash === hash && transaction.status === 'pending' && Date.now() - transaction.sentAt < 180_000) {
      pollTimer = setTimeout(pollTransaction, 6000);
    }
  }
}

function renderWallet() {
  const status = $('mn-wallet-state');
  if (!status) return;
  const connected = wallet.isConnected();
  status.textContent = connected ? `${wallet.wallet.address.slice(0, 6)}…${wallet.wallet.address.slice(-4)} · ${wallet.onRightChain() ? 'BOT 主网 677' : '请切换主网'}` : '支持 MetaMask / OKX Wallet';
  $('mn-connect').hidden = connected;
  $('mn-disconnect').hidden = !connected;
  $('mn-switch').hidden = !connected || wallet.onRightChain();
  const select = $('mn-provider');
  const previous = select.value;
  select.replaceChildren();
  for (const provider of wallet.listProviders()) {
    const option = document.createElement('option');
    option.value = provider.id; option.textContent = provider.name; select.append(option);
  }
  if ([...select.options].some((o) => o.value === previous)) select.value = previous;
  select.hidden = connected || !select.options.length;
}

export function mountMainnetPanel() {
  const root = $('mainnet-entry');
  if (!root) return;
  root.innerHTML = `<div class="mn-row"><strong>BOT Chain 主网 · 677</strong>
    <select id="mn-provider" aria-label="选择钱包"></select>
    <button class="mn-primary" id="mn-connect">连接钱包 / Connect Wallet</button>
    <button id="mn-switch" hidden>切换 BOT 主网</button><button id="mn-disconnect" hidden>断开</button>
    <a href="#/chain">主网存证 →</a></div>
    <div id="mn-wallet-state"></div>
    <details><summary>合约地址与交易说明</summary>
      <a class="mn-address" href="${MAINNET.explorer}/address/${MAINNET.contract}" target="_blank" rel="noopener noreferrer">${MAINNET.contract} ↗</a>
      <p>在日记或约定中先完成本地存证，再选择「提交到 BOT 主网」。交易由你的钱包确认，需要少量 BOT 支付 Gas；链上只保存内容哈希，钱包地址公开。</p>
      <p>合约是否允许当前钱包写入，会在发送前模拟检查。若权限受限，连接钱包本身不会获得写入权限。</p>
      <a href="#/verify">公开核验存证</a>
    </details><p id="mn-config" role="status">正在核对服务端配置…</p>
    <p id="mn-message" class="mn-error" role="status" aria-live="polite"></p>
    <div id="mn-transaction" aria-live="polite" hidden></div>`;
  const run = async (button, action) => {
    button.disabled = true; $('mn-message').textContent = '';
    try { await action(); } catch (e) { $('mn-message').textContent = Number(e.code) === 4001 ? '你取消了钱包操作，可以稍后重试。' : e.message; }
    finally { button.disabled = false; renderWallet(); }
  };
  $('mn-connect').onclick = () => run($('mn-connect'), async () => {
    if ($('mn-provider').value) wallet.selectProvider($('mn-provider').value);
    await wallet.connect(); await wallet.ensureChain(); pollTransaction();
  });
  $('mn-switch').onclick = () => run($('mn-switch'), () => wallet.ensureChain());
  $('mn-disconnect').onclick = wallet.disconnect;
  wallet.onWalletChange(() => { renderWallet(); pollTransaction(); });
  renderWallet(); renderTransaction();
  fetch('/api/public/onchain/config', { signal: AbortSignal.timeout(8000) })
    .then(async (res) => { if (!res.ok) throw new Error(`配置接口返回 ${res.status}`); return res.json(); })
    .then(({ data }) => {
      assertMainnetTarget(data);
      if (!data.configured) throw new Error('后端未启用主网存证');
      $('mn-config').textContent = '服务端已配置指定合约 · 实际写入权限需钱包模拟核验';
    })
    .catch((e) => { $('mn-config').textContent = `主网服务暂不可用：${e.message}。钱包入口仍可使用；请部署配套后端。`; $('mn-config').className = 'mn-error'; });
}
