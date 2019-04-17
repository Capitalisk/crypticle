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
    this.accountService = options.accountService;
    this.blockPollInterval = options.blockPollInterval;
    this.nodeAddress = options.nodeAddress;
    rise.nodeAddress = options.nodeAddress;
    this.blockFetchLimit = options.blockFetchLimit;
    this.blockFinality = options.blockFinality;
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
    let maxSafeHeight = height - this.blockFinality;

    let blocksResult;
    let lastTargetBlockHeight = syncFromBlockHeight + this.blockFetchLimit;
    let safeHeightDiff = lastTargetBlockHeight - maxSafeHeight;
    if (safeHeightDiff < 0) {
      safeHeightDiff = 0;
    }

    if (syncFromBlockHeight >= maxSafeHeight) {
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
        try {
          await this.processTransaction(block.transactions[j]);
        } catch (error) {
          this.emit('error', {error});
        }
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

  async processTransaction(blockchainTransaction) {
    if (blockchainTransaction.recipientId === this.nodeWalletAddress) {
      let account = await this.accountService.verifyWalletAndFetchAccount(blockchainTransaction);

      let transaction = {
        accountId: account.id,
        type: 'deposit',
        referenceId: blockchainTransaction.id,
        amount: blockchainTransaction.amount
      };

      await this.accountService.execTransaction(transaction);
    }
  }

  async startSynching() {
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
