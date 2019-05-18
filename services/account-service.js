const fs = require('fs');
const path = require('path');
const util = require('util');
const uuid = require('uuid');
const crypto = require('crypto');
const {getShardKey, getShardRange} = require('../utils/sharding');
const AsyncStreamEmitter = require('async-stream-emitter');
const WritableConsumableStream = require('writable-consumable-stream');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const STATE_FILE_PATH = path.resolve(__dirname, '..', 'state.json');

const SALT_SIZE = 32;
const MAX_WALLET_CREATE_ATTEMPTS = 10;

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

const MIN_PASSWORD_LENGTH = 7;
const MAX_PASSWORD_LENGTH = 50;

const HIGH_BACKPRESSURE_THRESHOLD = 10;

// TODO 2: Always use BigInt instead of number when handling transaction amounts.

class AccountService extends AsyncStreamEmitter {
  constructor(options) {
    super();

    this.thinky = options.thinky;
    this.crud = options.crud;
    this.mainInfo = options.mainInfo;
    this.shardInfo = options.shardInfo;
    this.settlementInterval = options.transactionSettlementInterval;
    this.maxSettlementsPerAccount = options.maxTransactionSettlementsPerAccount;

    this.mainWalletAddress = options.mainInfo.mainWalletAddress;
    this.requiredBlockConfirmations = options.mainInfo.requiredBlockConfirmations;
    this.blockPollInterval = options.blockPollInterval;
    this.blockFetchLimit = options.blockFetchLimit;
    this.blockchainSync = options.blockchainSync;
    this.shardInfo = options.shardInfo;
    this.thinky = options.thinky;
    this.crud = options.crud;
    this.lastBlockHeight = 0;

    this.blockchainAdapterPath = options.blockchainAdapterPath || '../adapters/rise-adapter.js';
    const BlockchainAdapter = require(this.blockchainAdapterPath);

    this.blockchainAdapter = new BlockchainAdapter({
      nodeAddress: options.blockchainNodeAddress
    });

    this.settlementProcessingStream = new WritableConsumableStream();

    (async () => {
      for await (let packet of this.settlementProcessingStream) {
        try {
          await this.settlePendingTransactions();
        } catch (error) {
          this.emit('error', {error});
        }
      }
    })();

    this.blockProcessingStream = new WritableConsumableStream();

    (async () => {
      for await (let packet of this.blockProcessingStream) {
        try {
          await this.processNextBlocks();
          await this.settlePendingDeposits(this.lastBlockHeight);
        } catch (error) {
          this.emit('error', {error});
        }
      }
    })();

    if (this.blockchainSync) {
      this.startBlockchainSyncInterval();
    }
    this.startSettlementInterval();
  }

  async getAccountsByDepositWalletAddress(walletAddress) {
    if (walletAddress == null) {
      return [];
    }
    return this.thinky.r.table('Account').getAll(walletAddress, {index: 'depositWalletAddress'}).run();
  }

  async fetchAccountByWalletAddress(walletAddress) {
    let walletAccountList = await this.getAccountsByDepositWalletAddress(walletAddress);
    return walletAccountList[0];
  }

  async execTransaction(transaction) {
    let settlementShardKey = getShardKey(transaction.accountId);
    return this.crud.create({
      type: 'Transaction',
      value: {
        createdDate: this.thinky.r.now(),
        settled: false,
        settlementShardKey,
        ...transaction
      }
    });
  }

  async fetchAccountBalance(accountId) {
    return this.thinky.r.table('Transaction')
    .getAll(accountId, {index: 'accountId'})
    .orderBy(this.thinky.r.desc('createdDate'))
    .nth(0)
    .getField('amount');
  }

  async fetchAccountSettlementLedger(maxSettlementsPerAccount) {
    if (this.shardInfo.shardIndex == null || this.shardInfo.shardCount == null) {
      return {};
    }
    // Only fetch transactions from accounts which are within the
    // shard range as the current worker.
    let shardRange = getShardRange(this.shardInfo.shardIndex, this.shardInfo.shardCount);
    let txns = await this.thinky.r.table('Transaction')
    .between(shardRange.start, shardRange.end, {index: 'settlementShardKey'})
    .orderBy(this.thinky.r.asc('createdDate'))
    .run();

    if (!txns.length) {
      return {};
    }

    let accountLedger = {};
    txns.forEach((txn) => {
      if (!accountLedger[txn.accountId]) {
        accountLedger[txn.accountId] = {
          balance: 0n,
          lastSettledTransaction: null,
          unsettledTransactions: [],
        };
      }
      let account = accountLedger[txn.accountId];
      if (txn.settled) {
        account.lastSettledTransaction = txn;
        account.balance = BigInt(txn.balance);
      } else if (
        maxSettlementsPerAccount == null ||
        account.unsettledTransactions.length < maxSettlementsPerAccount
      ) {
        account.unsettledTransactions.push(txn);
      }
    });

    return accountLedger;
  }

