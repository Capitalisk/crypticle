import AGCollection from '/node_modules/ag-collection/ag-collection.js';
import AGModel from '/node_modules/ag-model/ag-model.js';

function getComponent(options) {
  let {socket, nodeInfo} = options;
  let view;

  if (options.type === 'pending') {
    view = 'accountDepositsPendingView';
  } else if (options.type === 'settled') {
    view = 'accountDepositsSettledView';
  }

  return {
    data: function () {
      this.depositCollection = new AGCollection({
        socket,
        type: 'Deposit',
        view,
        viewParams: {
          accountId: socket.authToken && socket.authToken.accountId
        },
        fields: ['internalTransactionId', 'height'],
        defaultFieldValues: {
          transaction: {}
        },
        pageOffset: 0,
        pageSize: 10
      });

      (async () => {
        for await (let depositModel of this.depositCollection.listener('modelDestroy')) {
          depositModel.transactionModel.destroy();
          delete depositModel.transactionModel;
        }
      })();

      (async () => {
        for await (let event of this.depositCollection.listener('modelChange')) {
          if (event.resourceField !== 'internalTransactionId') {
            continue;
          }
          let depositModel = this.depositCollection.agModels[event.resourceId];
          let originalTransactionModel = depositModel.transactionModel;
          let transactionId = event.newValue;
          if (
            transactionId &&
            (!originalTransactionModel || depositModel.transactionModel.id !== transactionId)
          ) {
            depositModel.transactionModel = new AGModel({
              socket,
              type: 'Transaction',
              id: transactionId,
              fields: ['amount', 'settled']
            });
            depositModel.value.transaction = depositModel.transactionModel.value;
            if (originalTransactionModel) {
              originalTransactionModel.destroy();
            }
          }
        }
      })();

      return {
        nodeInfo,
        deposits: this.depositCollection.value,
        depositType: options.type
      };
    },
    methods: {
      toBlockchainUnits: function (amount) {
        let value = Number(amount) / Number(nodeInfo.cryptocurrency.unit);
        return Math.round(value * 10000) / 10000;
      },
      toSimpleDate: function (dateString) {
        return (new Date(dateString)).toLocaleString();
      },
      capitalize: function (message) {
        return message.charAt(0).toUpperCase() + message.slice(1)
      }
    },
    template: `
      <div class="component-container">
        <div class="content-body">
          <h4>
            <span v-if="depositType">{{capitalize(depositType)}} deposits</span>
            <span v-if="!depositType">Deposits</span>
          </h4>
          <table>
            <tr>
              <th>Deposit ID</th>
              <th>Amount</th>
              <th>Height</th>
              <th>Date</th>
            </tr>
            <tr v-for="dep of deposits">
              <td>{{dep.id}}</td>
              <td>{{toBlockchainUnits(dep.transaction.amount)}}<span v-if="nodeInfo.cryptocurrency"> {{nodeInfo.cryptocurrency.symbol}}</span></td>
              <td>{{dep.height}}</td>
              <td>{{dep.created}}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  };
}

export default getComponent;
