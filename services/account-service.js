const fs = require('fs');
const path = require('path');
const util = require('util');
const uuid = require('uuid');
const bcrypt = require('bcryptjs');
const Cryptr = require('cryptr');
const {getShardKey, getShardRange} = require('../utils/sharding');
const AsyncStreamEmitter = require('async-stream-emitter');
const WritableConsumableStream = require('writable-consumable-stream');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const STATE_FILE_PATH = path.resolve(__dirname, '..', 'state.json');

const MAX_WALLET_CREATE_ATTEMPTS = 10;
const HIGH_BACKPRESSURE_THRESHOLD = 10;

class AccountService extends AsyncStreamEmitter {
  constructor(options) {
    super();

    this.thinky = options.thinky;
    this.crud = options.crud;
    this.publicInfo = options.publicInfo;
    this.shardInfo = options.shardInfo;
    this.settlementInterval = options.transactionSettlementInterval;
    this.withdrawalInterval = options.withdrawalProcessingInterval;
    this.maxTransactionSettlementsPerAccount = options.maxTransactionSettlementsPerAccount;
    this.maxConcurrentWithdrawalsPerAccount = options.maxConcurrentWithdrawalsPerAccount;
    this.maxConcurrentDebitsPerAccount = options.maxConcurrentDebitsPerAccount;
    this.blockchainWithdrawalMaxAttempts = options.blockchainWithdrawalMaxAttempts;
    this.secretSignupKey = options.secretSignupKey;
    this.bcryptPasswordRounds = options.bcryptPasswordRounds;
    this.storageEncryptionKey = options.storageEncryptionKey;

    this.mainWalletAddress = options.publicInfo.mainWalletAddress;
    this.requiredDepositBlockConfirmations = options.publicInfo.requiredDepositBlockConfirmations;
    this.requiredWithdrawalBlockConfirmations = options.publicInfo.requiredWithdrawalBlockConfirmations;
    this.alwaysRequireSecretSignupKey = options.publicInfo.alwaysRequireSecretSignupKey;
    this.enableAdminAccountSignup = options.publicInfo.enableAdminAccountSignup;
    this.blockPollInterval = options.blockPollInterval;
    this.blockFetchLimit = options.blockFetchLimit;
    this.blockchainSync = options.blockchainSync;
    this.blockchainWalletPassphrase = options.blockchainWalletPassphrase;
    this.shardInfo = options.shardInfo;
    this.thinky = options.thinky;
    this.crud = options.crud;
    this.lastBlockHeight = 0;
    this.syncFromBlockHeight = options.syncFromBlockHeight;

    this.blockchainAdapterPath = options.blockchainAdapterPath;
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
          await this.processBlockchainDeposits();
          await this.settlePendingDeposits(this.lastBlockHeight);
        } catch (error) {
          this.emit('error', {error});
        }
      }
    })();

    this.withdrawalProcessingStream = new WritableConsumableStream();

    (async () => {
      for await (let packet of this.withdrawalProcessingStream) {
        try {
          await this.processPendingWithdrawals(this.lastBlockHeight);
        } catch (error) {
          this.emit('error', {error});
        }
      }
    })();

    (async () => {
      if (this.syncFromBlockHeight != null) {
        let state;
        try {
          state = await this.readStateFromFile();
        } catch (error) {}
        try {
          await this.writeStateToFile({
            ...state,
            syncFromBlockHeight: this.syncFromBlockHeight
          });
        } catch (error) {
          this.emit('error', {error});
        }
      }
      if (this.blockchainSync) {
        this.startBlockchainSyncInterval();
      }
      this.startSettlementInterval();
      this.startWithdrawalInterval();
    })();
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

  async attemptDirectDebit(directDebit, maxConcurrentDebits) {
    if (maxConcurrentDebits == null) {
      maxConcurrentDebits = this.maxConcurrentDebitsPerAccount;
    }

    let pendingDebitTransfersCount = await this.fetchAccountPendingTransfersCount(directDebit.fromAccountId, 'debit');
    if (pendingDebitTransfersCount >= maxConcurrentDebits) {
      let error = Error(
        `Failed to execute debit on account ${
          directDebit.fromAccountId
        } because the account cannot have more than ${
          maxConcurrentDebits
        } concurrent pending debit transactions`
      );
      error.name = 'MaxConcurrentDebitsError';
      error.isClientError = true;
      throw error;
    }
    return this.execDirectDebit(directDebit);
  }

  async execDirectDebit(directDebit) {
    if (directDebit.debitId == null) {
      directDebit.debitId = uuid.v4();
    }
    let debitTransaction = {
      id: directDebit.debitId,
      accountId: directDebit.fromAccountId,
      type: 'transfer',
      recordType: 'debit',
      amount: directDebit.amount,
      data: directDebit.data
    };
    await this.execTransaction(debitTransaction);
    return {debitId: directDebit.debitId};
  }

  async execDirectCredit(directCredit) {
    if (directCredit.creditId == null) {
      directCredit.creditId = uuid.v4();
    }
    let creditTransaction = {
      id: directCredit.creditId,
      accountId: directCredit.toAccountId,
      type: 'transfer',
      recordType: 'credit',
      amount: directCredit.amount,
      data: directCredit.data
    };
    await this.execTransaction(creditTransaction);
    return {creditId: directCredit.creditId};
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
    .between(
      [accountId, this.thinky.r.minval],
      [accountId, this.thinky.r.maxval],
      {index: 'accountIdSettledDate', rightBound: 'closed'}
    )
    .orderBy({index: this.thinky.r.desc('accountIdSettledDate')})
    .nth(0)
    .getField('balance');
  }

  async fetchAccountSettlementLedger(maxTransactionSettlementsPerAccount) {
    if (this.shardInfo.shardIndex == null || this.shardInfo.shardCount == null) {
      return {};
    }
    // Only fetch transactions from accounts which are within the
    // shard range as the current worker.
    let shardRange = getShardRange(this.shardInfo.shardIndex, this.shardInfo.shardCount);
    let unsettledTxnList = await this.thinky.r.table('Transaction')
    .between(shardRange.start, shardRange.end, {index: 'settlementShardKey'})
    .orderBy(this.thinky.r.asc('createdDate'))
    .run();

    if (!unsettledTxnList.length) {
      return {};
    }

    let accountLedger = {};

    unsettledTxnList.forEach((txn) => {
      if (!accountLedger[txn.accountId]) {
        accountLedger[txn.accountId] = {
          balance: 0n,
          lastSettledTransaction: null,
          settledTransactions: [],
          unsettledTransactions: []
        };
      }
      let account = accountLedger[txn.accountId];

      if (txn.settled) {
        account.settledTransactions.push(txn);
      } else if (
        maxTransactionSettlementsPerAccount == null ||
        account.unsettledTransactions.length < maxTransactionSettlementsPerAccount
      ) {
        account.unsettledTransactions.push(txn);
      }
    });

    let lastTxnList = await Promise.all(
      Object.keys(accountLedger).map(async (accountId) => {
        try {
          return await this.thinky.r.table('Transaction')
          .between(
            [accountId, this.thinky.r.minval],
            [accountId, this.thinky.r.maxval],
            {index: 'accountIdSettledDate'}
          )
          .orderBy({index: this.thinky.r.desc('accountIdSettledDate')})
          .nth(0)
          .run();
        } catch (error) {
          return null;
        }
      })
    );

    lastTxnList
    .filter(lastTxn => lastTxn != null)
    .forEach((lastTxn) => {
      let account = accountLedger[lastTxn.accountId];
      account.lastSettledTransaction = lastTxn;
      account.balance = BigInt(lastTxn.balance);
    });

    return accountLedger;
  }

  async settlePendingTransactions() {
    let accountLedger = await this.fetchAccountSettlementLedger(this.maxTransactionSettlementsPerAccount);
    let unsettledAccoundIds = Object.keys(accountLedger);

    await Promise.all(
      unsettledAccoundIds.map(async (accountId) => {
        let account = accountLedger[accountId];
        let len = account.unsettledTransactions.length;

        for (let i = 0; i < len; i++) {
          let txn = account.unsettledTransactions[i];
          let txnAmount;
          try {
            txnAmount = BigInt(txn.amount);
          } catch (error) {
            this.emit('error', {error});
          }

          if (txnAmount == null || txnAmount <= 0n) {
            txn.canceled = true;
          } else if (txn.type === 'withdrawal') {
            let newBalance = account.balance - txnAmount;
            if (newBalance >= 0n) {
              account.balance = newBalance;
            } else {
              txn.canceled = true;
            }
          } else if (txn.type === 'transfer') {
            if (txn.recordType === 'credit') {
              account.balance += txnAmount;
            } else {
              let newBalance = account.balance - txnAmount;
              if (newBalance >= 0n) {
                if (txn.counterpartyAccountId == null) {
                  // If the transaction has no counterparty, then it is a direct debit or credit.
                  account.balance = newBalance;
                } else {
                  let counterpartyAccount = await this.thinky.r.table('Account')
                  .get(txn.counterpartyAccountId).run();
                  // If the counterparty account does not exist.
                  if (counterpartyAccount == null) {
                    txn.canceled = true;
                  } else {
                    account.balance = newBalance;
                    let transferCreditTxn = await this.thinky.r.table('Transaction')
                    .get(txn.counterpartyTransactionId).run();
                    if (transferCreditTxn == null) {
                      await this.execTransferCreditFromDebit(txn);
                    }
                  }
                }
              } else {
                txn.canceled = true;
              }
            }
          } else if (txn.type === 'deposit') {
            account.balance += txnAmount;
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

        await this.crud.update({
          type: 'Account',
          id: accountId,
          field: 'balance',
          value: account.balance.toString()
        });

        account.isFullyProcessed = true;
      })
      .map((promise) => {
        return promise.catch((error) => {
          this.emit('error', {error});
        });
      })
    );

    await Promise.all(
      unsettledAccoundIds.map(async (accountId) => {
        let account = accountLedger[accountId];
        if (account.isFullyProcessed) {
          await Promise.all(
            account.settledTransactions.map(async (txn) => {
              await this.crud.delete({
                type: 'Transaction',
                id: txn.id,
                field: 'settlementShardKey'
              });
            })
          );
        }
      })
      .map((promise) => {
        return promise.catch((error) => {
          this.emit('error', {error});
        });
      })
    );
  }

  async generateSalt(rounds) {
    return bcrypt.genSalt(rounds);
  }

  async hashPassword(password, salt) {
    return bcrypt.hash(password, salt);
  }

  async comparePasswordWithHash(password, hash) {
    return bcrypt.compare(password, hash);
  }

  async sanitizeSignupCredentials(credentials) {
    credentials = {...credentials};

    if (this.alwaysRequireSecretSignupKey && credentials.secretSignupKey !== this.secretSignupKey) {
      let accountCreateError = new Error(
        'Failed to create account because the specified secret signup key was incorrect. An account cannot be created without a valid secret key.'
      );
      accountCreateError.name = 'AccountCreateError';
      accountCreateError.isClientError = true;
      throw accountCreateError;
    }

    if (!credentials || credentials.accountId == null || credentials.password == null) {
      let error = new Error('Account credentials were not provided.');
      error.name = 'NoCredentialsProvidedError';
      error.isClientError = true;
      throw error;
    }

    credentials.id = credentials.accountId.trim();
    delete credentials.accountId;
    credentials.active = true;

    // Add password salt.
    let passwordSalt = await this.generateSalt(this.bcryptPasswordRounds);
    // Only store the hash of the password.
    credentials.password = await this.hashPassword(credentials.password, passwordSalt);
    credentials.createdDate = this.thinky.r.now();

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
        badLookupError.isClientError = true;
        throw badLookupError;
      }

      if (isWalletAddressAvailable) {
        let cryptr = new Cryptr(this.storageEncryptionKey);
        credentials.depositWalletEncryptedPassphrase = cryptr.encrypt(wallet.passphrase);
        credentials.depositWalletPublicKey = wallet.publicKey;
        break;
      }
      if (++walletCreateAttempts >= MAX_WALLET_CREATE_ATTEMPTS) {
        let accountCreateError = new Error('Failed to generate an account wallet.');
        accountCreateError.name = 'AccountCreateError';
        accountCreateError.isClientError = true;
        throw accountCreateError;
      }
    }

    if (credentials.admin) {
      if (!this.enableAdminAccountSignup) {
        let accountCreateError = new Error(
          'Failed to create admin account because this feature has been disabled.'
        );
        accountCreateError.name = 'AccountCreateError';
        accountCreateError.isClientError = true;
        throw accountCreateError;
      }
      if (credentials.secretSignupKey !== this.secretSignupKey) {
        let accountCreateError = new Error(
          'Failed to create admin account because the specified secret signup key was incorrect.'
        );
        accountCreateError.name = 'AccountCreateError';
        accountCreateError.isClientError = true;
        throw accountCreateError;
      }
    } else {
      credentials.admin = false;
    }
    delete credentials.secretSignupKey;

    return credentials;
  }

  async verifyLoginCredentialsAccountId(credentials) {
    if (!credentials || typeof credentials.accountId !== 'string') {
      let err = new Error('Account ID was in an invalid format.');
      err.name = 'InvalidCredentialsError';
      err.isClientError = true;
      throw err;
    }
    credentials.id = credentials.accountId.trim();
    delete credentials.accountId;

    let result = await this.thinky.r.table('Account')
    .get(credentials.id)
    .run();

    if (!result) {
      let err = new Error('Invalid account id.');
      err.name = 'InvalidCredentialsError';
      err.isClientError = true;
      throw err;
    }
    return result;
  }

  async verifyLoginCredentials(credentials) {
    let accountData = await this.verifyLoginCredentialsAccountId(credentials);

    if (accountData.active === false) {
      let accountInactiveError = new Error('Your account is currently disabled.');
      accountInactiveError.name = 'AccountInactiveError';
      accountInactiveError.isClientError = true;
      throw accountInactiveError;
    }

    let passwordMatches = await this.comparePasswordWithHash(credentials.password, accountData.password);
    if (!passwordMatches) {
      let err = new Error('Wrong password.');
      err.name = 'InvalidCredentialsError';
      err.isClientError = true;
      throw err;
    }
    return accountData;
  }

  async readStateFromFile() {
    return JSON.parse(
      await readFile(STATE_FILE_PATH, {
        encoding: 'utf8'
      })
    );
  }

  async writeStateToFile(state) {
    await writeFile(
      STATE_FILE_PATH,
      JSON.stringify(state, ' ', 2)
    );
  }

  async processBlockchainDeposits() {
    let state;
    try {
      state = await this.readStateFromFile();
    } catch (error) {
      this.emit('info', {
        info: `Could not find a valid state file at path ${STATE_FILE_PATH}. A new one will be created.`
      });
    }

    let height;
    try {
      // Stay one block late to allow for wallet balances to settle.
      height = await this.blockchainAdapter.fetchHeight() - 1;
    } catch (error) {
      this.emit('error', {error});
      return false;
    }

    if (!state) {
      state = {
        syncFromBlockHeight: height - 1
      };
    }

    let {syncFromBlockHeight} = state;
    this.lastBlockHeight = syncFromBlockHeight;

    let blocks;
    let lastTargetBlockHeight = syncFromBlockHeight + this.blockFetchLimit;
    let safeHeightDiff = lastTargetBlockHeight - height;
    if (safeHeightDiff < 0) {
      safeHeightDiff = 0;
    }

    if (height <= syncFromBlockHeight) {
      return true;
    }

    try {
      blocks = await this.blockchainAdapter.fetchBlocks({
        offset: syncFromBlockHeight,
        limit: this.blockFetchLimit - safeHeightDiff
      });
    } catch (error) {
      this.emit('error', {error});
      return false;
    }

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

    await this.writeStateToFile({
      ...state,
      syncFromBlockHeight
    });

    return safeHeightDiff > 0;
  }

  async settlePendingDeposits(currentBlockHeight) {
    if (this.shardInfo.shardIndex == null || this.shardInfo.shardCount == null) {
      return;
    }
    let targetHeight = currentBlockHeight - this.requiredDepositBlockConfirmations;
    let shardRange = getShardRange(this.shardInfo.shardIndex, this.shardInfo.shardCount);
    let unsettledDeposits = await this.thinky.r.table('Deposit')
    .between(shardRange.start, shardRange.end, {index: 'settlementShardKey'})
    .filter(this.thinky.r.row('height').le(targetHeight))
    .orderBy(this.thinky.r.asc('createdDate'))
    .run();

    await Promise.all(
      unsettledDeposits.map(async (deposit) => {
        let blockchainTxn = await this.blockchainAdapter.fetchTransaction(deposit.id);
        if (blockchainTxn == null) {
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
          typeof blockchainTxn.confirmations === 'number' &&
          blockchainTxn.confirmations < this.requiredDepositBlockConfirmations
        ) {
          throw new Error(
            `The blockchain transaction ${
              deposit.id
            } had ${
              blockchainTxn.confirmations
            } confirmations. ${
              this.requiredDepositBlockConfirmations
            } confirmations are required for settlement.`
          );
        }

        let transaction = {
          id: deposit.transactionId,
          accountId: deposit.accountId,
          type: 'deposit',
          recordType: 'credit',
          amount: deposit.amount
        };
        try {
          await this.execTransaction(transaction);
        } catch (error) {
          let existingTransaction = await this.thinky.r.table('Transaction').get(deposit.transactionId).run();
          if (existingTransaction == null) {
            // This means that the transaction could not be created because of an exception because it does not
            // yet exist.
            throw error;
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
      .map((promise) => {
        return promise.catch((error) => {
          this.emit('error', {error});
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
      let deposit;
      try {
        deposit = await this.crud.read({
          type: 'Deposit',
          id: blockchainTransaction.id
        });
      } catch (err) {
        throw new Error(
          `Failed to create deposit with ID ${
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
      this.emit('error', {
        error: new Error(
          `Multiple accounts were associated with the deposit address ${blockchainTransaction.recipientId}`
        )
      });
      return;
    }
    if (targetAccountList.length < 1) {
      return;
    }

    let targetAccount = targetAccountList[0];

    let fees = await this.blockchainAdapter.fetchFees(blockchainTransaction);
    if (fees == null) {
      this.emit('error', {
        error: new Error(
          `Failed to fetch transaction fees for the blockchain transaction ${blockchainTransaction.id}`
        )
      });
      return;
    }

    let balance = await this.blockchainAdapter.fetchWalletBalance(targetAccount.depositWalletAddress);
    if (balance == null) {
      this.emit('error', {
        error: new Error(
          `Failed to fetch the balance of wallet address ${
            targetAccount.depositWalletAddress
          } during deposit processing`
        )
      });
      return;
    }

    let amount = BigInt(balance) - BigInt(fees);
    if (amount < 0n) {
      this.emit('error', {
        error: new Error(
          `Funds from the deposit wallet address ${
            targetAccount.depositWalletAddress
          } could not be moved to the main wallet because the deposit wallet balance was too low`
        )
      });
      return;
    }

    let cryptr = new Cryptr(this.storageEncryptionKey);
    let depositWalletPassphrase = cryptr.decrypt(targetAccount.depositWalletEncryptedPassphrase);
    let signedTransaction = await this.blockchainAdapter.signTransaction(
      {
        kind: 'send',
        amount: amount.toString(),
        recipient: this.mainWalletAddress
      },
      depositWalletPassphrase
    );
    await this.blockchainAdapter.sendTransaction(signedTransaction);
  }

  async execTransferCreditFromDebit(debitTransaction) {
    let creditSettlementShardKey = getShardKey(debitTransaction.counterpartyAccountId);

    let creditTransaction = {
      id: debitTransaction.counterpartyTransactionId,
      accountId: debitTransaction.counterpartyAccountId,
      type: 'transfer',
      recordType: 'credit',
      amount: debitTransaction.amount,
      counterpartyAccountId: debitTransaction.accountId,
      counterpartyTransactionId: debitTransaction.id,
      data: debitTransaction.data,
      settled: false,
      settlementShardKey: creditSettlementShardKey,
      createdDate: this.thinky.r.now()
    };

    await this.crud.create({
      type: 'Transaction',
      value: creditTransaction
    });
  }

  async fetchAccountPendingTransfersCount(accountId, recordType) {
    return this.thinky.r.table('Transaction')
    .between(
      [accountId, 'transfer', false, this.thinky.r.minval],
      [accountId, 'transfer', false, this.thinky.r.maxval],
      {index: 'accountIdTypeSettledCreatedDate'}
    )
    .filter(this.thinky.r.row('recordType').eq(recordType))
    .count()
    .run();
  }

  /*
    transfer.amount: The amount of tokens to transfer.
    transfer.fromAccountId: The id of the account to debit.
    transfer.toAccountId: The id of the account to credit.
    transfer.debitId: The id (UUID) of the underlying debit transaction.
    transfer.creditId: The id (UUID) of the underlying credit transaction.
    transfer.data: Custom string to attach to the debit transaction.
  */
  async attemptTransfer(transfer, maxConcurrentDebits) {
    if (maxConcurrentDebits == null) {
      maxConcurrentDebits = this.maxConcurrentDebitsPerAccount;
    }

    let pendingDebitTransfersCount = await this.fetchAccountPendingTransfersCount(transfer.fromAccountId, 'debit');
    if (pendingDebitTransfersCount >= maxConcurrentDebits) {
      let error = Error(
        `Failed to execute transfer from account ${
          transfer.fromAccountId
        } to account ${
          transfer.toAccountId
        } because the sender account cannot have more than ${
          maxConcurrentDebits
        } concurrent pending debit transactions.`
      );
      error.name = 'MaxConcurrentDebitsError';
      error.isClientError = true;
      throw error;
    }
    return this.execTransfer(transfer);
  }

  /*
    transfer.amount: The amount of tokens to transfer.
    transfer.fromAccountId: The id of the account to debit.
    transfer.toAccountId: The id of the account to credit.
    transfer.debitId: The id (UUID) of the underlying debit transaction.
    transfer.creditId: The id (UUID) of the underlying credit transaction.
    transfer.data: Custom string to attach to the debit transaction.
  */
  async execTransfer(transfer) {
    let debitSettlementShardKey = getShardKey(transfer.fromAccountId);

    if (transfer.debitId == null) {
      transfer.debitId = uuid.v4();
    }
    if (transfer.creditId == null) {
      transfer.creditId = uuid.v4();
    }

    let debitTransaction = {
      id: transfer.debitId,
      accountId: transfer.fromAccountId,
      type: 'transfer',
      recordType: 'debit',
      amount: transfer.amount,
      counterpartyAccountId: transfer.toAccountId,
      counterpartyTransactionId: transfer.creditId,
      data: transfer.data,
      settled: false,
      settlementShardKey: debitSettlementShardKey,
      createdDate: this.thinky.r.now()
    };

    try {
      await this.crud.create({
        type: 'Transaction',
        value: debitTransaction
      });
    } catch (error) {
      if (error.name === 'DuplicatePrimaryKeyError') {
        let clientError = new Error(
          `Failed to process the debit transaction because a transaction with the ID ${
            transfer.debitId
          } already exists.`
        );
        clientError.name = 'DebitTransactionAlreadyExistsError';
        clientError.debitId = transfer.debitId;
        clientError.isClientError = true;
        throw clientError;
      }
      throw error;
    }
    return {
      debitId: transfer.debitId,
      creditId: transfer.creditId
    };
  }

  async fetchAccountPendingWithdrawalsCount(accountId) {
    return this.thinky.r.table('Withdrawal')
    .between(
      [accountId, false, this.thinky.r.minval],
      [accountId, false, this.thinky.r.maxval],
      {index: 'accountIdSettledCreatedDate'}
    )
    .count()
    .run();
  }

  /*
    withdrawal.amount: The amount of tokens to withdraw.
    withdrawal.fromAccountId: The id of the account from which to withdraw.
    withdrawal.toWalletAddress: The blockchain wallet address to send the tokens to.
  */
  async attemptWithdrawal(withdrawal, maxConcurrentWithdrawals) {
    let account = await this.thinky.r.table('Account').get(withdrawal.fromAccountId).run();
    if (!account) {
      let error = Error(
        `Failed to withdraw to wallet address ${
          withdrawal.toWalletAddress
        } from account ${
          withdrawal.fromAccountId
        } because no account with that ID could be found.`
      );
      error.name = 'AccountNotFoundError';
      error.isClientError = true;
      throw error;
    }
    if (account.withdrawalsDisabled) {
      let error = Error(
        `Failed to withdraw to wallet address ${
          withdrawal.toWalletAddress
        } from account ${
          withdrawal.fromAccountId
        } because withdrawals are currently disabled for this account.`
      );
      error.name = 'AccountWithdrawalsDisabledError';
      error.isClientError = true;
      throw error;
    }

    if (maxConcurrentWithdrawals == null) {
      maxConcurrentWithdrawals = this.maxConcurrentWithdrawalsPerAccount;
    }
    let pendingWithdrawalsCount = await this.fetchAccountPendingWithdrawalsCount(withdrawal.fromAccountId);
    if (pendingWithdrawalsCount >= maxConcurrentWithdrawals) {
      let error = Error(
        `Failed to withdraw to wallet address ${
          withdrawal.toWalletAddress
        } from account ${
          withdrawal.fromAccountId
        } because the account cannot have more than ${
          maxConcurrentWithdrawals
        } concurrent pending withdrawals.`
      );
      error.name = 'MaxConcurrentWithdrawalsError';
      error.isClientError = true;
      throw error;
    }
    return this.execWithdrawal(withdrawal);
  }

  /*
    withdrawal.amount: The amount of tokens to withdraw.
    withdrawal.fromAccountId: The id of the account from which to withdraw.
    withdrawal.toWalletAddress: The blockchain wallet address to send the tokens to.
  */
  async execWithdrawal(withdrawal) {
    let settlementShardKey = getShardKey(withdrawal.fromAccountId);
    let transactionId = uuid.v4();

    let signedTransaction = await this.blockchainAdapter.signTransaction(
      {
        kind: 'send',
        amount: withdrawal.amount,
        recipient: withdrawal.toWalletAddress
      },
      this.blockchainWalletPassphrase
    );

    let fees = await this.blockchainAdapter.fetchFees(signedTransaction);
    if (fees == null) {
      throw new Error(
        `Failed to calculate fees when attempting to withdraw to wallet address ${
          withdrawal.toWalletAddress
        } from account ${
          withdrawal.fromAccountId
        }`
      );
    }
    let totalAmount = BigInt(withdrawal.amount) + BigInt(fees);

    let height;
    if (this.lastBlockHeight == null) {
      height = await this.blockchainAdapter.fetchHeight();
    } else {
      height = this.lastBlockHeight;
    }

    await this.crud.create({
      type: 'Withdrawal',
      value: {
        createdDate: this.thinky.r.now(),
        settled: false,
        settlementShardKey,
        transactionId,
        signedTransaction: JSON.stringify(signedTransaction),
        accountId: withdrawal.fromAccountId,
        amount: withdrawal.amount,
        toWalletAddress: withdrawal.toWalletAddress,
        fromWalletAddress: signedTransaction.senderId,
        fees,
        id: signedTransaction.id
      }
    });

    try {
      await this.execTransaction({
        id: transactionId,
        accountId: withdrawal.fromAccountId,
        type: 'withdrawal',
        recordType: 'debit',
        amount: totalAmount.toString()
      });
    } catch (error) {
      // If it fails here, the transaction will be created later during
      // the processing phase.
      this.emit('error', {error});
    }

    return {
      withdrawalId: signedTransaction.id
    };
  }

  async processPendingWithdrawals(currentBlockHeight) {
    if (this.shardInfo.shardIndex == null || this.shardInfo.shardCount == null) {
      return;
    }
    let shardRange = getShardRange(this.shardInfo.shardIndex, this.shardInfo.shardCount);
    let unprocessedWithdrawals = await this.thinky.r.table('Withdrawal')
    .between(shardRange.start, shardRange.end, {index: 'settlementShardKey'})
    .orderBy(this.thinky.r.asc('createdDate'))
    .run();

    await Promise.all(
      unprocessedWithdrawals.map(async (withdrawal) => {
        let transaction;
        try {
          transaction = await this.thinky.r.table('Transaction').get(withdrawal.transactionId).run();
        } catch (error) {
          this.emit('error', {error});
        }
        if (transaction == null) {
          let signedTransaction = JSON.parse(withdrawal.signedTransaction);
          let fees = await this.blockchainAdapter.fetchFees(signedTransaction);
          if (fees == null) {
            throw new Error(
              `Failed to calculate fees when attempting to process withdrawal to wallet address ${
                withdrawal.toWalletAddress
              } from account ${
                withdrawal.accountId
              }`
            );
          }
          let totalAmount;
          try {
            totalAmount = BigInt(withdrawal.amount) + BigInt(fees);
          } catch (error) {
            this.emit('error', {error});
            await this.crud.update({
              type: 'Withdrawal',
              id: withdrawal.id,
              value: {
                canceled: true,
                settled: true,
                settledDate: this.thinky.r.now()
              }
            });
            await this.crud.delete({
              type: 'Withdrawal',
              id: withdrawal.id,
              field: 'settlementShardKey'
            });
            return;
          }
          await this.execTransaction({
            id: withdrawal.transactionId,
            accountId: withdrawal.accountId,
            type: 'withdrawal',
            recordType: 'debit',
            amount: totalAmount.toString()
          });
          return;
        }
        if (transaction.settled) {
          if (transaction.canceled) {
            await this.crud.update({
              type: 'Withdrawal',
              id: withdrawal.id,
              value: {
                canceled: true,
                settled: true,
                settledDate: this.thinky.r.now()
              }
            });
            await this.crud.delete({
              type: 'Withdrawal',
              id: withdrawal.id,
              field: 'settlementShardKey'
            });
            return;
          }

          let blockchainTxn = await this.blockchainAdapter.fetchTransaction(withdrawal.id);
          if (blockchainTxn != null) {
            let targetHeight = currentBlockHeight - this.requiredWithdrawalBlockConfirmations;
            if (blockchainTxn.height <= targetHeight) {
              await this.crud.update({
                type: 'Withdrawal',
                id: withdrawal.id,
                value: {
                  height: blockchainTxn.height,
                  settled: true,
                  settledDate: this.thinky.r.now()
                }
              });
              await this.crud.delete({
                type: 'Withdrawal',
                id: withdrawal.id,
                field: 'settlementShardKey'
              });
            }
            return;
          }

          if (withdrawal.attemptCount > this.blockchainWithdrawalMaxAttempts) {
            this.emit('error', {
              error: new Error(
                `Failed to process withdrawal ${
                  withdrawal.id
                } before the maximum retry threshold was reached`
              )
            });

            await this.crud.update({
              type: 'Withdrawal',
              id: withdrawal.id,
              value: {
                canceled: true,
                settled: true,
                settledDate: this.thinky.r.now()
              }
            });
            await this.crud.delete({
              type: 'Withdrawal',
              id: withdrawal.id,
              field: 'settlementShardKey'
            });
            return;
          }

          await this.thinky.r.table('Withdrawal').get(withdrawal.id).update({
            attemptCount: this.thinky.r.row('attemptCount').add(1)
          }).run();

          this.crud.notifyResourceUpdate({
            type: 'Withdrawal',
            id: withdrawal.id,
            fields: ['attemptCount']
          });

          let signedTransaction = JSON.parse(withdrawal.signedTransaction);
          await this.blockchainAdapter.sendTransaction(signedTransaction);
        }
      })
      .map((promise) => {
        return promise.catch((error) => {
          this.emit('error', {error});
        });
      })
    );
  }

  async startBlockchainSyncInterval() {
    // Catch up to the latest height.
    while (true) {
      let done;
      try {
        done = await this.processBlockchainDeposits();
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

  async startWithdrawalInterval() {
    if (this._withdrawalIntervalRef != null) {
      clearInterval(this._withdrawalIntervalRef);
    }
    this._withdrawalIntervalRef = setInterval(async () => {
      this.withdrawalProcessingStream.write({time: Date.now()});
      if (this.withdrawalProcessingStream.getBackpressure() > HIGH_BACKPRESSURE_THRESHOLD) {
        let error = new Error(
          'The withdrawal processing getBackpressure is too high. This may cause delays in processing withdrawals.'
        );
        this.emit('error', {error});
      }
    }, this.withdrawalInterval);
  }
}

module.exports = AccountService;
