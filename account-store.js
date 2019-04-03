class AccountStore {
  constructor(thinky) {
    this.thinky = thinky;
  }

  async validateLoginDetails(loginDetails) {
    let results = await this.thinky.r.table('Account').filter({email: loginDetails.email}).run();

    if (!results || !results[0]) {
      let err = new Error('Invalid email or password.');
      err.name = 'InvalidCredentialsError';
      throw err;
    }

    let accountData = results[0];

    if (accountData.active == false) {
      let accountInactiveError = new Error('Your account is currently disabled.');
      accountInactiveError.name = 'AccountInactiveError';
      throw accountInactiveError;
    }

    // let hash = crypto.createHash('sha256');
    // hash.update(loginDetails.password + accountData.passwordSalt);
    // let hashedPassword = hash.digest('hex');
    // TODO 2: Use hash instead!
    let hashedPassword = loginDetails.password;

    if (accountData.password !== hashedPassword) {
      let err = new Error('Wrong password.');
      err.name = 'InvalidCredentialsError';
      throw err;
    }
    return accountData;
  }
}

module.exports = AccountStore;
