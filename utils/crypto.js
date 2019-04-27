const {dposOffline} = require('dpos-offline');
const {Rise} = dposOffline;
const tweetnacl = require('tweetnacl');

module.exports.generateWallet = function () {
  let {publicKey, secretKey} = tweetnacl.sign.keyPair();
  return {
    privateKey: Buffer.from(secretKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
    address: Rise.calcAddress(publicKey)
  };
};
