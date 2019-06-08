const agCrudRethink = require('ag-crud-rethink');
const thinky = agCrudRethink.thinky;
const type = thinky.type;

function getSchema(options) {
  return {
    Account: {
      fields: {
        username: type.string(),
        depositWalletAddress: type.string(),
        depositWalletPassphrase: type.string(),
        depositWalletPrivateKey: type.string(),
        depositWalletPublicKey: type.string(),
        password: type.string(),
        passwordSalt: type.string(),
        stripeCustomerId: type.string().optional(),
        stripePaymentSetup: type.boolean().default(false),
        nationalCurrency: type.string().default('USD'),
        passwordResetKey: type.string().optional(),
        passwordResetExpiry: type.date().optional(),
        active: type.boolean().default(true),
        admin: type.boolean().default(false),
        createdDate: type.date()
      },
      indexes: ['username', 'depositWalletAddress'],
      access: {
        pre: accountAccessPrefilter
      }
    },
    Transaction: {
      fields: {
        accountId: type.string(),
        type: type.string(), // Can be 'deposit', 'withdrawal' or 'transfer'
        recordType: type.string(), // Can be 'credit' or 'debit'
        amount: type.string(),
        counterpartyAccountId: type.string().optional(),
        counterpartyTransactionId: type.string().optional(),
        data: type.string().optional(),
        balance: type.string().optional(),
        settled: type.boolean().default(false),
        settledDate: type.date().optional(),
        settlementShardKey: type.number().optional(),
        canceled: type.boolean().default(false),
        createdDate: type.date()
      },
      indexes: [
        'accountId',
        'settlementShardKey',
        'createdDate',
        {
          name: 'accountIdTypeSettledCreatedDate',
          type: 'compound', // Compound indexes are ordered lexicographically
          fn: function (r) {
            return [r.row('accountId'), r.row('type'), r.row('settled'), r.row('createdDate')];
          }
        },
        {
          name: 'accountIdSettledDate',
          type: 'compound', // Compound indexes are ordered lexicographically
          fn: function (r) {
            return [r.row('accountId'), r.row('settledDate')];
          }
        }
      ],
      access: {
        pre: accountTransactionsPrefilter
      },
      views: {
        lastSettledTransactions: {
          paramFields: ['accountId'],
          affectingFields: ['settledDate'],
          transform: function (fullTableQuery, r, params) {
            return fullTableQuery
            .between(
              [params.accountId, r.minval],
              [params.accountId, r.maxval],
              {index: 'accountIdSettledDate', rightBound: 'closed'}
            )
            .orderBy({index: r.desc('accountIdSettledDate')})
            .limit(10); // This limit is necessary for performance reasons.
          }
        },
        accountTransfersPendingView: {
          paramFields: ['accountId'],
          affectingFields: ['settled'],
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, 'transfer', false, startTime],
              [params.accountId, 'transfer', false, r.maxval],
              {index: 'accountIdTypeSettledCreatedDate', rightBound: 'closed'}
            )
            .orderBy({index: r.desc('accountIdTypeSettledCreatedDate')});
          }
        },
        accountTransfersSettledView: {
          paramFields: ['accountId'],
          affectingFields: ['settled'],
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, 'transfer', true, startTime],
              [params.accountId, 'transfer', true, r.maxval],
              {index: 'accountIdTypeSettledCreatedDate', rightBound: 'closed'}
            )
            .orderBy({index: r.desc('accountIdTypeSettledCreatedDate')});
          }
        }
      }
    },
    Deposit: {
      fields: {
        accountId: type.string(),
        transactionId: type.string(),
        height: type.number(),
        amount: type.string(),
        settled: type.boolean().default(false),
        settledDate: type.date().optional(),
        settlementShardKey: type.number().optional(),
        canceled: type.boolean().default(false),
        createdDate: type.date()
      },
      indexes: [
        'accountId',
        'transactionId',
        'createdDate',
        'settlementShardKey',
        {
          name: 'accountIdSettledCreatedDate',
          type: 'compound', // Compound indexes are ordered lexicographically
          fn: function (r) {
            return [r.row('accountId'), r.row('settled'), r.row('createdDate')];
          }
        }
      ],
      access: {
        pre: accountTransactionsPrefilter // TODO 2: Check that filters are correct.
      },
      relations: {
        Transaction: {
          accountId: function (transaction) {
            return transaction.accountId;
          },
          transactionId: function (transaction) {
            return transaction.id;
          }
        }
      },
      views: {
        accountDepositsPendingView: {
          paramFields: ['accountId'],
          affectingFields: ['settled'],
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, false, startTime],
              [params.accountId, false, r.maxval],
              {index: 'accountIdSettledCreatedDate', rightBound: 'closed'}
            )
            .orderBy({index: r.desc('accountIdSettledCreatedDate')});
          }
        },
        accountDepositsSettledView: {
          paramFields: ['accountId'],
          affectingFields: ['settled'],
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, true, startTime],
              [params.accountId, true, r.maxval],
              {index: 'accountIdSettledCreatedDate', rightBound: 'closed'}
            )
            .orderBy({index: r.desc('accountIdSettledCreatedDate')});
          }
        }
      }
    },
    Withdrawal: {
      fields: {
        accountId: type.string(),
        transactionId: type.string(),
        height: type.number().default(null),
        firstAttemptedHeight: type.number().default(null),
        signedTransaction: type.string(),
        toWalletAddress: type.string(),
        fromWalletAddress: type.string(),
        amount: type.string(),
        fees: type.string(),
        canceled: type.boolean().default(false),
        data: type.string().optional(),
        settled: type.boolean().default(false),
        settledDate: type.date().optional(),
        settlementShardKey: type.number().optional(),
        createdDate: type.date()
      },
      indexes: [
        'accountId',
        'transactionId',
        'createdDate',
        'settlementShardKey',
        {
          name: 'accountIdSettledCreatedDate',
          type: 'compound', // Compound indexes are ordered lexicographically
          fn: function (r) {
            return [r.row('accountId'), r.row('settled'), r.row('createdDate')];
          }
        }
      ],
      access: {
        pre: accountTransactionsPrefilter // TODO 2: Check that filters are correct.
      },
      views: {
        accountWithdrawalsPendingView: {
          paramFields: ['accountId'],
          affectingFields: ['settled'],
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, false, startTime],
              [params.accountId, false, r.maxval],
              {index: 'accountIdSettledCreatedDate', rightBound: 'closed'}
            )
            .orderBy({index: r.desc('accountIdSettledCreatedDate')});
          }
        },
        accountWithdrawalsSettledView: {
          paramFields: ['accountId'],
          affectingFields: ['settled'],
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, true, startTime],
              [params.accountId, true, r.maxval],
              {index: 'accountIdSettledCreatedDate', rightBound: 'closed'}
            )
            .orderBy({index: r.desc('accountIdSettledCreatedDate')});
          }
        }
      }
    }
  };
}

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

module.exports = getSchema;
