let accountIdSchema = {
  type: 'string',
  minLength: 3,
  maxLength: 40
};
let passwordSchema = {
  type: 'string',
  minLength: 7,
  maxLength: 100
};
let uuidSchema = {
  type: 'string',
  pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
};
let amountSchema = {
  type: 'string',
  pattern: '^[0-9]*$',
  minLength: 1,
  maxLength: 30
};
let walletAddressSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 100
};
let customDataSchema = {
  type: ['string', 'null'],
  maxLength: 200
};

let requestSchema = {
  getMainInfo: {},
  signup: {
    type: 'object',
    properties: {
      accountId: accountIdSchema,
      password: passwordSchema,
      admin: {type: 'boolean'},
      secretSignupKey: customDataSchema
    },
    required: ['accountId', 'password']
  },
  login: {
    type: 'object',
    properties: {
      accountId: accountIdSchema,
      password: passwordSchema
    },
    required: ['accountId', 'password']
  },
  withdraw: {
    type: 'object',
    properties: {
      amount: amountSchema,
      toWalletAddress: walletAddressSchema,
    },
    required: ['amount', 'toWalletAddress']
  },
  transfer: {
    type: 'object',
    properties: {
      amount: amountSchema,
      toAccountId: accountIdSchema,
      data: customDataSchema,
      debitId: uuidSchema,
      creditId: uuidSchema
    },
    required: ['amount', 'toAccountId']
  },
  debit: {
    type: 'object',
    properties: {
      amount: amountSchema,
      data: customDataSchema,
      debitId: uuidSchema
    },
    required: ['amount']
  },
  getBalance: {},
  adminImpersonate: {
    type: 'object',
    properties: {
      accountId: accountIdSchema
    },
    required: ['accountId']
  },
  adminWithdraw: {
    type: 'object',
    properties: {
      amount: amountSchema,
      fromAccountId: accountIdSchema,
      toWalletAddress: walletAddressSchema,
    },
    required: ['amount', 'fromAccountId', 'toWalletAddress']
  },
  adminTransfer: {
    type: 'object',
    properties: {
      amount: amountSchema,
      fromAccountId: accountIdSchema,
      toAccountId: accountIdSchema,
      data: customDataSchema,
      debitId: uuidSchema,
      creditId: uuidSchema
    },
    required: ['amount', 'fromAccountId', 'toAccountId']
  },
  adminDebit: {
    type: 'object',
    properties: {
      amount: amountSchema,
      fromAccountId: accountIdSchema,
      data: customDataSchema,
      debitId: uuidSchema
    },
    required: ['amount', 'fromAccountId']
  },
  adminCredit: {
    type: 'object',
    properties: {
      amount: amountSchema,
      toAccountId: accountIdSchema,
      data: customDataSchema,
      creditId: uuidSchema
    },
    required: ['amount', 'toAccountId']
  },
  adminGetBalance: {
    type: 'object',
    properties: {
      accountId: accountIdSchema
    },
    required: ['accountId']
  }
};

function getSchema() {
  return requestSchema;
}

module.exports = getSchema;
