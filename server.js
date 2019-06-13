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
const Validator = require('jsonschema').Validator;
const inquirer = require('inquirer');
const prompt = inquirer.createPromptModule();

const getDataSchema = require('./schema-data');
const getRequestSchema = require('./schema-request');

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

const TOKEN_EXPIRY_SECONDS = 60 * 60;

const envConfig = config[ENVIRONMENT];
const databaseName = envConfig.databaseName || 'crypticle';

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

  const dataSchema = getDataSchema({
    dbName: databaseName,
    maxRecordDisplayAge: envConfig.mainInfo.maxRecordDisplayAge
  });

  let requestValidator = new Validator();
  let requestSchema = getRequestSchema();

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
    defaultPageSize: 10,
    schema: dataSchema,
    thinkyOptions: {
      host: '127.0.0.1',
      db: databaseName,
      port: 28015
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

  function capitalize(message) {
    return message.charAt(0).toUpperCase() + message.slice(1);
  }

  function generateMessageFromSchemaError(error) {
    return `${capitalize(error.property.split('.')[1] || '')} ${error.message}`;
  }

  function validateRequestSchema(request) {
    let schema = requestSchema[request.procedure];
    if (!schema) {
      let error = new Error(`Could not find a schema for the ${request.procedure} procedure.`);
      error.name = 'NoMatchingRequestSchemaError';
      error.isClientError = true;
      throw error;
    }
    let validationResult = requestValidator.validate(request.data, schema);
    if (!validationResult.valid) {
      let errorsMessage = validationResult.errors.map(error => generateMessageFromSchemaError(error)).join('. ');
      let error = new Error(`${errorsMessage}.`);
      error.name = 'RequestSchemaValidationError';
      error.errors = validationResult.errors;
      error.isClientError = true;
      throw error;
    }
  }

  function verifyUserAuth(request, socket) {
    if (!socket.authToken) {
      let error = new Error(
        `Cannot invoke the ${
          request.procedure
        } procedure while not authenticated.`
      );
      error.name = 'NotAuthenticatedError';
      error.isClientError = true;
      throw error;
    }
  }

  function verifyAdminUserAuth(request, socket) {
    if (!socket.authToken || !socket.authToken.admin) {
      let error = new Error(
        `Cannot invoke the ${
          request.procedure
        } procedure while not authenticated as an admin.`
      );
      error.name = 'NotAuthenticatedAsAdminError';
      error.isClientError = true;
      throw error;
    }
  }

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
        for await (let request of socket.procedure('signup')) {
          try {
            validateRequestSchema(request);
          } catch (error) {
            request.error(error);
            console.error(error);
            continue;
          }

          let accountData;
          try {
            accountData = await accountService.sanitizeSignupCredentials(request.data);
            await crud.create({
              type: 'Account',
              value: accountData
            });
          } catch (error) {
            if (error.isClientError) {
              request.error(error);
            } else {
              let clientError = new Error('Failed to signup.');
              clientError.name = 'SignupError';
              clientError.isClientError = true;
              request.error(clientError);
            }
            console.error(error);
            continue;
          }
          request.end();
        }
      })();

      (async () => {
        for await (let request of socket.procedure('login')) {
          try {
            validateRequestSchema(request);
          } catch (error) {
            request.error(error);
            console.error(error);
            continue;
          }

          let accountData;
          try {
            accountData = await accountService.verifyLoginCredentials(request.data);
          } catch (error) {
            if (error.isClientError) {
              request.error(error);
            } else {
              let clientError = new Error('Failed to login.');
              clientError.name = 'LoginError';
              clientError.isClientError = true;
              request.error(clientError);
            }
            console.error(error);
            continue;
          }
          let token = {
            username: accountData.username,
            accountId: accountData.id
          };
          if (accountData.admin) {
            token.admin = true;
          }
          socket.setAuthToken(token, {expiresIn: TOKEN_EXPIRY_SECONDS});
          request.end();
        }
      })();

      (async () => {
        for await (let request of socket.procedure('getMainInfo')) {
          try {
            validateRequestSchema(request);
          } catch (error) {
            request.error(error);
            console.error(error);
            continue;
          }

          request.end(envConfig.mainInfo);
        }
      })();

      (async () => {
        for await (let request of socket.procedure('withdraw')) {
          try {
            verifyUserAuth(request, socket);
            validateRequestSchema(request);
          } catch (error) {
            request.error(error);
            console.error(error);
            continue;
          }

          let withdrawalData = request.data;
          try {
            await accountService.attemptWithdrawal({
              amount: withdrawalData.amount,
              fromAccountId: socket.authToken.accountId,
              toWalletAddress: withdrawalData.toWalletAddress
            });
          } catch (error) {
            if (error.isClientError) {
              request.error(error);
            } else {
              let clientError = new Error('Failed to execute withdrawal due to a server error');
              clientError.name = 'WithdrawError';
              clientError.isClientError = true;
              request.error(clientError);
            }
            console.error(error);
            continue;
          }
          request.end();
        }
      })();

      (async () => {
        for await (let request of socket.procedure('transfer')) {
          try {
            verifyUserAuth(request, socket);
            validateRequestSchema(request);
          } catch (error) {
            request.error(error);
            console.error(error);
            continue;
          }

          let transferData = request.data;
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
            if (error.isClientError) {
              request.error(error);
            } else {
              let clientError = new Error('Failed to execute transfer due to a server error');
              clientError.name = 'TransferError';
              clientError.isClientError = true;
              request.error(clientError);
            }
            console.error(error);
            continue;
          }
          request.end();
        }
      })();

      (async () => {
        for await (let request of socket.procedure('getBalance')) {
          try {
            verifyUserAuth(request, socket);
            validateRequestSchema(request);
          } catch (error) {
            request.error(error);
            console.error(error);
            continue;
          }

          let balance;
          try {
            balance = await accountService.fetchAccountBalance(socket.authToken.accountId);
          } catch (error) {
            if (error.isClientError) {
              request.error(error);
            } else {
              let clientError = new Error('Failed to get account balance due to a server error');
              clientError.name = 'GetBalanceError';
              clientError.isClientError = true;
              request.error(clientError);
            }
            console.error(error);
            continue;
          }
          request.end(balance);
        }
      })();

      (async () => {
        for await (let request of socket.procedure('adminImpersonate')) {
          try {
            verifyAdminUserAuth(request, socket);
            validateRequestSchema(request);
          } catch (error) {
            request.error(error);
            console.error(error);
            continue;
          }

          let accountData;
          try {
            accountData = await accountService.verifyLoginCredentialsUsername(request.data);
          } catch (error) {
            if (error.isClientError) {
              request.error(error);
            } else {
              let clientError = new Error(`Failed to login as user ${request.data.username}.`);
              clientError.name = 'AdminLoginError';
              clientError.isClientError = true;
              request.error(clientError);
            }
            console.error(error);
            continue;
          }
          let realAccountId = socket.authToken.impersonator || socket.authToken.accountId;
          let isOwnAdminAccount = accountData.id === realAccountId;
          if (accountData.admin && !isOwnAdminAccount) {
            let clientError = new Error(
              `Failed to login as user ${
                request.data.username
              } because other admin accounts cannot be impersonated.`
            );
            clientError.name = 'AdminLoginError';
            clientError.isClientError = true;
            request.error(clientError);
            console.error(clientError);
            continue;
          }
          let token = {
            username: accountData.username,
            accountId: accountData.id,
            admin: true
          };
          if (!isOwnAdminAccount) {
            token.impersonator = realAccountId;
          }
          socket.setAuthToken(token, {expiresIn: TOKEN_EXPIRY_SECONDS});
          request.end();
        }
      })();

      (async () => {
        for await (let request of socket.procedure('adminWithdraw')) {
          try {
            verifyAdminUserAuth(request, socket);
            validateRequestSchema(request);
          } catch (error) {
            request.error(error);
            console.error(error);
            continue;
          }

          let withdrawalData = request.data;
          try {
            await accountService.execWithdrawal({
              amount: withdrawalData.amount,
              fromAccountId: withdrawalData.fromAccountId,
              toWalletAddress: withdrawalData.toWalletAddress
            });
          } catch (error) {
            if (error.isClientError) {
              request.error(error);
            } else {
              let clientError = new Error('Failed to execute withdrawal due to a server error');
              clientError.name = 'AdminWithdrawError';
              clientError.isClientError = true;
              request.error(clientError);
            }
            console.error(error);
            continue;
          }
          request.end();
        }
      })();

      (async () => {
        for await (let request of socket.procedure('adminTransfer')) {
          try {
            verifyAdminUserAuth(request, socket);
            validateRequestSchema(request);
          } catch (error) {
            request.error(error);
            console.error(error);
            continue;
          }

          let transferData = request.data;
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
            if (error.isClientError) {
              request.error(error);
            } else {
              let clientError = new Error('Failed to execute transfer due to a server error');
              clientError.name = 'AdminTransferError';
              clientError.isClientError = true;
              request.error(clientError);
            }
            console.error(error);
            continue;
          }
          request.end();
        }
      })();

      (async () => {
        for await (let request of socket.procedure('adminGetBalance')) {
          try {
            verifyAdminUserAuth(request, socket);
            validateRequestSchema(request);
          } catch (error) {
            request.error(error);
            console.error(error);
            continue;
          }

          let getBalanceData = request.data;
          let balance;
          try {
            balance = await accountService.fetchAccountBalance(getBalanceData.accountId);
          } catch (error) {
            if (error.isClientError) {
              request.error(error);
            } else {
              let clientError = new Error('Failed to get account balance due to a server error');
              clientError.name = 'AdminGetBalanceError';
              clientError.isClientError = true;
              request.error(clientError);
            }

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
