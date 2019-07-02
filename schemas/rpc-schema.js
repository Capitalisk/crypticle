let usernameSchema = {
  type: 'string',
  minLength: 3,
  maxLength: 30
};
let passwordSchema = {
  type: 'string',
  minLength: 7,
  maxLength: 50
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
      username: usernameSchema,
      password: passwordSchema,
      admin: {type: 'boolean'},
      secretSignupKey: customDataSchema
    },
    required: ['username', 'password']
  },
  login: {
    type: 'object',
    properties: {
      username: usernameSchema,
      password: passwordSchema
    },
    required: ['username', 'password']
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
      toAccountId: uuidSchema,
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
      username: usernameSchema
    },
    required: ['username']
  },
  adminWithdraw: {
    type: 'object',
    properties: {
      amount: amountSchema,
      fromAccountId: uuidSchema,
      toWalletAddress: walletAddressSchema,
    },
    required: ['amount', 'fromAccountId', 'toWalletAddress']
  },
  adminTransfer: {
    type: 'object',
    properties: {
      amount: amountSchema,
      fromAccountId: uuidSchema,
      toAccountId: uuidSchema,
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
      fromAccountId: uuidSchema,
      data: customDataSchema,
      debitId: uuidSchema
    },
    required: ['amount', 'fromAccountId']
  },
  adminCredit: {
    type: 'object',
    properties: {
      amount: amountSchema,
      toAccountId: uuidSchema,
      data: customDataSchema,
      creditId: uuidSchema
    },
    required: ['amount', 'toAccountId']
  },
  adminGetBalance: {
    type: 'object',
    properties: {
      accountId: uuidSchema
    },
    required: ['accountId']
  }
};

function getSchema() {
  return requestSchema;
}

module.exports = getSchema;
