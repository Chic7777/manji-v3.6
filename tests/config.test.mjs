import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('环境变量优先级：平台 > .env.local > .env > 项目主网默认值', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'manji-config-'));
  mkdirSync(path.join(dir, 'server')); mkdirSync(path.join(dir, 'public'));
  copyFileSync(new URL('../server/config.js', import.meta.url), path.join(dir, 'server/config.js'));
  copyFileSync(new URL('../public/mainnet.js', import.meta.url), path.join(dir, 'public/mainnet.js'));
  writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const env = { ...process.env }; for (const key of Object.keys(env)) if (key.startsWith('ONCHAIN_')) delete env[key];
  const read = (extra = {}) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `import {config} from ${JSON.stringify(pathToFileURL(path.join(dir, 'server/config.js')).href)}; console.log(JSON.stringify(config.onchain));`], { env: { ...env, ...extra }, encoding: 'utf8', windowsHide: true }));
  try {
    assert.equal(read().chainId, 677);
    writeFileSync(path.join(dir, '.env'), 'ONCHAIN_CHAIN_ID=968\nONCHAIN_CONTRACT=\n');
    assert.equal(read().chainId, 968);
    writeFileSync(path.join(dir, '.env.local'), 'ONCHAIN_CHAIN_ID="677"\nONCHAIN_CONTRACT=0xDf6d55959BD6abCdE5750D800F782637115b672D\n');
    assert.equal(read().chainId, 677); assert.match(read().contract, /^0xdf6d/);
    assert.equal(read({ ONCHAIN_CHAIN_ID: '968' }).chainId, 968);
  } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
