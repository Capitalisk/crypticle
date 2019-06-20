module.exports = {
  secretSignupKey: '313e7cc1-ad75-4030-a927-6a09f39c1603',
  databaseName: 'crypticle_rise',
  authKey: '15d16361-6402-41a5-8840-d2a330b8ea40',
  authTokenExpiry: 30000,
  authTokenRenewalInterval: 20000,
  maxSocketBackpressure: 1000,
  services: {
    account: {
      transactionSettlementInterval: 5000,
      withdrawalProcessingInterval: 20000,
      maxTransactionSettlementsPerAccount: 10,
      maxConcurrentWithdrawalsPerAccount: 10,
      maxConcurrentDebitsPerAccount: 50,
      blockchainNodeWalletPassphrase: 'drastic spot aerobic web wave tourist library first scout fatal inherit arrange',
      blockchainAdapterPath: null,
      blockchainSync: true,
      blockchainNodeAddress: 'https://wallet.rise.vision',
      blockPollInterval: 5000,
      blockFetchLimit: 100,
      blockchainWithdrawalMaxAttempts: 20,
      bcryptPasswordRounds: 10
    },
    fiat: {
      name: 'stripe',
      apiSecretKey: 'sk_live_T6aJW8rE0mi0RaZGqNLPxeIa'
    }
  },
  mainInfo: {
    cryptocurrency: {
      name: 'Rise',
      symbol: 'RISE',
      unit: '100000000'
    },
    mainWalletAddress: '6255037810762443539R',
    requiredDepositBlockConfirmations: 102,
    requiredWithdrawalBlockConfirmations: 102,
    paginationShowTotalCounts: false,
    maxRecordDisplayAge: 2592000000,
    maxPageSize: 100,
    alwaysRequireSecretSignupKey: false,
    enableAdminAccountSignup: true
  }
};