  async settlePendingTransactions() {
    let accountLedger = await this.fetchAccountSettlementLedger(this.maxSettlementsPerAccount);
    let unsettledAccoundIds = Object.keys(accountLedger);

    await Promise.all(
      unsettledAccoundIds.map(async (accountId) => {
        let account = accountLedger[accountId];
        let len = account.unsettledTransactions.length;

        for (let i = 0; i < len; i++) {
          let txn = account.unsettledTransactions[i];

          if (txn.type === 'withdrawal') {
            let newBalance = account.balance - BigInt(txn.amount);
            if (newBalance >= 0n) {
              account.balance = newBalance;
            } else {
              txn.canceled = true;
            }
          } else if (txn.type === 'debit') {
            let newBalance = account.balance - BigInt(txn.amount);
            if (newBalance >= 0n) {
              account.balance = newBalance;
            } else {
              txn.canceled = true;
            }
          } else if (txn.type === 'credit') {
            account.balance += BigInt(txn.amount);
          } else if (txn.type === 'deposit') {
            account.balance += BigInt(txn.amount);
          }

          txn.balance = account.balance.toString();
          txn.settled = true;
          txn.settledDate = this.thinky.r.now();

          let {id, ...txnData} = txn;
          await this.crud.update({
            type: 'Transaction',
            id,
            value: txnData
          });
        }
      })
    );

    await Promise.all(
      unsettledAccoundIds.map(async (accountId) => {
        let account = accountLedger[accountId];
        let txnsToRemoveShardKey = [];
        if (account.lastSettledTransaction) {
          txnsToRemoveShardKey.push(account.lastSettledTransaction);
        }
        // Remove the settlement shard key from all settled transactions except for the last one.
        txnsToRemoveShardKey = txnsToRemoveShardKey
        .concat(account.unsettledTransactions)
        .filter(txn => txn.settled);
        txnsToRemoveShardKey = txnsToRemoveShardKey.slice(0, txnsToRemoveShardKey.length - 1);

        await Promise.all(
          txnsToRemoveShardKey.map(async (txn) => {
            await this.crud.delete({
              type: 'Transaction',
              id: txn.id,
              field: 'settlementShardKey'
            });
          })
        );
      })
    );
  }

  async settleTransaction(transactionId) {
    let result = await this.thinky.r.table('Transaction')
    .get(transactionId)
    .update({settled: true, settledDate: this.thinky.r.now()})
    .run();

    if (!result.replaced) {
      throw new Error(
        `Failed to settle transaction ${transactionId}`
      );
    }
  }

  /*
    withdrawal.accountId: The id of the account from which to withdraw.
    withdrawal.amount: The amount of tokens to withdraw.
    withdrawal.walletAddress: The blockchain wallet address to send the tokens to.
  */
  async execWithdrawal(withdrawal) {
    let settlementShardKey = getShardKey(withdrawal.accountId);
    let transactionId = uuid.v4();

    // TODO 2: Create signedTransaction here.

    await this.crud.create({
      type: 'Withdrawal',
      value: {
        createdDate: this.thinky.r.now(),
        settled: false,
        settlementShardKey,
        transactionId,
        ...withdrawal
      }
    });
    // await this.crud.create({ // TODO 2
    //   type: 'Transaction',
    //   value: {
    //     createdDate: this.thinky.r.now(),
    //     settled: false,
    //     settlementShardKey,
    //     ...transaction
    //   }
    // });
  }

  hashPassword(password, salt) {
    let hasher = crypto.createHash('sha256');
    hasher.update(password + salt);
    return hasher.digest('hex');
  }

  async sanitizeSignupCredentials(credentials) {
    credentials = {...credentials};
    if (!credentials || credentials.username == null || credentials.password == null) {
      let error = new Error('Account credentials were not provided.');
      error.name = 'NoCredentialsProvidedError';
      throw error;
    }
    if (
      typeof credentials.username !== 'string' ||
      credentials.username.length < MIN_USERNAME_LENGTH ||
      credentials.username.length > MAX_USERNAME_LENGTH
    ) {
      let error = new Error(
        `The provided username was invalid. It must be between ${
          MIN_USERNAME_LENGTH
        } and ${
          MAX_USERNAME_LENGTH
        } characters in length.`
      );
      error.name = 'InvalidUsernameError';
      throw error;
    }
    credentials.username = credentials.username.trim();

    if (
      typeof credentials.password !== 'string' ||
      credentials.password.length < MIN_PASSWORD_LENGTH ||
      credentials.password.length > MAX_PASSWORD_LENGTH
    ) {
      let error = new Error(
        `A password must be between ${
          MIN_PASSWORD_LENGTH
        } and ${
          MAX_PASSWORD_LENGTH
        } characters in length.`
      );
      error.name = 'InvalidPasswordError';
      throw error;
    }

    let randomBuffer = await new Promise((resolve, reject) => {
      crypto.randomBytes(SALT_SIZE, (err, randomBytesBuffer) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(randomBytesBuffer);
      });
    });

