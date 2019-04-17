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
      cryptoWalletVerified: type.date().optional(),
      cryptoWalletVerificationKey: type.string(),
      emailVerified: type.date().optional(),
      emailVerificationKey: type.string().optional(),
      emailVerificationExpiry: type.date().optional(),
      passwordResetKey: type.string().optional(),
      passwordResetExpiry: type.date().optional(),
      active: type.boolean().default(true),
      created: type.date()
    },
    indexes: ['email', 'cryptoWalletAddress'],
    access: {
      pre: accountAccessPrefilter
    }
  },
  Transaction: {
    fields: {
      accountId: type.string(),
      type: type.string(), // Can be 'deposit', 'withdrawal', 'credit', 'debit'
      referenceId: type.string(),
      amount: type.string(),
      balance: type.string().optional(),
      settled: type.date().optional(),
      created: type.date()
    },
    indexes: ['accountId', 'referenceId']
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
  // TODO 2: Restrict the fields that a user can modify on his own account.
}
