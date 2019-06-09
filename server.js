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
const inquirer = require('inquirer');
const prompt = inquirer.createPromptModule();

const getSchema = require('./schema');

const configDev = require('./config.dev');
const configProd = require('./config.prod');
const config = {
  dev: configDev,
  prod: configProd
};

const AccountService = require('./services/account-service');

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

const envConfig = config[ENVIRONMENT];

(async () => {
  let {blockchainNodeWalletPassphrase} = envConfig.services.account;
  if (!blockchainNodeWalletPassphrase) {
    let result = await prompt([
      {
        type: 'input',
        message: 'Insert your blockchain hot wallet passphrase (to process withdrawals):',
        name: 'value',
        default: null
      }
    ]);
    blockchainNodeWalletPassphrase = result.value;
  }

  const dataSchema = getSchema({
    dbName: DB_NAME,
    maxRecordDisplayAge: envConfig.mainInfo.maxRecordDisplayAge
  });

  let agOptions = {
    batchInterval: 50
  };

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
        if (!action.data) {
          return;
        }
        if (action.data.type === 'Account') {
          if (action.procedure === 'create') {
            action.data.value = await accountService.sanitizeSignupCredentials(action.data.value);
            return;
          }
          return;
        }
      }
    }
  };

  let crud = agCrudRethink.attach(agServer, crudOptions);

  (async () => {
    for await (let {error} of crud.listener('error')) {
      console.warn('[CRUD]', error);
    }
  })();

  let shardInfo = {
    shardIndex: null,
    shardCount: null
  };

  let accountService = new AccountService({
    ...envConfig.services.account,
    thinky: crud.thinky,
    crud,
    mainInfo: envConfig.mainInfo,
    shardInfo,
    blockchainNodeWalletPassphrase,
    secretSignupKey: envConfig.secretSignupKey
  });

  (async () => {
    for await (let {error} of accountService.listener('error')) {
      console.error('[AccountService]', error);
    }
  })();

  (async () => {
    for await (let {info} of accountService.listener('info')) {
      console.info('[AccountService]', info);
    }
  })();

  (async () => {
    for await (let {block} of accountService.listener('processBlock')) {
      console.log('[AccountService]', `Processed block at height ${block.height}`);
    }
  })();

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

      // Batch everything to improve performance.
      socket.startBatching();

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
            username: accountData.username,
            accountId: accountData.id
          };
          if (accountData.admin === true) {
            token.admin = true;
          }
          socket.setAuthToken(token, {expiresIn: TOKEN_EXPIRY_SECONDS});
          request.end();
        }
      })();

      (async () => {
        for await (let request of socket.procedure('getMainInfo')) {
          request.end(envConfig.mainInfo);
        }
      })();

      (async () => {
        // TODO 2: Validate request data.
        // TODO 2: Respond with error in middleware if user is not logged in properly.
        for await (let request of socket.procedure('withdraw')) {
          let withdrawalData = request.data || {};
          try {
            await accountService.execWithdrawal({
              amount: withdrawalData.amount,
              fromAccountId: socket.authToken.accountId,
              toWalletAddress: withdrawalData.toWalletAddress
            });
          } catch (error) {
            request.error(
              new Error('Failed to execute withdrawal due to a server error')
            );
            console.error(error);
            continue;
          }
          request.end();
        }
      })();

      (async () => {
        // TODO 2: Validate request data.
        // TODO 2: Respond with error in middleware if user is not logged in properly.
        for await (let request of socket.procedure('transfer')) {
          let transferData = request.data || {};
          try {
            await accountService.execTransfer({
              amount: transferData.amount,
              fromAccountId: socket.authToken.accountId,
              toAccountId: transferData.toAccountId,
              debitId: transferData.debitId,
              creditId: transferData.creditId,
              data: transferData.data
            });
          } catch (error) {
            request.error(
              new Error('Failed to execute transfer due to a server error')
            );
            console.error(error);
            continue;
          }
          request.end();
        }
      })();

      (async () => {
        // TODO 2: Validate request data.
        // TODO 2: Respond with error in middleware if user is not logged in properly.
        for await (let request of socket.procedure('getBalance')) {
          let balance;
          try {
            balance = await accountService.fetchAccountBalance(socket.authToken.accountId);
          } catch (error) {
            request.error(
              new Error('Failed to execute getBalance due to a server error')
            );
            console.error(error);
            continue;
          }
          request.end(balance);
        }
      })();

      (async () => {
        // TODO 2: Validate request data.
        // TODO 2: Respond with error in middleware if user is not logged in properly.
        // TODO 2: Respond with error in middleware if user is not admin.
        for await (let request of socket.procedure('adminWithdraw')) {
          let withdrawalData = request.data || {};
          try {
            await accountService.execWithdrawal({
              amount: withdrawalData.amount,
              fromAccountId: withdrawalData.fromAccountId,
              toWalletAddress: withdrawalData.toWalletAddress
            });
          } catch (error) {
            request.error(
              new Error('Failed to execute adminWithdraw due to a server error')
            );
            console.error(error);
            continue;
          }
          request.end();
        }
      })();

      (async () => {
        // TODO 2: Validate request data.
        // TODO 2: Respond with error in middleware if user is not logged in properly.
        // TODO 2: Respond with error in middleware if user is not admin.
        for await (let request of socket.procedure('adminTransfer')) {
          let transferData = request.data || {};
          try {
            await accountService.execTransfer({
              amount: transferData.amount,
              fromAccountId: transferData.fromAccountId,
              toAccountId: transferData.toAccountId,
              debitId: transferData.debitId,
              creditId: transferData.creditId,
              data: transferData.data
            });
          } catch (error) {
            request.error(
              new Error('Failed to execute adminTransfer due to a server error')
            );
            console.error(error);
            continue;
          }
          request.end();
        }
      })();

      (async () => {
        // TODO 2: Validate request data.
        // TODO 2: Respond with error in middleware if user is not logged in properly.
        for await (let request of socket.procedure('adminGetBalance')) {
          let getBalanceData = request.data || {};
          let balance;
          try {
            balance = await accountService.fetchAccountBalance(getBalanceData.accountId);
          } catch (error) {
            request.error(
              new Error('Failed to execute adminGetBalance due to a server error')
            );
            console.error(error);
            continue;
          }
          request.end(balance);
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

      (async () => {
        for await (let event of agcClient.listener('updateWorkers')) {
          let sortedWorkerURIs = event.workerURIs.sort();
          let workerCount = sortedWorkerURIs.length;
          let currentWorkerIndex = event.workerURIs.indexOf(event.sourceWorkerURI);
          shardInfo.shardIndex = currentWorkerIndex;
          shardInfo.shardCount = workerCount;
        }
      })();

      if (ASYNGULAR_LOG_LEVEL >= 1) {
        (async () => {
          for await (let {error} of agcClient.listener('error')) {
            error.name = 'AGCError';
            console.error(error);
          }
        })();
      }
    } else {
      shardInfo.shardIndex = 0;
      shardInfo.shardCount = 1;
    }
})();