    credentials.active = true;

    // Add random password salt.
    credentials.passwordSalt = randomBuffer.toString('hex');
    // Only store the salted hash of the password.
    credentials.password = this.hashPassword(credentials.password, credentials.passwordSalt);
    credentials.createdDate = this.thinky.r.now();

    let isUsernameAvailable = false;
    try {
      // Verify that wallet address is not already taken.
      isUsernameAvailable = await this.thinky.r.table('Account')
      .getAll(credentials.username, {index: 'username'})
      .isEmpty()
      .run();
    } catch (error) {
      let badLookupError = new Error('Failed to check against existing account data in the database.');
      badLookupError.name = 'BadAccountLookupError';
      throw badLookupError;
    }

    if (!isUsernameAvailable) {
      let alreadyTakenError = new Error(
        `An account with the username ${credentials.username} already exists.`
      );
      alreadyTakenError.name = 'SignUpUsernameTakenError';
      throw alreadyTakenError;
    }

    let walletCreateAttempts = 0;
    while (true) {
      let wallet = await this.blockchainAdapter.generateWallet();

      credentials.depositWalletAddress = wallet.address;

      let isWalletAddressAvailable = false;

      try {
        isWalletAddressAvailable = await this.thinky.r.table('Account')
        .getAll(credentials.depositWalletAddress, {index: 'depositWalletAddress'})
        .isEmpty()
        .run();
      } catch (error) {
        let badLookupError = new Error('Failed to check against existing account data in the database.');
        badLookupError.name = 'BadAccountLookupError';
        throw badLookupError;
      }

      if (isWalletAddressAvailable) {
        credentials.depositWalletPassphrase = wallet.passphrase;
        credentials.depositWalletPrivateKey = wallet.privateKey;
        credentials.depositWalletPublicKey = wallet.publicKey;
        break;
      }
      if (++walletCreateAttempts >= MAX_WALLET_CREATE_ATTEMPTS) {
        let accountCreateError = new Error('Failed to generate an account wallet');
        accountCreateError.name = 'AccountCreateError';
        throw accountCreateError;
      }
    }

