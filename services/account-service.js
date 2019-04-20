const crypto = require('crypto');

const SALT_SIZE = 32;
const WALLET_VERIFICATION_SECRET_SIZE = 4;

class AccountService {
  constructor(options) {
    this.thinky = options.thinky;
    this.crud = options.crud;
    this.nodeInfo = options.nodeInfo;
    this.walletAddressRegExp = new RegExp(this.nodeInfo.walletAddressRegex);
  }

  async getAccountsByWalletAddress(walletAddress, onlyUnverifiedWallets) {
    let query = this.thinky.r.table('Account').getAll(walletAddress, {index: 'cryptoWalletAddress'});
    if (onlyUnverifiedWallets) {
      query = query.filter(
        this.thinky.r.row.hasFields('cryptoWalletVerified').not()
      );
    }
    return query.run();
  }

  async verifyWalletAndFetchAccount(blockchainTransaction) {
    let walletAccountList = await this.getAccountsByWalletAddress(blockchainTransaction.senderId);
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
      throw new Error(
        `Failed to perform wallet verification because multiple accounts were registered to the same wallet address ${
          blockchainTransaction.senderId
        }`
      );
    }
    if (matchedWalletAccounts.length < 1) {
      throw new Error(
        `Failed to process the blockchain transaction with id ${
          blockchainTransaction.id
        } because the wallet address ${
          blockchainTransaction.senderId
        } was not associated with any account`
      );
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
    transaction = {...transaction};
    if (transaction.type === 'deposit') {
      let result = await this.thinky.r.table('Transaction').getAll(
        transaction.referenceId,
        {index: 'referenceId'}
      ).run();
      if (result.length > 0) {
        throw new Error(
          `A deposit transaction with referenceId ${
            transaction.referenceId
          } has already been processed`
        );
      }
    }
    if (!transaction.created) {
      transaction.created = this.thinky.r.now();
    }
    return this.crud.create({
      type: 'Transaction',
      value: transaction
    });
  }

  hashPassword(password, salt) {
    let hash = crypto.createHash('sha256');
    hash.update(password + salt);
    return hash.digest('hex');
  }

  async sanitizeSignupCredentials(credentials) {
    credentials = {...credentials};
    if (!credentials || credentials.cryptoWalletAddress == null || credentials.password == null) {
      let error = new Error('Account credentials were not provided.');
      error.name = 'NoCredentialsProvidedError';
      throw error;
    }
    if (
      typeof credentials.cryptoWalletAddress !== 'string' ||
      !this.walletAddressRegExp.test(credentials.cryptoWalletAddress)
    ) {
      let error = new Error('The provided wallet address was invalid.');
      error.name = 'InvalidWalletAddressError';
      throw error;
    }
    if (typeof credentials.password !== 'string' || credentials.password.length < 7) {
      let error = new Error('Password must be at least 7 characters long.');
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

    let randomBytes = await new Promise((resolve, reject) => {
      crypto.randomBytes(WALLET_VERIFICATION_SECRET_SIZE, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });

    credentials.cryptoWalletVerificationKey = randomBytes.readUIntBE(0, WALLET_VERIFICATION_SECRET_SIZE).toString();

    // Add random password salt.
    credentials.passwordSalt = randomBuffer.toString('hex');
    // Only store the salted hash of the password.
    credentials.password = this.hashPassword(credentials.password, credentials.passwordSalt);
    credentials.created = this.thinky.r.now();

    let data;
    try {
      // Verify that wallet address is not already taken.
      data = await this.thinky.r.table('Account')
      .getAll(credentials.cryptoWalletAddress, {index: 'cryptoWalletAddress'})
      .filter(this.thinky.r.row.hasFields('cryptoWalletVerified'))
      .run();
    } catch (error) {
      let badLookupError = new Error('Failed to check against existing account data in database.');
      badLookupError.name = 'BadAccountLookupError';
      throw badLookupError;
    }

    if (data[0] != null) {
      let alreadyTakenError = new Error(
        `An account with the wallet address ${credentials.cryptoWalletAddress} already exists.`
      );
      alreadyTakenError.name = 'SignUpWalletAddressTakenError';
      throw alreadyTakenError;
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
