const uuid = require('uuid');
const crypto = require('crypto');

const SALT_SIZE = 32;

class AccountService {
  constructor(thinky) {
    this.thinky = thinky;
  }

  hashPassword(password, salt) {
    let hash = crypto.createHash('sha256');
    hash.update(password + salt);
    return hash.digest('hex');
  }

  async sanitizeSignupCredentials(accountCredentials) {
    let credentials = {
      ...accountCredentials
    };
    if (!credentials || credentials.email == null || credentials.password == null) {
      let error = new Error('Account credentials were not provided.');
      error.name = 'NoCredentialsProvidedError';
      throw error;
    }
    if (typeof credentials.email != 'string' || credentials.email.indexOf('@') == -1) {
      let error = new Error('The provided email address was invalid.');
      error.name = 'InvalidEmailAddressError';
      throw error;
    }
    if (typeof credentials.password != 'string' || credentials.password.length < 7) {
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

    if (credentials.email) {
      credentials.email = credentials.email.toLowerCase();
    }

    // Generate a new unique serviceKey for each account which gets created.
    credentials.serviceKey = uuid.v4();
    credentials.active = true;

    credentials.emailVerificationKey = uuid.v4();
    credentials.emailVerificationExpiry = this.thinky.r.now().add(30 * 24 * 60 * 60);

    // Add random password salt.
    credentials.passwordSalt = randomBuffer.toString('hex');
    // Only store the salted hash of the password.
    credentials.password = this.hashPassword(credentials.password, credentials.passwordSalt);
    credentials.created = this.thinky.r.now();

    let data;
    try {
      // Verify that email is not already taken.
      data = await this.thinky.r.table('Account').getAll(credentials.email, {index: 'email'}).run();
    } catch (error) {
      let badLookupError = new Error('Failed to check against existing account data in database.');
      badLookupError.name = 'BadAccountLookupError';
      throw badLookupError;
    }

    if (data[0] == null) {
      // TODO: Allow email service to be customized.
      // sendEmailVerificationEmail(req.socket.remoteAddress, credentials.email, credentials.emailVerificationKey);
      // let emailOptions = {
      //   email: credentials.email
      // };
      // let emailBody = emails.accountCreatedAdmin(emailOptions);
      // sendEmailToAdmin(req.socket.remoteAddress, 'New Baasil.io signup (' + credentials.plan + '): ' + credentials.email, emailBody);
    } else {
      let accountEmailTakenError = new Error(`A account with the email ${credentials.email} already exists.`);
      accountEmailTakenError.name = 'SignUpEmailTakenError';
      throw accountEmailTakenError;
    }
    
    return credentials;
  }

  async verifyLoginCredentials(accountCredentials) {
    let results = await this.thinky.r.table('Account').filter({email: accountCredentials.email}).run();

    if (!results || !results[0]) {
      let err = new Error('Invalid email or password.');
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
    hash.update(accountCredentials.password + accountData.passwordSalt);
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
