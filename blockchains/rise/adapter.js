const rise = require('risejs').rise;
const {dposOffline} = require('dpos-offline');
const {Rise} = dposOffline;
const bip39 = require('bip39');
const tweetnacl = require('tweetnacl');
const crypto = require('crypto');

function hashSha256(data) {
  const dataHash = crypto.createHash('sha256');
  dataHash.update(data, 'utf8');
  return dataHash.digest();
}

class RiseAdapter {
  constructor(options) {
    rise.nodeAddress = options.nodeAddress;
  }

  async generateWallet() {
    const passphrase = bip39.generateMnemonic();
    const hashedSeed = hashSha256(passphrase);

    let {publicKey, secretKey} = tweetnacl.sign.keyPair.fromSeed(hashedSeed);
    return {
      passphrase,
      privateKey: Buffer.from(secretKey).toString('hex'),
      publicKey: Buffer.from(publicKey).toString('hex'),
      address: Rise.calcAddress(publicKey)
    };
  }

  async fetchHeight() {
    return (await rise.blocks.getHeight()).height;
  }

  // offset is the block height from which to start fetching.
  // limit is the number of blocks to fetch.
  async fetchBlocks(options) {
    let queryParams = {
      orderBy: 'height:asc',
      offset: options.offset,
      limit: options.limit
    };
    return (await rise.blocks.getBlocks(queryParams)).blocks;
  }

  async fetchTransaction(transactionId) {
    return (await rise.transactions.get(transactionId)).transaction;
  }

  async fetchWalletBalance(walletAddress) {
    return (await rise.accounts.getBalance(walletAddress)).balance;
  }

  signTransaction(transaction, passphrase) {
    return Rise.txs.createAndSign(transaction, passphrase);
  }

  async sendTransaction(signedTransaction) {
    return rise.transactions.put(signedTransaction);
  }

  async fetchFees(transaction) {
    return Rise.txs.baseFees.send.toString();
  }
}

module.exports = RiseAdapter;
