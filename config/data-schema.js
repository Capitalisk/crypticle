const agCrudRethink = require('ag-crud-rethink');
const thinky = agCrudRethink.thinky;
const type = thinky.type;

let allowedAccountReadFields = {
  username: true,
  depositWalletAddress: true,
  nationalCurrency: true,
  active: true,
  admin: true,
  balance: true,
  createdDate: true
};

let allowedAccountUpdateFields = {
  nationalCurrency: true
};

let allowedAdminAccountUpdateFields = {
  username: true,
  depositWalletAddress: true,
  depositWalletPassphrase: true,
  depositWalletPrivateKey: true,
  depositWalletPublicKey: true,
  password: true,
  stripeCustomerId: true,
  stripePaymentSetup: true,
  nationalCurrency: true,
  passwordResetKey: true,
  passwordResetExpiry: true,
  active: true
};

let allowedAdminAccountReadFields = {
  username: true,
  depositWalletAddress: true,
  depositWalletPassphrase: true,
  depositWalletPrivateKey: true,
  depositWalletPublicKey: true,
  stripeCustomerId: true,
  stripePaymentSetup: true,
  nationalCurrency: true,
  passwordResetKey: true,
  passwordResetExpiry: true,
  active: true,
  admin: true,
  balance: true,
  createdDate: true
};

function getSchema(options) {
  let {maxPageSize} = options;

  function validateQuery(req) {
    let query = req.query || {};
    if (
      query.view &&
      typeof query.pageSize === 'number' &&
      query.pageSize > maxPageSize
    ) {
      let error = new Error(
        `The specified page size of ${
          query.pageSize
        } for the ${
          query.view
        } view exceeded the maximum page size of ${
          maxPageSize
        }`
      );
      error.name = 'ForbiddenCRUDError';
      error.isClientError = true;
      throw error;
    }
  }

  function accountAccessController(req) {
    validateQuery(req);

    let query = req.query || {};
    let isOwnAccount = req.authToken && req.authToken.accountId === query.id;
    let isAdmin = req.authToken && req.authToken.admin;
    let isView = !!query.view;

    if (isOwnAccount) {
      if (req.action === 'read' || req.action === 'subscribe') {
        if (allowedAccountReadFields[query.field]) {
          return;
        }
      }
      if (req.action === 'update') {
        if (allowedAccountUpdateFields[query.field]) {
          return;
        }
      }
    }
    if (isAdmin) {
      if (req.action === 'read' || req.action === 'subscribe') {
        if (isView || allowedAdminAccountReadFields[query.field]) {
          return;
        }
      }
      if (req.action === 'update') {
        if (allowedAdminAccountUpdateFields[query.field]) {
          return;
        }
      }
    }

    if (
      query.view === 'usernameSearchView' &&
      (req.action === 'read' || req.action === 'subscribe')
    ) {
      return;
    }

    if (
      query.field === 'username' &&
      (req.action === 'read' || req.action === 'subscribe')
    ) {
      return;
    }

    let error = new Error('Not allowed to perform CRUD operation');
    error.name = 'ForbiddenCRUDError';
    error.isClientError = true;
    throw error;
  }

  function privateResourceAccessController(req) {
    let query = req.query || {};
    let isLoggedIn = req.authToken;
    let isAdmin = req.authToken && req.authToken.admin;
    let viewParams = query.viewParams || {};
    let isOwnResource = req.authToken && (
      (req.resource && req.authToken.accountId === req.resource.accountId) ||
      (req.authToken.accountId === viewParams.accountId)
    );

    if (isOwnResource) {
      if (req.action === 'read' || req.action === 'subscribe') {
        return;
      }
    }
    if (isAdmin) {
      if (req.action === 'read' || req.action === 'subscribe') {
        return;
      }
      if (req.action === 'update') {
        if (query.type === 'Withdrawal' && query.field === 'canceled') {
          return;
        }
      }
    }

    let error = new Error('Not allowed to perform CRUD operation');
    error.name = 'ForbiddenCRUDError';
    error.isClientError = true;
    throw error;
  }

  return {
    Account: {
      fields: {
        username: type.string(),
        depositWalletAddress: type.string(),
        depositWalletPassphrase: type.string(),
        depositWalletPrivateKey: type.string(),
        depositWalletPublicKey: type.string(),
        password: type.string(),
        stripeCustomerId: type.string().optional(),
        stripePaymentSetup: type.boolean().default(false),
        nationalCurrency: type.string().default('USD'),
        passwordResetKey: type.string().optional(),
        passwordResetExpiry: type.date().optional(),
        maxConcurrentWithdrawals: type.number().optional(),
        maxConcurrentTransfers: type.number().optional(),
        maxSocketBackpressure: type.number().optional(),
        active: type.boolean().default(true),
        admin: type.boolean().default(false),
        balance: type.string().default('0'),
        createdDate: type.date()
      },
      indexes: ['username', 'depositWalletAddress'],
      access: {
        pre: accountAccessController
      },
      views: {
        usernameSearchView: {
          paramFields: ['searchString'],
          primaryKeys: [],
          transform: function (fullTableQuery, r, params) {
            if (params.searchString === '') {
              return fullTableQuery.limit(0);
            }
            return fullTableQuery
            .between(
              params.searchString,
              r.maxval,
              {index: 'username', rightBound: 'closed'}
            )
            .orderBy({index: 'username'})
            .limit(20)
            .filter((doc) => {
              return doc('username').match(`^${params.searchString}`);
            });
          }
        }
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
        pre: validateQuery,
        post: privateResourceAccessController
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
        pre: validateQuery,
        post: privateResourceAccessController
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
        attemptCount: type.number().default(0),
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
        pre: validateQuery,
        post: privateResourceAccessController
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

module.exports = getSchema;
