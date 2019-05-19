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
        type: type.string(), // Can be 'deposit', 'withdrawal', 'credit' or 'debit'
        amount: type.string(),
        counterpartyId: type.string().optional(),
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
        'settled',
        'settledDate',
        'settlementShardKey',
        'createdDate',
        {
          name: 'accountIdCreatedDate',
          type: 'compound', // Compound indexes are ordered lexicographically
          fn: function (r) {
            return [r.row('accountId'), r.row('createdDate')];
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
            .orderBy({index: r.desc('accountIdSettledDate')});
          }
        },
        accountTransfersPendingView: {
          paramFields: ['accountId'],
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, startTime],
              [params.accountId, r.maxval],
              {index: 'accountIdCreatedDate', rightBound: 'closed'}
            )
            .filter(
              r.row('type').eq('credit')
              .or(r.row('type').eq('debit'))
            )
            .filter(r.row('settled').eq(false))
            .orderBy(r.desc('createdDate'));
          }
        },
        accountTransfersSettledView: {
          paramFields: ['accountId'],
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, startTime],
              [params.accountId, r.maxval],
              {index: 'accountIdCreatedDate', rightBound: 'closed'}
            )
            .filter(
              r.row('type').eq('credit')
              .or(r.row('type').eq('debit'))
            )
            .filter(r.row('settled').eq(true))
            .orderBy(r.desc('settledDate'));
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
          name: 'accountIdCreatedDate',
          type: 'compound', // Compound indexes are ordered lexicographically
          fn: function (r) {
            return [r.row('accountId'), r.row('createdDate')];
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
          foreignAffectingFields: {
            Transaction: ['settled']
          },
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, startTime],
              [params.accountId, r.maxval],
              {index: 'accountIdCreatedDate', rightBound: 'closed'}
            )
            .filter(
              r.db(options.dbName).table('Transaction')
              .getAll(r.row('transactionId'), {index: 'id'})
              .filter(txn => txn('settled').eq(true))
              .count().eq(0)
            )
            .orderBy(r.desc('createdDate'));
          }
        },
        accountDepositsSettledView: {
          paramFields: ['accountId'],
          foreignAffectingFields: {
            Transaction: ['settled']
          },
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, startTime],
              [params.accountId, r.maxval],
              {index: 'accountIdCreatedDate', rightBound: 'closed'}
            )
            .filter(
              r.db(options.dbName).table('Transaction')
              .getAll(r.row('transactionId'), {index: 'id'})
              .filter(txn => txn('settled').eq(true))
              .count().gt(0)
            )
            .orderBy(r.desc('createdDate'));
          }
        }
      }
    },
    Withdrawal: {
      fields: {
        accountId: type.string(),
        transactionId: type.string(),
        height: type.number().default(null),
        signedTransaction: type.string(),
        walletAddress: type.string(),
        amount: type.string(),
        canceled: type.boolean().default(false),
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
          name: 'accountIdCreatedDate',
          type: 'compound', // Compound indexes are ordered lexicographically
          fn: function (r) {
            return [r.row('accountId'), r.row('createdDate')];
          }
        }
      ],
      access: {
        pre: accountTransactionsPrefilter // TODO 2: Check that filters are correct.
      },
      views: {
        accountWithdrawalsPendingView: {
          paramFields: ['accountId'],
          foreignAffectingFields: {
            Transaction: ['settled']
          },
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, startTime],
              [params.accountId, r.maxval],
              {index: 'accountIdCreatedDate', rightBound: 'closed'}
            )
            .filter(
              r.db(options.dbName).table('Transaction')
              .getAll(r.row('transactionId'), {index: 'id'})
              .filter(txn => txn('settled').eq(true))
              .count().eq(0)
            )
            .orderBy(r.desc('createdDate'));
          }
        },
        accountWithdrawalsSettledView: {
          paramFields: ['accountId'],
          foreignAffectingFields: {
            Transaction: ['settled']
          },
          transform: function (fullTableQuery, r, params) {
            let startTime = r.now().sub(options.maxRecordDisplayAge / 1000);
            return fullTableQuery
            .between(
              [params.accountId, startTime],
              [params.accountId, r.maxval],
              {index: 'accountIdCreatedDate', rightBound: 'closed'}
            )
            .filter(
              r.db(options.dbName).table('Transaction')
              .getAll(r.row('transactionId'), {index: 'id'})
              .filter(txn => txn('settled').eq(true))
              .count().gt(0)
            )
            .orderBy(r.desc('createdDate'));
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
