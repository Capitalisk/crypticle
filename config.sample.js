module.exports = {
  dev: {
    origin: 'http://localhost:8000',
    adminEmailAddress: 'Crypticle <grosjona@yahoo.com.au>',
    services: {
      blockchain: {
        name: 'rise',
        nodeAddress: 'https://wallet.rise.vision',
        sync: true,
        blockPollInterval: 5000,
        blockFetchLimit: 100,
        blockFinality: 102
      },
      mail: {
        name: 'mailgun',
        apiKey: 'key-11684d92cd1cae9ab957f2674c06887f',
        domain: 'mg.crypticle.io'
      },
      fiat: {
        name: 'stripe',
        apiSecretKey: 'sk_test_QlUgKWhOjRrIeTO4YWUaExQH'
      }
    },
    nodeInfo: {
      cryptocurrency: {
        name: 'Rise',
        symbol: 'RISE',
        unit: '100000000'
      },
      nodeWalletAddress: '5920507067941756798R',
      requiredBlockConfirmations: 102
    }
  },
  prod: {
    origin: 'https://crypticle.io',
    adminEmailAddress: 'Crypticle <grosjona@yahoo.com.au>',
    services: {
      blockchain: {
        name: 'rise',
        nodeAddress: 'https://wallet.rise.vision',
        sync: true,
        blockPollInterval: 5000,
        blockFetchLimit: 100,
        blockFinality: 102
      },
      mail: {
        name: 'mailgun',
        apiKey: 'key-11684d92cd1cae9ab957f2674c06887f',
        domain: 'mg.crypticle.io'
      },
      fiat: {
        name: 'stripe',
        apiSecretKey: 'sk_live_T6aJW8rE0mi0RaZGqNLPxeIa'
      }
    },
    nodeInfo: {
      cryptocurrency: {
        name: 'Rise',
        symbol: 'RISE',
        unit: '100000000'
      },
      nodeWalletAddress: '5920507067941756798R',
      requiredBlockConfirmations: 102
    }
  }
};
