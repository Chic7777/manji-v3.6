import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MAINNET } from '../public/mainnet.js';
import { keccak256 } from '../server/domain/keccak.js';

test('公开配置、登录存证、直接绑定、回执与事件严格校验', { timeout: 30000 }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'manji-wallet-api-'));
  let receipt = null;
  let commitment;
  const queriedHashes = [];
  const rpc = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const q = JSON.parse(body);
    let result = '0x' + '0'.repeat(192);
    if (q.method === 'eth_getTransactionReceipt') { queriedHashes.push(q.params[0]); result = receipt; }
    if (q.method === 'eth_call' && q.params[0].data === '0x726804ab') result = '0x0';
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: q.id, result }));
  });
  rpc.listen(0, '127.0.0.1'); await once(rpc, 'listening');
  const probe = http.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise((r) => probe.close(r));
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: new URL('..', import.meta.url), windowsHide: true,
    env: { ...process.env, PORT: String(port), DB_PATH: path.join(dir, 'test.db'), MEDIA_ROOT: path.join(dir, 'media'),
      CHAIN_DIFFICULTY: '1', ONCHAIN_CHAIN_ID: '677', ONCHAIN_CONTRACT: MAINNET.contract,
      ONCHAIN_RPC_URL: `http://127.0.0.1:${rpc.address().port}`, ONCHAIN_RELAYER_KEY: '', PUPPY_IDENTITY_CONTRACT: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = ''; child.stderr.on('data', (d) => { log += d; }); child.stdout.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  let cookie = '';
  async function request(method, url, body) {
    const res = await fetch(base + url, { method, headers: { 'X-Manji-Client': '1', 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    return { status: res.status, json: await res.json() };
  }
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + '/api/public/onchain/config')).ok) { ready = true; break; } } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(ready, log);
    const cfg = await request('GET', '/api/public/onchain/config');
    assert.equal(cfg.status, 200); assert.equal(cfg.json.data.contract, MAINNET.contract.toLowerCase());
    assert.equal(cfg.json.data.chainId, 677); assert.equal(cfg.json.data.configured, true);
    assert.equal('relayerKey' in cfg.json.data, false);
    const html = await (await fetch(base)).text(); assert.match(html, /id="mainnet-entry"/);
    assert.match(await (await fetch(base + '/wallet.js')).text(), /export async function preflight/);
    assert.equal((await request('POST', '/api/auth/register', { displayName: '钱包验收用户', password: 'wallet-test-password' })).status, 201);
    const promise = await request('POST', '/api/promises', { text: '把这一刻存证', scope: 'personal' });
    assert.equal(promise.status, 201);
    const anchor = await request('POST', '/api/chain/anchor', { type: 'promise', id: promise.json.data.promiseId });
    assert.equal(anchor.status, 201);
    const id = anchor.json.data.anchorId;
    const cd = await request('GET', `/api/chain/onchain/seal-calldata/${id}`);
    assert.equal(cd.status, 200); assert.equal(cd.json.data.chainId, 677);
    commitment = cd.json.data.commitment; assert.equal(cd.json.data.calldata, '0xb07eeda8' + commitment);
    const hash = '0x' + 'a'.repeat(64);
    const bind = await request('POST', `/api/chain/onchain/${id}/bind`, { txHash: hash });
    assert.equal(bind.status, 200); assert.equal(bind.json.data.status, 'submitted');
    assert.equal(bind.json.data.explorerUrl, `${MAINNET.explorer}/tx/${hash}`);
    assert.equal((await request('GET', `/api/chain/onchain/seal-calldata/${id}`)).status, 409);
    await request('GET', `/api/chain/onchain/verify/${id}`);
    assert.equal(queriedHashes[0], hash);
    let list = await request('GET', '/api/chain/onchain');
    assert.equal(list.json.data.items[0].status, 'submitted');
    // 成功状态但没有匹配事件，不得标成存证成功。
    receipt = { status: '0x1', to: MAINNET.contract, logs: [] };
    await request('GET', `/api/chain/onchain/verify/${id}`);
    list = await request('GET', '/api/chain/onchain'); assert.equal(list.json.data.items[0].status, 'failed');
    // 真实匹配回执才确认；事件携带登记序号与时间。
    receipt.logs = [{ address: MAINNET.contract, topics: ['0x' + keccak256('Sealed(bytes32,uint64,uint64)'), '0x' + commitment],
      data: '0x' + (7n).toString(16).padStart(64, '0') + (1700000000n).toString(16).padStart(64, '0') }];
    for (const invalid of [
      { ...receipt, status: '0x0' },
      { ...receipt, to: '0x' + 'f'.repeat(40) },
      { ...receipt, logs: [{ ...receipt.logs[0], topics: [receipt.logs[0].topics[0], '0x' + 'f'.repeat(64)] }] },
    ]) {
      const valid = receipt; receipt = invalid;
      await request('POST', `/api/chain/onchain/${id}/bind`, { txHash: hash });
      await request('GET', `/api/chain/onchain/verify/${id}`);
      assert.equal((await request('GET', '/api/chain/onchain')).json.data.items[0].status, 'failed');
      receipt = valid;
    }
    await request('POST', `/api/chain/onchain/${id}/bind`, { txHash: hash });
    await request('GET', `/api/chain/onchain/verify/${id}`);
    list = await request('GET', '/api/chain/onchain');
    assert.equal(list.json.data.items[0].status, 'confirmed'); assert.equal(list.json.data.items[0].sealIndex, 7);
  } finally {
    child.kill(); await once(child, 'exit').catch(() => {});
    await new Promise((r) => rpc.close(r));
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
