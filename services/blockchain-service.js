const fs = require('fs');
const path = require('path');
const util = require('util');
const rise = require('risejs').rise;
const AsyncStreamEmitter = require('async-stream-emitter');
const WritableConsumableStream = require('writable-consumable-stream');
const {createSignedTransaction, fees} = require('../utils/blockchain');
const {getShardKey, getShardRange} = require('../utils/sharding');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const STATE_FILE_PATH = path.resolve(__dirname, '..', 'state.json');
const HIGH_BACKPRESSURE_THRESHOLD = 10;

// TODO 2: Always use BigInt instead of number when handling transaction amounts.

class BlockchainService extends AsyncStreamEmitter {
  constructor(options) {
    super();

    this.mainWalletAddress = options.mainInfo.mainWalletAddress;
    this.requiredBlockConfirmations = options.mainInfo.requiredBlockConfirmations; // TODO 2: Use this for settlement.
    this.accountService = options.accountService;
    this.blockPollInterval = options.blockPollInterval;
    rise.nodeAddress = options.nodeAddress;
    this.blockFetchLimit = options.blockFetchLimit;
    this.sync = options.sync;
    this.shardInfo = options.shardInfo;

    this.blockProcessingStream = new WritableConsumableStream();

    (async () => {
      for await (let packet of this.blockProcessingStream) {
        try {
          await this.processNextBlocks();
        } catch (error) {
          this.emit('error', {error});
        }
      }
    })();

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

    if (height <= syncFromBlockHeight) {
      return true;
    }

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
      this.emit('processBlock', {block});
    }

    let lastBlock = blocks[blocks.length - 1];
    if (lastBlock) {
      syncFromBlockHeight = lastBlock.height;
    }

    try {
      await this.settlePendingDeposits(syncFromBlockHeight);
    } catch (error) {
      this.emit('error', {error});
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

  async settlePendingDeposits(currentBlockHeight) {
    let targetHeight = currentBlockHeight - this.requiredBlockConfirmations;
    let shardRange = getShardRange(this.shardInfo.shardIndex, this.shardInfo.shardCount);
    let unsettledDeposits = await this.thinky.r.table('Deposit')
    .between([shardRange.start, this.thinky.r.minval], [shardRange.end, targetHeight], {index: 'settlementShardKeyHeight'})
    .orderBy(this.thinky.r.asc('createdDate'))
    .run();

    await Promise.all(
      unsettledDeposits.map(async (deposit) => {
        let transaction = {
          id: deposit.transactionId,
          accountId: account.id,
          type: 'deposit',
          amount: deposit.amount
        };
        try {
          await this.accountService.execTransaction(transaction);
        } catch (error) {
          let existingTransaction = await this.thinky.r.table('Transaction').get(deposit.transactionId).run();
          if (existingTransaction == null) {
            // This means that the transaction could not be created because of an exception because it does not
            // yet exist.
            this.emit('error', {error});
            return;
          }
          // If existingTransaction is not null, it means that the transaction already exists (and this caused the error).
          // This could mean that this function failed to update/cleanup the underlying deposit on the last round.
          // In this case, it should proceed with the cleanup (try again).
        }
        await this.crud.update({
          type: 'Deposit',
          id: deposit.id,
          value: {
            settled: true,
            settledDate: this.thinky.r.now();
          }
        });
        await this.crud.delete({
          type: 'Deposit',
          id: deposit.id,
          field: 'settlementShardKey'
        });
      })
    );
  }

  async execDeposit(blockchainTransaction) {
    let account = await this.accountService.fetchAccountByWalletAddress(blockchainTransaction.senderId);
    if (!account) {
      return;
    }

    let settlementShardKey = getShardKey(account.id);
    let transactionId = uuid.v4();
    let deposit = {
      id: blockchainTransaction.id,
      accountId: account.id,
      transactionId,
      height: blockchainTransaction.height,
      amount: String(blockchainTransaction.amount),
      settlementShardKey,
      createdDate: this.thinky.r.now()
    };
    let insertedDeposit;
    try {
      insertedDeposit = await this.crud.create({
        type: 'Deposit',
        value: deposit
      });
    } catch (error) {
      // Check if the deposit and transaction have already been created.
      // If a deposit exists without a matching transaction (e.g. because of a
      // past insertion failure), create the matching transaction.
      let deposit;
      try {
        deposit = await this.crud.read({
          type: 'Deposit',
          id: blockchainTransaction.id
        });
      } catch (err) {
        throw new Error(
          `Failed to create deposit with external ID ${
            blockchainTransaction.id
          } and no existing one could be found - ${error}`
        );
      }
    }
  }

  async finalizeDepositTransaction(blockchainTransaction) {
    await this.accountService.execDeposit(blockchainTransaction);
  }

  async processDepositTransaction(blockchainTransaction) {
    if (blockchainTransaction.recipientId === this.mainWalletAddress) {
      await this.finalizeDepositTransaction(blockchainTransaction);
      return;
    }
    let targetAccountList = await this.accountService.getAccountsByDepositWalletAddress(blockchainTransaction.recipientId);
    if (targetAccountList.length > 1) {
      throw new Error(
        `Multiple accounts were associated with the deposit address ${blockchainTransaction.recipientId}`
      );
    }
    if (targetAccountList.length < 1) {
      return;
    }

    let targetAccount = targetAccountList[0];

    let balanceResult = await rise.accounts.getBalance(targetAccount.depositWalletAddress);
    let amount = Number(balanceResult.balance) - fees.send;

    if (amount < 0) {
      this.emit('error', {
        error: new Error(
          `Funds from the deposit wallet address ${
            targetAccount.depositWalletAddress
          } could not be moved to the main wallet because the deposit wallet balance was too low.`
        )
      });
      return;
    }

    let forwardToNodeWalletTransaction = createSignedTransaction(
      {
        kind: 'send',
        amount,
        recipient: this.mainWalletAddress
      },
      targetAccount.depositWalletPassphrase
    );

    await rise.transactions.put(forwardToNodeWalletTransaction);
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
      this.blockProcessingStream.write({time: Date.now()});
      if (this.blockProcessingStream.getBackpressure() > HIGH_BACKPRESSURE_THRESHOLD) {
        let error = new Error(
          'The block processing getBackpressure is too high. This may cause delays in processing deposits. Consider increasing the blockPollInterval config option.'
        );
        this.emit('error', {error});
      }
    }, this.blockPollInterval);
  }
}

module.exports = BlockchainService;
