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
    return rise.blocks.getHeight();
  }

  async fetchBlocks(queryParams) {
    return rise.blocks.getBlocks(queryParams);
  }

  async fetchTransaction(transactionId) {
    return rise.transactions.get(transactionId);
  }

  async fetchWalletBalance(walletAddress) {
    return rise.accounts.getBalance(walletAddress);
  }

	signTransaction(transaction, passphrase) {
		return Rise.txs.createAndSign(transaction, passphrase);
	}

  async sendTransaction(signedTransaction) {
    return rise.transactions.put(signedTransaction);
  }

  async fetchFees(transaction) {
    return {
			success: true,
			fees: Rise.txs.baseFees.send
		};
  }
}

module.exports = RiseAdapter;
