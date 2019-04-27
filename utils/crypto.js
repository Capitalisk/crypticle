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

module.exports.generateWallet = function () {
  const passphrase = bip39.generateMnemonic();
  // const hexSeed = bip39.mnemonicToSeedHex(passphrase);
  const hashedSeed = hashSha256(passphrase);

  let {publicKey, secretKey} = tweetnacl.sign.keyPair.fromSeed(hashedSeed);
  return {
    passphrase,
    privateKey: Buffer.from(secretKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
    address: Rise.calcAddress(publicKey)
  };
};
