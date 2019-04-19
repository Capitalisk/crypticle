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
      type: type.string(), // Can be 'deposit', 'withdrawal', 'balance'
      referenceId: type.string(),
      amount: type.string(),
      balance: type.string().optional(),
      settled: type.date().optional(),
      created: type.date()
    },
    indexes: ['accountId', 'referenceId'],
    views: {
      accountDepositsPendingView: {
        paramFields: ['accountId'],
        transform: function (fullTableQuery, r, productFields) {
          return fullTableQuery
          .getAll(productFields.accountId, {index: 'accountId'})
          .filter(r.row('type').eq('deposit'))
          .filter(function (account) {
            return account.hasFields('settled').not();
          })
          .orderBy(r.asc('desc'));
        }
      },
      accountDepositsSettledView: {
        paramFields: ['accountId'],
        transform: function (fullTableQuery, r, productFields) {
          return fullTableQuery
          .getAll(productFields.accountId, {index: 'accountId'})
          .filter(r.row('type').eq('deposit'))
          .filter(function (account) {
            return account.hasFields('settled');
          })
          .orderBy(r.asc('desc'));
        }
      },
      accountWithdrawalsPendingView: {
        paramFields: ['accountId'],
        transform: function (fullTableQuery, r, productFields) {
          return fullTableQuery
          .getAll(productFields.accountId, {index: 'accountId'})
          .filter(r.row('type').eq('withdrawal'))
          .filter(function (account) {
            return account.hasFields('settled').not();
          })
          .orderBy(r.asc('desc'));
        }
      },
      accountWithdrawalsSettledView: {
        paramFields: ['accountId'],
        transform: function (fullTableQuery, r, productFields) {
          return fullTableQuery
          .getAll(productFields.accountId, {index: 'accountId'})
          .filter(r.row('type').eq('withdrawal'))
          .filter(function (account) {
            return account.hasFields('settled');
          })
          .orderBy(r.asc('desc'));
        }
      },
      accountBalanceTransactionsPendingView: {
        paramFields: ['accountId'],
        transform: function (fullTableQuery, r, productFields) {
          return fullTableQuery
          .getAll(productFields.accountId, {index: 'accountId'})
          .filter(r.row('type').eq('balance'))
          .filter(function (account) {
            return account.hasFields('settled').not();
          })
          .orderBy(r.asc('desc'));
        }
      },
      accountBalanceTransactionsSettledView: {
        paramFields: ['accountId'],
        transform: function (fullTableQuery, r, productFields) {
          return fullTableQuery
          .getAll(productFields.accountId, {index: 'accountId'})
          .filter(r.row('type').eq('balance'))
          .filter(function (account) {
            return account.hasFields('settled');
          })
          .orderBy(r.asc('desc'));
        }
      }
    },
    access: {
      pre: accountTransactionsPrefilter
    }
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

async function accountTransactionsPrefilter(req) {
  return;
  // TODO 2: Restrict the fields that a user can only see transactions that are associated with their own account.
}
