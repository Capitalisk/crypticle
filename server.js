const http = require('http');
const eetase = require('eetase');
const asyngularServer = require('asyngular-server');
const express = require('express');
const serveStatic = require('serve-static');
const path = require('path');
const morgan = require('morgan');
const uuid = require('uuid');
const agcBrokerClient = require('agc-broker-client');
const agCrudRethink = require('ag-crud-rethink');

const dataSchema = require('./schema');
const configuration = require('./config');
const AccountService = require('./account-service');

const ENVIRONMENT = process.env.ENV || 'dev';
const ASYNGULAR_PORT = process.env.ASYNGULAR_PORT || 8000;
const ASYNGULAR_WS_ENGINE = process.env.ASYNGULAR_WS_ENGINE || 'ws';
const ASYNGULAR_SOCKET_CHANNEL_LIMIT = Number(process.env.ASYNGULAR_SOCKET_CHANNEL_LIMIT) || 1000;
const ASYNGULAR_LOG_LEVEL = process.env.ASYNGULAR_LOG_LEVEL || 2;

const AGC_INSTANCE_ID = uuid.v4();
const AGC_STATE_SERVER_HOST = process.env.AGC_STATE_SERVER_HOST || null;
const AGC_STATE_SERVER_PORT = process.env.AGC_STATE_SERVER_PORT || null;
const AGC_MAPPING_ENGINE = process.env.AGC_MAPPING_ENGINE || null;
const AGC_CLIENT_POOL_SIZE = process.env.AGC_CLIENT_POOL_SIZE || null;
const AGC_AUTH_KEY = process.env.AGC_AUTH_KEY || null;
const AGC_INSTANCE_IP = process.env.AGC_INSTANCE_IP || null;
const AGC_INSTANCE_IP_FAMILY = process.env.AGC_INSTANCE_IP_FAMILY || null;
const AGC_STATE_SERVER_CONNECT_TIMEOUT = Number(process.env.AGC_STATE_SERVER_CONNECT_TIMEOUT) || null;
const AGC_STATE_SERVER_ACK_TIMEOUT = Number(process.env.AGC_STATE_SERVER_ACK_TIMEOUT) || null;
const AGC_STATE_SERVER_RECONNECT_RANDOMNESS = Number(process.env.AGC_STATE_SERVER_RECONNECT_RANDOMNESS) || null;
const AGC_PUB_SUB_BATCH_DURATION = Number(process.env.AGC_PUB_SUB_BATCH_DURATION) || null;
const AGC_BROKER_RETRY_DELAY = Number(process.env.AGC_BROKER_RETRY_DELAY) || null;

const DB_NAME = process.env.DB_NAME || 'crypticle';
const TOKEN_EXPIRY_SECONDS = 60 * 60;

const conf = configuration[ENVIRONMENT];

let agOptions = {};

if (process.env.ASYNGULAR_OPTIONS) {
  let envOptions = JSON.parse(process.env.ASYNGULAR_OPTIONS);
  Object.assign(agOptions, envOptions);
}

let httpServer = eetase(http.createServer());
let agServer = asyngularServer.attach(httpServer, agOptions);

let crudOptions = {
  blockPreByDefault: true,
  blockPostByDefault: false,
  defaultPageSize: 10,
  schema: dataSchema,
  thinkyOptions: {
    host: '127.0.0.1',
    db: DB_NAME,
    port: 28015
  },
  middleware: {
    invoke: async function (action) {
      let isAccountSignUp = action.procedure == 'create' && action.data.type == 'Account';
      if (isAccountSignUp) {
        action.data.value = await accountService.sanitizeSignupCredentials(action.data.value);
      }
    }
  }
};

let crud = agCrudRethink.attach(agServer, crudOptions);
let accountService = new AccountService(crud.thinky);

let expressApp = express();
if (ENVIRONMENT === 'dev') {
  // Log every HTTP request. See https://github.com/expressjs/morgan for other
  // available formats.
  expressApp.use(morgan('dev'));
}
expressApp.use(serveStatic(path.resolve(__dirname, 'public')));

// Add GET /health-check express route
expressApp.get('/health-check', (req, res) => {
  res.status(200).send('OK');
});

// HTTP request handling loop.
(async () => {
  for await (let requestData of httpServer.listener('request')) {
    expressApp.apply(null, requestData);
  }
})();

// Asyngular/WebSocket connection handling loop.
(async () => {
  for await (let {socket} of agServer.listener('connection')) {
    // Handle socket connection.

    (async () => {
      for await (let request of socket.procedure('login')) {
        let accountData;
        try {
          accountData = await accountService.verifyLoginCredentials(request.data);
        } catch (error) {
          if (
            error.name === 'InvalidCredentialsError' ||
            error.name === 'AccountInactiveError'
          ) {
            request.error(error);
          } else {
            let clientError = new Error('Failed to login.');
            clientError.name = 'FailedToLoginError';
            request.error(clientError);
          }
          console.error(error);
          continue;
        }
        let token = {
          email: accountData.email,
          accountId: accountData.id
        };
        socket.setAuthToken(token, {expiresIn: TOKEN_EXPIRY_SECONDS});
        request.end();
      }
    })();

  }
})();

httpServer.listen(ASYNGULAR_PORT);

if (ASYNGULAR_LOG_LEVEL >= 1) {
  (async () => {
    for await (let {error} of agServer.listener('error')) {
      console.error(error);
    }
  })();
}

if (ASYNGULAR_LOG_LEVEL >= 2) {
  console.log(
    `   ${colorText('[Active]', 32)} Asyngular worker with PID ${process.pid} is listening on port ${ASYNGULAR_PORT}`
  );

  (async () => {
    for await (let {warning} of agServer.listener('warning')) {
      console.warn(warning);
    }
  })();
}

function colorText(message, color) {
  if (color) {
    return `\x1b[${color}m${message}\x1b[0m`;
  }
  return message;
}

if (AGC_STATE_SERVER_HOST) {
  // Setup broker client to connect to the Asyngular cluster (AGC).
  let agcClient = agcBrokerClient.attach(agServer.brokerEngine, {
    instanceId: AGC_INSTANCE_ID,
    instancePort: ASYNGULAR_PORT,
    instanceIp: AGC_INSTANCE_IP,
    instanceIpFamily: AGC_INSTANCE_IP_FAMILY,
    pubSubBatchDuration: AGC_PUB_SUB_BATCH_DURATION,
    stateServerHost: AGC_STATE_SERVER_HOST,
    stateServerPort: AGC_STATE_SERVER_PORT,
    mappingEngine: AGC_MAPPING_ENGINE,
    clientPoolSize: AGC_CLIENT_POOL_SIZE,
    authKey: AGC_AUTH_KEY,
    stateServerConnectTimeout: AGC_STATE_SERVER_CONNECT_TIMEOUT,
    stateServerAckTimeout: AGC_STATE_SERVER_ACK_TIMEOUT,
    stateServerReconnectRandomness: AGC_STATE_SERVER_RECONNECT_RANDOMNESS,
    brokerRetryDelay: AGC_BROKER_RETRY_DELAY
  });

  if (ASYNGULAR_LOG_LEVEL >= 1) {
    (async () => {
      for await (let {error} of agcClient.listener('error')) {
        error.name = 'AGCError';
        console.error(error);
      }
    })();
  }
}
