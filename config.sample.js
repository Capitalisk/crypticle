module.exports = {
  dev: {
    origin: 'http://localhost:8000',
    adminEmailAddress: 'Fiat Exchange <grosjona@yahoo.com.au>',
    mailgun: {
      apiKey: 'key-11684d92cd1cae9ab957f2674c06887f',
      domain: 'mg.fiatexchange.io'
    },
    stripe: {
      apiSecretKey: 'sk_test_QlUgKWhOjRrIeTO4YWUaExQH'
    }
  },
  prod: {
    origin: 'https://fiatexchange.io',
    adminEmailAddress: 'Fiat Exchange <grosjona@yahoo.com.au>',
    mailgun: {
      apiKey: 'key-11684d92cd1cae9ab957f2674c06887f',
      domain: 'mg.fiatexchange.io'
    },
    stripe: {
      apiSecretKey: 'sk_live_T6aJW8rE0mi0RaZGqNLPxeIa'
    }
  }
};
