// 本项目指定的部署地址。更换地址必须同时核对后端配置和链上权限。
export const MAINNET = Object.freeze({
  chainId: 677,
  chainIdHex: '0x2a5',
  contract: '0xDf6d55959BD6abCdE5750D800F782637115b672D',
  rpc: 'https://rpc.botchain.ai',
  explorer: 'https://scan.botchain.ai',
});

export function assertMainnetTarget({ chainId, contract }) {
  if (Number(chainId) !== MAINNET.chainId || String(contract).toLowerCase() !== MAINNET.contract.toLowerCase()) {
    throw new Error('服务器链配置与慢记指定合约不一致，已停止交易。请联系部署者检查 ONCHAIN_CHAIN_ID / ONCHAIN_CONTRACT。');
  }
}
