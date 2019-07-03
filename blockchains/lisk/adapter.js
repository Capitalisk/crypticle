const LiskPassphrase = require('@liskhq/lisk-passphrase');
const LiskCryptography = require('@liskhq/lisk-cryptography');
const { APIClient: LiskApiClient } = require('@liskhq/lisk-api-client');
const LiskTransactions = require('@liskhq/lisk-transactions');

class LiskAdapter {
  constructor(options) {
    this.client = new LiskApiClient([options.nodeAddress]);
  }

  generateWallet() {
    const passphrase = LiskPassphrase.Mnemonic.generateMnemonic();

    const { publicKey, privateKey } = LiskCryptography.getPrivateAndPublicKeyFromPassphrase(passphrase);
    const address = LiskCryptography.getAddressFromPublicKey(publicKey);

    return {
      passphrase,
      privateKey: Buffer.from(privateKey).toString('hex'),
      publicKey: Buffer.from(publicKey).toString('hex'),
      address
    };
  }

  async fetchHeight() {
    return (await this.client.node.getStatus()).data.height;
  }

  async fetchBlocks({ offset = 0, limit = 10 } = {}) {
    let queryParams = {
      sort: 'height:asc',
      offset,
      limit
    };

    return Promise.all(
        (await this.client.blocks.get(queryParams)).data.map(async (block) => {
          return {
            ...block,
            transactions: (await this.client.transactions.get({blockId: block.id})).data
          };
        })
    );
  }

  async fetchTransaction(transactionId) {
    return (await this.client.transactions.get({id: transactionId})).data[0];
  }

  async fetchWalletBalance(walletAddress) {
    return (await this.client.accounts.get({address: walletAddress})).data[0].balance;
  }

  async signTransaction(transaction, passphrase) {
    let liskTransaction = {
      type: 0,
      amount: transaction.amount,
      recipientId: transaction.recipient,
      fee: await this.fetchFees(),
      asset: {},
      senderPublicKey: LiskCryptography.getAddressAndPublicKeyFromPassphrase(passphrase).publicKey
    };
    return LiskTransactions.utils.prepareTransaction(liskTransaction, passphrase);
  }

  async sendTransaction(signedTransaction) {
    return this.client.transactions.broadcast(signedTransaction);
  }

  async fetchFees() {
    return LiskTransactions.constants.TRANSFER_FEE.toString();
  }
}

module.exports = LiskAdapter;
