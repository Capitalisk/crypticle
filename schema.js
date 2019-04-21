const agCrudRethink = require('ag-crud-rethink');
const thinky = agCrudRethink.thinky;
const type = thinky.type;

module.exports = {
  Account: {
    fields: {
      cryptoWalletAddress: type.string(),
      cryptoWalletVerified: type.date().optional(),
      cryptoWalletVerificationKey: type.string(),
      password: type.string(),
      passwordSalt: type.string(),
      stripeCustomerId: type.string().optional(),
      stripePaymentSetup: type.boolean().default(false),
      nationalCurrency: type.string().default('USD'),
      passwordResetKey: type.string().optional(),
      passwordResetExpiry: type.date().optional(),
      active: type.boolean().default(true),
      created: type.date()
    },
    indexes: ['cryptoWalletAddress'],
    access: {
      pre: accountAccessPrefilter
    }
  },
  Transaction: {
    fields: {
      accountId: type.string(),
      type: type.string(), // Can be 'deposit', 'withdrawal', 'credit' or 'debit'
      amount: type.string(),
      counterpartyId: type.string().optional(),
      balance: type.string().optional(),
      settled: type.date().optional(),
      canceled: type.date().optional(),
      created: type.date()
    },
    indexes: ['accountId', 'settled', 'created'],
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
          .orderBy(r.desc('created'));
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
          .orderBy(r.desc('settled'));
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
          .orderBy(r.desc('created'));
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
          .orderBy(r.desc('settled'));
        }
      },
      accountTransfersPendingView: {
        paramFields: ['accountId'],
        transform: function (fullTableQuery, r, productFields) {
          return fullTableQuery
          .getAll(productFields.accountId, {index: 'accountId'})
          .filter(
            r.row('type').eq('credit')
            .or(r.row('type').eq('debit'))
          )
          .filter(function (account) {
            return account.hasFields('settled').not();
          })
          .orderBy(r.desc('created'));
        }
      },
      accountTransfersSettledView: {
        paramFields: ['accountId'],
        transform: function (fullTableQuery, r, productFields) {
          return fullTableQuery
          .getAll(productFields.accountId, {index: 'accountId'})
          .filter(
            r.row('type').eq('credit')
            .or(r.row('type').eq('debit'))
          )
          .filter(function (account) {
            return account.hasFields('settled');
          })
          .orderBy(r.desc('settled'));
        }
      }
    },
    access: {
      pre: accountTransactionsPrefilter
    }
  },
  Deposit: {
    fields: {
      internalTransactionId: type.string(),
      height: type.number()
    },
    indexes: ['internalTransactionId', 'processed']
  },
  Withdrawal: {
    fields: {
      internalTransactionId: type.string(),
      signedTransaction: type.string(),
      lastAttempt: type.date(),
      settled: type.date().optional()
    },
    indexes: ['internalTransactionId', 'processed']
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
