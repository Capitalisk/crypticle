const crypto = require('crypto');
const uuid = require('uuid');
const AsyncStreamEmitter = require('async-stream-emitter');
const {generateWallet} = require('../utils/crypto');

const SALT_SIZE = 32;
const MAX_WALLET_CREATE_ATTEMPTS = 10;

const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

const MIN_PASSWORD_LENGTH = 7;
const MAX_PASSWORD_LENGTH = 50;

class AccountService extends AsyncStreamEmitter {
  constructor(options) {
    super();

    this.thinky = options.thinky;
    this.crud = options.crud;
    this.nodeInfo = options.nodeInfo;
  }

  async getAccountsByDepositWalletAddress(walletAddress) {
    return this.thinky.r.table('Account').getAll(walletAddress, {index: 'depositWalletAddress'}).run();
  }

  async verifyWalletAndFetchAccount(blockchainTransaction) {
    let walletAccountList = await this.getAccountsByDepositWalletAddress(blockchainTransaction.senderId);
    let isWalletAlreadyVerified = walletAccountList.some((account) => {
      return account.cryptoWalletVerified != null;
    });
    if (isWalletAlreadyVerified) {
      return walletAccountList[0];
    }
    let matchedWalletAccounts = walletAccountList.filter((account) => {
      return account.cryptoWalletVerificationKey === String(blockchainTransaction.amount);
    });
    if (matchedWalletAccounts.length > 1) {
      // Do not throw here because this issue cannot be resolved by retrying.
      this.emit('error', {
        error: new Error(
          `Failed to perform wallet verification because multiple accounts were registered to the same wallet address ${
            blockchainTransaction.senderId
          }`
        )
      });
      return null;
    }
    if (matchedWalletAccounts.length < 1) {
      // Do not throw here because this issue cannot be resolved by retrying.
      this.emit('error', {
        error: new Error(
          `Failed to process the blockchain transaction with id ${
            blockchainTransaction.id
          } because the wallet address ${
            blockchainTransaction.senderId
          } was not associated with any account`
        )
      });
      return null;
    }
    let walletAccount = matchedWalletAccounts[0];
    await this.crud.update({
      type: 'Account',
      id: walletAccount.id,
      field: 'cryptoWalletVerified',
      value: this.thinky.r.now()
    });
    return walletAccount;
  }

  async execTransaction(transaction) {
    return this.crud.create({
      type: 'Transaction',
      value: {
        created: this.thinky.r.now(),
        ...transaction
      }
    });
  }

  async execDepositTransaction(blockchainTransaction) {
    let account = await this.verifyWalletAndFetchAccount(blockchainTransaction);
    if (!account) {
      return {
        deposit: null,
        transaction: null
      };
    }

    let transactionId = uuid.v4();
    let deposit = {
      id: blockchainTransaction.id,
      accountId: account.id,
      transactionId,
      height: blockchainTransaction.height,
      created: this.thinky.r.now()
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
      try {
        let txn = await this.crud.read({
          type: 'Transaction',
          id: deposit.transactionId
        });
        return {
          deposit,
          transaction: txn
        };
      } catch (err) {
        transactionId = deposit.transactionId;
      }
    }
    let transaction = {
      id: transactionId,
      accountId: account.id,
      type: 'deposit',
      amount: String(blockchainTransaction.amount)
    };
    let insertedTransaction = await this.execTransaction(transaction);
    return {
      deposit,
      transaction: insertedTransaction
    };
  }

  async settleTransaction(transactionId) {
    let result = await this.thinky.r.table('Transaction')
    .get(transactionId)
    .update({settled: this.thinky.r.now()})
    .run();

    if (!result.replaced) {
      throw new Error(
        `Failed to settle transaction ${transactionId}`
      );
    }
  }

  hashPassword(password, salt) {
    let hash = crypto.createHash('sha256');
    hash.update(password + salt);
    return hash.digest('hex');
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
    if (
      typeof credentials.password !== 'string' ||
      credentials.password.length < MIN_PASSWORD_LENGTH ||
      credentials.password.length > MAX_PASSWORD_LENGTH
    ) {
      let error = new Error(
        `Password must be between ${
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
    credentials.created = this.thinky.r.now();

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
      let wallet = generateWallet();

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
    let results = await this.thinky.r.table('Account')
    .getAll(credentials.cryptoWalletAddress, {index: 'cryptoWalletAddress'})
    .run();

    if (!results || !results[0]) {
      let err = new Error('Invalid wallet address or password.');
      err.name = 'InvalidCredentialsError';
      throw err;
    }

    let accountData = results[0];

    if (accountData.active === false) {
      let accountInactiveError = new Error('Your account is currently disabled.');
      accountInactiveError.name = 'AccountInactiveError';
      throw accountInactiveError;
    }

    let hash = crypto.createHash('sha256');
    hash.update(credentials.password + accountData.passwordSalt);
    let hashedPassword = hash.digest('hex');

    if (accountData.password !== hashedPassword) {
      let err = new Error('Wrong password.');
      err.name = 'InvalidCredentialsError';
      throw err;
    }
    return accountData;
  }
}

module.exports = AccountService;
