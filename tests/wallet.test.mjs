import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = new EventTarget();
const w = await import('../public/wallet.js');
const { MAINNET, assertMainnetTarget } = await import('../public/mainnet.js');

function provider(overrides = {}) {
  let chain = '0x1';
  const events = {};
  const calls = [];
  return {
    calls, events, isMetaMask: true,
    on(name, fn) { events[name] = fn; },
    async request({ method, params }) {
      calls.push({ method, params });
      if (overrides[method]) return overrides[method](params);
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return ['0x' + 'a'.repeat(40)];
      if (method === 'eth_chainId') return chain;
      if (method === 'wallet_switchEthereumChain') { chain = params[0].chainId; return null; }
      if (method === 'eth_getCode') return '0x1234';
      if (method === 'eth_call') return '0x' + '0'.repeat(64);
      if (method === 'eth_sendTransaction') return '0x' + 'b'.repeat(64);
      return null;
    },
  };
}

test('钱包授权、切主网、模拟成功后才发送；发起者是已连接账户', async () => {
  w.disconnect(); const p = provider(); window.ethereum = p;
  await w.connect(); assert.equal(w.onRightChain(), false);
  const call = { to: MAINNET.contract, data: '0xb07eeda8' + 'c'.repeat(64) };
  await w.preflight(call);
  const hash = await w.sendTx(call);
  assert.equal(w.onRightChain(), true); assert.match(hash, /^0x[b]{64}$/);
  const sent = p.calls.find((c) => c.method === 'eth_sendTransaction');
  assert.equal(sent.params[0].from, '0x' + 'a'.repeat(40));
  assert.ok(p.calls.findIndex((c) => c.method === 'eth_call') < p.calls.indexOf(sent));
});

test('添加网络之后仍没有切到 677 必须停止', async () => {
  w.disconnect(); const p = provider({
    eth_chainId: () => '0x1', wallet_switchEthereumChain: () => null,
  }); window.ethereum = p; await w.connect();
  await assert.rejects(w.sendTx({ to: MAINNET.contract }), /尚未切到/);
  assert.equal(p.calls.some((c) => c.method === 'eth_sendTransaction'), false);
});

test('未知网络先添加再切换；拒绝切链不会被当作添加网络', async () => {
  w.disconnect(); let chain = '0x1'; let switches = 0;
  const p = provider({ eth_chainId: () => chain, wallet_switchEthereumChain: () => {
    if (++switches === 1) throw { code: 4902 }; chain = '0x2a5';
  } }); window.ethereum = p; await w.connect(); await w.ensureChain();
  assert.equal(p.calls.filter((c) => c.method === 'wallet_addEthereumChain').length, 1);
  w.disconnect(); const denied = provider({ wallet_switchEthereumChain: () => { throw { code: 4001 }; } });
  window.ethereum = denied; await w.connect(); await assert.rejects(w.ensureChain());
  assert.equal(denied.calls.some((c) => c.method === 'wallet_addEthereumChain'), false);
});

test('旧合约权限拒绝、无合约代码、RPC 故障均不会广播', async () => {
  for (const overrides of [
    { eth_call: () => { throw { code: 3, message: 'execution reverted: Unauthorized' }; } },
    { eth_getCode: () => '0x' },
    { eth_call: () => { throw new Error('RPC offline'); } },
  ]) {
    w.disconnect(); const p = provider(overrides); window.ethereum = p; await w.connect();
    await assert.rejects(w.preflight({ to: MAINNET.contract, data: '0xb07eeda8' + 'c'.repeat(64) }));
    assert.equal(p.calls.some((c) => c.method === 'eth_sendTransaction'), false);
  }
});

test('OKX 单独注入可连接，旧 provider 事件不能改写新钱包状态', async () => {
  w.disconnect(); const previous = window.ethereum;
  window.ethereum = undefined; window.okxwallet = provider(); window.okxwallet.isMetaMask = false; window.okxwallet.isOkxWallet = true;
  assert.equal(w.listProviders()[0].name, 'OKX Wallet'); await w.connect();
  previous.events.accountsChanged?.(['0x' + 'f'.repeat(40)]);
  assert.equal(w.wallet.address, '0x' + 'a'.repeat(40));
  window.okxwallet.events.chainChanged('0x02A5'); assert.equal(w.onRightChain(), true);
  window.okxwallet.events.accountsChanged([]); assert.equal(w.isConnected(), false);
  w.disconnect(); window.okxwallet = undefined;
});

test('钱包账户变更及后端合约不一致必须停止交易', async () => {
  w.disconnect(); const p = provider({ eth_accounts: () => ['0x' + 'f'.repeat(40)] }); window.ethereum = p;
  await w.connect(); await assert.rejects(w.sendTx({ to: MAINNET.contract }), /账户已变化/);
  assert.equal(p.calls.some((c) => c.method === 'eth_sendTransaction'), false);
  assert.throws(() => assertMainnetTarget({ chainId: 968, contract: MAINNET.contract }), /配置/);
  assert.throws(() => assertMainnetTarget({ chainId: 677, contract: '0x' + '1'.repeat(40) }), /配置/);
  assertMainnetTarget({ chainId: '677', contract: MAINNET.contract.toLowerCase() });
  w.disconnect();
});
