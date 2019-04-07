const agCrudRethink = require('ag-crud-rethink');
const thinky = agCrudRethink.thinky;
const type = thinky.type;

module.exports = {
  Account: {
    fields: {
      email: type.string().email(),
      password: type.string(),
      passwordSalt: type.string(),
      stripeCustomerId: type.string().optional(),
      stripePaymentSetup: type.boolean().default(false),
      nationalCurrency: type.string().default('USD'),
      cryptoWalletAddress: type.string().optional(),
      cryptoWalletVerified: type.boolean().default(false),
      cryptoWalletVerificationKey: type.string(),
      emailVerified: type.boolean().default(false),
      emailVerificationKey: type.string().optional(),
      emailVerificationExpiry: type.date().optional(),
      passwordResetKey: type.string().optional(),
      passwordResetExpiry: type.date().optional(),
      active: type.boolean().default(true),
      created: type.date()
    },
    indexes: ['email'],
    access: {
      pre: accountAccessPrefilter
    }
  },
  CryptoTransaction: {
    fields: {
      accountId: type.string(),
      type: type.string(), // Can be 'deposit', 'withdrawal', 'credit', 'debit'
      amount: type.string(),
      balance: type.string(),
      settled: type.date().optional(),
      created: type.date()
    },
    indexes: ['accountId']
  },
  Activity: {
    fields: {
      type: type.string(),
      action: type.string().optional(),
      data: type.object().optional(),
      created: type.date()
    }
  },
  Mail: {
    fields: {
      data: type.object(),
      created: type.date()
    }
  }
};

async function accountAccessPrefilter(req) {
  if (req.action == 'create') {
    return;
  }
  if (!req.authToken || !req.query || !req.authToken.accountId || req.authToken.accountId != req.query.id) {
    throw new Error('A user can only access and modify their own account');
  }
}
