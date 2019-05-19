module.exports = {
  origin: 'http://localhost:8000',
  adminEmailAddress: 'Crypticle <grosjona@yahoo.com.au>',
  services: {
    account: {
      transactionSettlementInterval: 5000,
      withdrawalProcessingInterval: 5000,
      maxTransactionSettlementsPerAccount: 100,
      blockchainNodeWalletPassphrase: 'drastic spot aerobic web wave tourist library first scout fatal inherit arrange',
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
    mainWalletAddress: '16460447528999404929R',
    requiredDepositBlockConfirmations: 3,
    requiredWithdrawalBlockConfirmations: 3,
    maxRecordDisplayAge: 2592000000
  }
};
