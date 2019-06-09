let usernameSchema = {
  type: 'string',
  minLength: 0,
  maxLength: 200
};
let passwordSchema = {
  type: 'string',
  minLength: 0,
  maxLength: 200
};
let uuidSchema = {
  type: 'string',
  pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
};
let amountSchema = {
  type: 'string',
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
  getBalance: {},
  getMainInfo: {},
  withdraw: {
    type: 'object',
    properties: {
      amount: amountSchema,
      toWalletAddress: walletAddressSchema,
    },
    required: ['amount', 'toWalletAddress']
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
  adminGetBalance: {
    type: 'object',
    properties: {
      accountId: uuidSchema
    },
    required: ['accountId']
  },
  adminWithdraw: {
    type: 'object',
    properties: {
      amount: amountSchema,
      fromAccountId: uuidSchema,
      toWalletAddress: walletAddressSchema,
    },
    required: ['amount', 'fromAccountId', 'toWalletAddress']
  }
};

function getSchema() {
  return requestSchema;
}

module.exports = getSchema;
