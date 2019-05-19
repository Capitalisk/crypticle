module.exports = {
  origin: 'http://localhost:8000',
  adminEmailAddress: 'Crypticle <grosjona@yahoo.com.au>',
  services: {
    account: {
      transactionSettlementInterval: 5000,
      withdrawalProcessingInterval: 5000,
      maxTransactionSettlementsPerAccount: 100,
      blockchainAdapterPath: null,
      blockchainSync: true,
      blockchainNodeAddress: 'https://wallet.rise.vision',
      blockPollInterval: 5000,
      blockFetchLimit: 100
    },
    fiat: {
      name: 'stripe',
      apiSecretKey: 'sk_test_QlUgKWhOjRrIeTO4YWUaExQH'
    }
  },
  mainInfo: {
    cryptocurrency: {
      name: 'Rise',
      symbol: 'RISE',
      unit: '100000000'
    },
    mainWalletAddress: '16237277499158857342R',
    requiredDepositBlockConfirmations: 3,
    requiredWithdrawalBlockConfirmations: 3,
    maxRecordDisplayAge: 2592000000
  }
};
