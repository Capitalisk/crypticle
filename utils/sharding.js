const scHasher = require('sc-hasher');
const crypto = require('crypto');

const MAX_SHARD_KEY = Math.pow(2, 30);

function getShardKey(key) {
  let cryptoHasher = crypto.createHash('md5');
  cryptoHasher.update(key);
  let baseHash = cryptoHasher.digest('hex');
  return scHasher.hash(baseHash, MAX_SHARD_KEY);
}

function getShardRange(shardIndex, shardCount) {
  let shardSize = MAX_SHARD_KEY / shardCount;
  let shardStart = shardIndex * shardSize;
  return {
    start: shardStart,
    end: shardStart + shardSize
  };
}

module.exports = {
  getShardKey,
  getShardRange
};
