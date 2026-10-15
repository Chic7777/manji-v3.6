import * as wallet from './wallet.js';
import { MAINNET } from './mainnet.js';

const STORAGE_KEY = 'manji.mainnet.transaction.v1';
const $ = (id) => document.getElementById(id);
let transaction = null;
let polling = false;
let pollTimer = null;
let connectionBusy = false;
let pendingProvider = '';

const walletIcons = {
  metamask: '<svg viewBox="0 0 40 40" aria-hidden="true"><path fill="#E17726" d="m5 7 12 9-3 8-8-3zM35 7l-12 9 3 8 8-3z"/><path fill="#F6851B" d="m8 17 12-5 12 5-3 15-9 5-9-5z"/><path fill="#763D16" d="m12 24 6 2-4 3zM28 24l-6 2 4 3z"/><path fill="#E27625" d="m20 12-3 13 3 6 3-6z"/><path fill="#C0AD9E" d="m14 30 6 2 6-2-2 5h-8z"/></svg>',
  okx: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="3" width="34" height="34" rx="10" fill="#171917"/><path fill="#fff" d="M10 10h6v6h-6zm14 0h6v6h-6zm-7 7h6v6h-6zm-7 7h6v6h-6zm14 0h6v6h-6z"/></svg>',
  tokenpocket: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="3" width="34" height="34" rx="10" fill="#2980F0"/><path fill="#fff" d="M9 12h15v5h-5v13h-5V17H9zm14 7h4a5 5 0 0 1 0 10h-4v-4h4a1 1 0 0 0 0-2h-4z"/></svg>',
  other: '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="6" y="10" width="28" height="22" rx="6" stroke="currentColor" stroke-width="2"/><path d="m9 10 17-5v5m0 9h9v8h-9a4 4 0 0 1 0-8Z" stroke="currentColor" stroke-width="2"/><circle cx="28" cy="23" r="1" fill="currentColor"/></svg>',
};

function providerBrand(p) {
  const name = p.name.toLowerCase();
  if (/okx|okex/.test(name) || p.provider.isOkxWallet || p.provider.isOKExWallet) return 'okx';
  if (/metamask/.test(name) || p.provider.isMetaMask) return 'metamask';
  if (/tokenpocket/.test(name) || p.provider.isTokenPocket) return 'tokenpocket';
  return 'other';
}
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
  document.getElementById('wallet-dialog')?.showModal();
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
  if (!$('mn-wallet-picker')) return;
  const connected = wallet.isConnected();
  $('wallet-dialog-title').textContent = connected ? '我的钱包' : '连接钱包';
  $('mn-wallet-picker').hidden = connected;
  $('mn-account').hidden = !connected;
  $('mn-wallet-state').textContent = connected ? `${wallet.wallet.address.slice(0, 6)}…${wallet.wallet.address.slice(-4)}` : '';
  $('mn-network').textContent = wallet.onRightChain() ? 'BOT Chain' : '待切换网络';
  $('mn-disconnect').hidden = !connected;
  $('mn-switch').hidden = !connected || wallet.onRightChain();
  const list = $('mn-wallet-picker');
  list.replaceChildren();
  const providers = wallet.listProviders();
  const choices = [
    { brand: 'metamask', name: 'MetaMask' },
    { brand: 'okx', name: 'OKX Wallet' },
    { brand: 'tokenpocket', name: 'TokenPocket' },
  ];
  for (const p of providers.filter((p) => providerBrand(p) === 'other')) {
    choices.push({ brand: 'other', name: p.name, provider: p });
  }
  for (const choice of choices) {
    const p = choice.provider || providers.find((p) => providerBrand(p) === choice.brand);
    const button = document.createElement('button');
    button.className = 'mn-wallet-choice';
    button.type = 'button';
    button.disabled = !p || connectionBusy;
    const icon = document.createElement('span');
    icon.className = `mn-wallet-icon mn-icon-${choice.brand}`;
    icon.innerHTML = walletIcons[choice.brand];
    const name = document.createElement('span');
    name.className = 'mn-wallet-name'; name.textContent = choice.name;
    const state = document.createElement('span');
    state.className = 'mn-wallet-hint';
    state.textContent = !p ? '未安装' : pendingProvider === p.id ? '等待授权…' : '↗';
    button.append(icon, name, state);
    if (p) button.onclick = async () => {
      if (connectionBusy) return;
      connectionBusy = true; pendingProvider = p.id;
      $('mn-message').textContent = ''; renderWallet();
      try {
        wallet.selectProvider(p.id);
        await wallet.connect();
        await wallet.ensureChain();
        pollTransaction();
        $('wallet-dialog').close();
      } catch (e) {
        $('mn-message').textContent = Number(e.code) === 4001 ? '已取消连接' : Number(e.code) === -32002 ? '请在钱包窗口完成授权' : e.message;
      } finally {
        connectionBusy = false; pendingProvider = ''; renderWallet();
      }
    };
    list.append(button);
  }
}

export function mountMainnetPanel() {
  const root = $('mainnet-entry');
  if (!root) return;
  const dialog = $('wallet-dialog');
  $('wallet-dialog-close').onclick = () => dialog.close();
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-wallet]')) { renderWallet(); dialog.showModal(); }
    if (event.target.closest('#mainnet-entry a[href^="#/"]')) dialog.close();
  });
  window.addEventListener('hashchange', () => dialog.close());
  const updateLaunchers = () => {
    for (const el of document.querySelectorAll('[data-open-wallet]')) {
      el.textContent = wallet.isConnected() ? `${wallet.wallet.address.slice(0, 6)}…${wallet.wallet.address.slice(-4)}` : '连接钱包';
    }
  };
  root.innerHTML = `<div id="mn-wallet-picker" class="mn-wallet-picker" aria-label="选择钱包"></div>
    <div id="mn-account" hidden>
      <div class="mn-account-badge" aria-hidden="true">✳</div>
      <div id="mn-wallet-state" class="mn-account-address"></div>
      <div class="mn-account-network"><span></span><span id="mn-network">BOT Chain</span></div>
      <div class="mn-account-actions"><a href="#/chain">我的存证 ↗</a><button type="button" id="mn-switch" hidden>切换网络</button><button type="button" id="mn-disconnect" hidden>断开连接</button></div>
      <div class="mn-account-links"><a href="${MAINNET.explorer}/address/${MAINNET.contract}" target="_blank" rel="noopener noreferrer">查看合约 ↗</a><a href="#/verify">核验存证 ↗</a></div>
    </div>
    <p id="mn-message" class="mn-error" role="status" aria-live="polite"></p>
    <div id="mn-transaction" aria-live="polite" hidden></div>`;
  const run = async (button, action) => {
    button.disabled = true; $('mn-message').textContent = '';
    try { await action(); } catch (e) { $('mn-message').textContent = Number(e.code) === 4001 ? '你取消了钱包操作，可以稍后重试。' : e.message; }
    finally { button.disabled = false; renderWallet(); }
  };
  $('mn-switch').onclick = () => run($('mn-switch'), () => wallet.ensureChain());
  $('mn-disconnect').onclick = wallet.disconnect;
  wallet.onWalletChange(() => { renderWallet(); updateLaunchers(); pollTransaction(); });
  renderWallet(); renderTransaction();
}
