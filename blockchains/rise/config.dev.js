module.exports = {
  secretSignupKey: '313e7cc1-ad75-4030-a927-6a09f39c1603',
  databaseName: 'crypticle',
  databaseHost: '127.0.0.1',
  databasePort: 28015,
  authKey: '15d16361-6402-41a5-8840-d2a330b8ea40',
  authTokenExpiry: 3600000,
  authTokenRenewalInterval: 20000,
  maxSocketBackpressure: 1000,
  services: {
    account: {
      transactionSettlementInterval: 5000,
      withdrawalProcessingInterval: 20000,
      maxTransactionSettlementsPerAccount: 10,
      maxConcurrentWithdrawalsPerAccount: 5,
      maxConcurrentDebitsPerAccount: 50,
      blockchainNodeWalletPassphrase: 'drastic spot aerobic web wave tourist library first scout fatal inherit arrange',
      blockchainSync: true,
      blockchainNodeAddress: 'https://wallet.rise.vision',
      blockPollInterval: 5000,
      blockFetchLimit: 100,
      blockchainWithdrawalMaxAttempts: 20,
      bcryptPasswordRounds: 10
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
    paginationShowTotalCounts: false,
    maxRecordDisplayAge: 2592000000,
    maxPageSize: 100,
    alwaysRequireSecretSignupKey: false,
    enableAdminAccountSignup: true
  }
};
