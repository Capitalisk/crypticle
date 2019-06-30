const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const BitcoinClient = require('bitcoin-core');


class BitcoinAdapter {
  constructor(options) {
    /**
     * Bitcoin client instance
     * @type {Client}
     */
    this.client = new BitcoinClient({ network: 'testnet', host: nodeAddress });
  }

  async generateWallet() {
    const mnemonic = bip39.generateMnemonic();
    const seed = await bip39.mnemonicToSeed(mnemonic)
    const root = bip32.fromSeed(seed)

    /**
     * Derivation path compatible with BIP44.
     * Generates a BIP44, bitcoin testnet, account 0, external address
     * @type {BIP32Interface}
     */
    const child = root.derivePath("m/44'/1'/0'/0/0");

    const { address } = bitcoin.payments.p2pkh({
      pubkey: child.publicKey,
    });

    return {
      passphrase: mnemonic,
      privateKey: child.toWIF(),
      publicKey: Buffer.from(child.publicKey).toString('hex'),
      address,
    };
  }

  async fetchHeight() {
    this.client.command('getchaintips');
  }

  // offset is the block height from which to start fetching.
  // limit is the number of blocks to fetch.
  async fetchBlocks(options) {

  }

  async fetchTransaction(transactionId) {

  }

  async fetchWalletBalance(walletAddress) {

  }

  signTransaction(transaction, passphrase) {

  }

  async sendTransaction(signedTransaction) {

  }

  async fetchFees(transaction) {

  }
}

module.exports = BitcoinAdapter;

