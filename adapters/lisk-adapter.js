const LiskPassphrase = require('@liskhq/lisk-passphrase');
const LiskCryptography = require('@liskhq/lisk-cryptography');
const { APIClient: LiskApiClient } = require('@liskhq/lisk-api-client');
const LiskTransactions = require('@liskhq/lisk-transactions');

class LiskAdapter {

  constructor() {
    this.client = LiskApiClient.createMainnetAPIClient();
  }

  async generateWallet() {
    const passphrase = LiskPassphrase.Mnemonic.generateMnemonic();

    const { publicKey, privateKey } = LiskCryptography.getPrivateAndPublicKeyFromPassphrase(passphrase);
    const address = LiskCryptography.getAddressFromPublicKey(publicKey);

    return {
      passphrase,
      privateKey: Buffer.from(privateKey).toString('hex'),
      publicKey: Buffer.from(publicKey).toString('hex'),
      address,
    };
  }

  async fetchHeight() {
    return (await this.client.node.getStatus()).data.networkHeight;
  }

  async fetchBlocks(queryParams) {
    return (await this.client.blocks.get(queryParams)).data;
  }

  async fetchTransaction(transactionId) {
    return (await this.client.transactions.get({id: transactionId})).data;
  }

  async fetchWalletBalance(walletAddress) {
    return (await this.client.accounts.get({address: walletAddress})).data[0].balance;
  }

  signTransaction(transaction, passphrase) {
    return LiskTransactions.signTransaction(transaction, passphrase);
  }

  async sendTransaction(signedTransaction) {
    return this.client.transactions.broadcast(signedTransaction);
  }

  async fetchFees() {
    return LiskTransactions.constants.TRANSFER_FEE.toString();
  }
}

module.exports = LiskAdapter;