    return credentials;
  }

  async verifyLoginCredentials(credentials) {
    if (typeof credentials.username !== 'string') {
      let err = new Error('Username was in an invalid format');
      err.name = 'InvalidCredentialsError';
      throw err;
    }
    credentials.username = credentials.username.trim();

    let results = await this.thinky.r.table('Account')
    .getAll(credentials.username, {index: 'username'})
    .run();

    if (!results || !results[0]) {
      let err = new Error('Invalid username or password.');
      err.name = 'InvalidCredentialsError';
      throw err;
    }

    let accountData = results[0];

    if (accountData.active === false) {
      let accountInactiveError = new Error('Your account is currently disabled.');
      accountInactiveError.name = 'AccountInactiveError';
      throw accountInactiveError;
    }

    let hasher = crypto.createHash('sha256');
    hasher.update(credentials.password + accountData.passwordSalt);
    let hashedPassword = hasher.digest('hex');

    if (accountData.password !== hashedPassword) {
      let err = new Error('Wrong password.');
      err.name = 'InvalidCredentialsError';
      throw err;
    }
    return accountData;
  }

  async processNextBlocks() {
    let state;
    try {
      state = JSON.parse(
        await readFile(STATE_FILE_PATH, {
          encoding: 'utf8'
        })
      );
    } catch (error) {
      this.emit('error', {error});
    }

    let heightResult;
    try {
      heightResult = await this.blockchainAdapter.fetchHeight();
    } catch (error) {
      this.emit('error', {error});
      return false;
    }
    let {height} = heightResult;

    if (!state) {
      state = {
        syncFromBlockHeight: height - 1
      };
    }

    let {syncFromBlockHeight} = state;
    this.lastBlockHeight = syncFromBlockHeight;

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
      blocksResult = await this.blockchainAdapter.fetchBlocks({
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
    if (this.shardInfo.shardIndex == null || this.shardInfo.shardCount == null) {
      return;
    }
    let targetHeight = currentBlockHeight - this.requiredBlockConfirmations;
    let shardRange = getShardRange(this.shardInfo.shardIndex, this.shardInfo.shardCount);
    let unsettledDeposits = await this.thinky.r.table('Deposit')
    .between(shardRange.start, shardRange.end, {index: 'settlementShardKey'})
    .filter(this.thinky.r.row('height').le(targetHeight))
    .orderBy(this.thinky.r.asc('createdDate'))
    .run();

    await Promise.all(
      unsettledDeposits.map(async (deposit) => {
        let blockchainTxnResult;
        try {
          blockchainTxnResult = await this.blockchainAdapter.fetchTransaction(deposit.id);
        } catch (error) {
          this.emit('error', {error});
          return;
        }
        if (!blockchainTxnResult || !blockchainTxnResult.success) {
          this.emit('error', {
            error: new Error(
              `The blockchain transaction ${
                deposit.id
              } could not be found on the blockchain after the required block confirmations`
            )
          });
          await this.crud.update({
            type: 'Deposit',
            id: deposit.id,
            value: {
              canceled: true,
              settled: true,
              settledDate: this.thinky.r.now()
            }
          });
          await this.crud.delete({
            type: 'Deposit',
            id: deposit.id,
            field: 'settlementShardKey'
          });
          return;
        }

        if (
          blockchainTxnResult.transaction &&
          typeof blockchainTxnResult.transaction.confirmations === 'number' &&
          blockchainTxnResult.transaction.confirmations < this.requiredBlockConfirmations
        ) {
          this.emit('error', {
            error: new Error(
              `The blockchain transaction ${
                deposit.id
              } had ${
                blockchainTxnResult.transaction.confirmations
              } confirmations. ${
                this.requiredBlockConfirmations
              } confirmations are required for settlement.`
            )
          });
          return;
        }

        let transaction = {
          id: deposit.transactionId,
          accountId: deposit.accountId,
          type: 'deposit',
          amount: deposit.amount
        };
        try {
          await this.execTransaction(transaction);
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
            settledDate: this.thinky.r.now()
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
    let account = await this.fetchAccountByWalletAddress(blockchainTransaction.senderId);
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

  async processDepositTransaction(blockchainTransaction) {
    if (blockchainTransaction.recipientId === this.mainWalletAddress) {
      await this.execDeposit(blockchainTransaction);
      return;
    }
    let targetAccountList = await this.getAccountsByDepositWalletAddress(blockchainTransaction.recipientId);
    if (targetAccountList.length > 1) {
      throw new Error(
        `Multiple accounts were associated with the deposit address ${blockchainTransaction.recipientId}`
      );
    }
    if (targetAccountList.length < 1) {
      return;
    }

    let targetAccount = targetAccountList[0];

    let balanceResult = await this.blockchainAdapter.fetchWalletBalance(targetAccount.depositWalletAddress);
    let fees = await this.blockchainAdapter.fetchFees(blockchainTransaction);
    console.log(222, Number(balanceResult.balance) - fees);
    let amount = Number(balanceResult.balance) - fees; // TODO 2: Use BigInt

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

    await this.blockchainAdapter.sendTransaction(
      {
        amount,
        recipient: this.mainWalletAddress
      },
      targetAccount.depositWalletPassphrase
    );
  }

  async startBlockchainSyncInterval() {
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

    if (this._blockIntervalRef != null) {
      clearInterval(this._blockIntervalRef);
    }
    // Sync block by block.
    this._blockIntervalRef = setInterval(async () => {
      this.blockProcessingStream.write({time: Date.now()});
      if (this.blockProcessingStream.getBackpressure() > HIGH_BACKPRESSURE_THRESHOLD) {
        let error = new Error(
          'The block processing getBackpressure is too high. This may cause delays in processing deposits. Consider increasing the blockPollInterval config option.'
        );
        this.emit('error', {error});
      }
    }, this.blockPollInterval);
  }

  async startSettlementInterval() {
    if (this._settlementIntervalRef != null) {
      clearInterval(this._settlementIntervalRef);
    }
    this._settlementIntervalRef = setInterval(async () => {
      this.settlementProcessingStream.write({time: Date.now()});
      if (this.settlementProcessingStream.getBackpressure() > HIGH_BACKPRESSURE_THRESHOLD) {
        let error = new Error(
          'The settlement processing getBackpressure is too high. This may cause delays in performing transaction settlements.'
        );
        this.emit('error', {error});
      }
    }, this.settlementInterval);
  }
}

module.exports = AccountService;
