const fs = require('fs');
const path = require('path');
const util = require('util');
const rise = require('risejs').rise;
const AsyncStreamEmitter = require('async-stream-emitter');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const STATE_FILE_PATH = path.resolve(__dirname, '..', 'state.json');

class BlockchainService extends AsyncStreamEmitter {
  constructor(options) {
    super();

    this.nodeWalletAddress = options.nodeInfo.nodeWalletAddress;
    this.requiredBlockConfirmations = options.nodeInfo.requiredBlockConfirmations; // TODO 2: Use this for settlement.
    this.accountService = options.accountService;
    this.blockPollInterval = options.blockPollInterval;
    this.nodeAddress = options.nodeAddress;
    rise.nodeAddress = options.nodeAddress;
    this.blockFetchLimit = options.blockFetchLimit;
    this.sync = options.sync;

    if (this.sync) {
      this.startSynching();
    }
  }

  async processNextBlocks() {
    let state = JSON.parse(
      await readFile(STATE_FILE_PATH, {
        encoding: 'utf8'
      })
    );
    let {syncFromBlockHeight} = state;

    let heightResult;

    try {
      heightResult = await rise.blocks.getHeight();
    } catch (error) {
      this.emit('error', {error});
      return false;
    }
    let {height} = heightResult;

    let blocksResult;
    let lastTargetBlockHeight = syncFromBlockHeight + this.blockFetchLimit;
    let safeHeightDiff = lastTargetBlockHeight - height;
    if (safeHeightDiff < 0) {
      safeHeightDiff = 0;
    }

    if (syncFromBlockHeight >= height) {
      return true;
    }

    this.emit('processBlocks', {
      syncFromBlockHeight
    });

    try {
      blocksResult = await rise.blocks.getBlocks({
        orderBy: 'height:asc',
        offset: syncFromBlockHeight,
        limit: this.blockFetchLimit - safeHeightDiff
      });
    } catch (error) {
      this.emit('error', {error});
      return false;
    }

    let blocks = blocksResult.blocks || [];

    let blockCount = blocks.length;
    for (let i = 0; i < blockCount; i++) {
      let block = blocks[i];
      let transactionCount = block.transactions.length;
      for (let j = 0; j < transactionCount; j++) {
        await this.processDepositTransaction(block.transactions[j]);
      }
    }

    let lastBlock = blocks[blocks.length - 1];
    if (lastBlock) {
      syncFromBlockHeight = lastBlock.height;
    }

    await writeFile(
      STATE_FILE_PATH,
      JSON.stringify(
        {
          ...state,
          syncFromBlockHeight
        },
        ' ',
        2
      )
    );

    return safeHeightDiff > 0;
  }

  async processDepositTransaction(blockchainTransaction) {
    if (blockchainTransaction.recipientId === this.nodeWalletAddress) {
      await this.accountService.execDepositTransaction(blockchainTransaction);
    }
  }

  async startSynching() {
    // Catch up to the latest height.
    while (true) {
      let done;
      try {
        done = await this.processNextBlocks();
      } catch (error) {
        this.emit('error', {error});
      }
      if (done) break;
    }

    if (this._intervalRef != null) {
      clearInterval(this._intervalRef);
    }
    // Sync block by block.
    this._intervalRef = setInterval(async () => {
      try {
        await this.processNextBlocks();
      } catch (error) {
        this.emit('error', {error});
      }
    }, this.blockPollInterval);
  }
}

module.exports = BlockchainService;
