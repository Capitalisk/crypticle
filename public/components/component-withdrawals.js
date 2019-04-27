import AGCollection from '/node_modules/ag-collection/ag-collection.js';
import AGModel from '/node_modules/ag-model/ag-model.js';

function getComponent(options) {
  let {socket, mainInfo} = options;
  let view;

  if (options.type === 'pending') {
    view = 'accountWithdrawalsPendingView';
  } else if (options.type === 'settled') {
    view = 'accountWithdrawalsSettledView';
  }

  return {
    data: function () {
      this.withdrawalCollection = new AGCollection({
        socket,
        type: 'Withdrawal',
        view,
        viewParams: {
          accountId: socket.authToken && socket.authToken.accountId
        },
        fields: ['transactionId', 'height'],
        defaultFieldValues: {
          transaction: {}
        },
        pageOffset: 0,
        pageSize: 10
      });

      (async () => {
        for await (let withdrawalModel of this.withdrawalCollection.listener('modelDestroy')) {
          withdrawalModel.transactionModel.destroy();
          delete withdrawalModel.transactionModel;
        }
      })();

      (async () => {
        for await (let event of this.withdrawalCollection.listener('modelChange')) {
          if (event.resourceField !== 'transactionId') {
            continue;
          }
          let withdrawalModel = this.withdrawalCollection.agModels[event.resourceId];
          let originalTransactionModel = withdrawalModel.transactionModel;
          let transactionId = event.newValue;
          if (
            transactionId &&
            (!originalTransactionModel || withdrawalModel.transactionModel.id !== transactionId)
          ) {
            withdrawalModel.transactionModel = new AGModel({
              socket,
              type: 'Transaction',
              id: transactionId,
              fields: ['amount', 'settled']
            });
            withdrawalModel.value.transaction = withdrawalModel.transactionModel.value;
            if (originalTransactionModel) {
              originalTransactionModel.destroy();
            }
          }
        }
      })();

      return {
        mainInfo,
        withdrawals: this.withdrawalCollection.value,
        withdrawalType: options.type
      };
    },
    methods: {
      toBlockchainUnits: function (amount) {
        let value = Number(amount) / Number(mainInfo.cryptocurrency.unit);
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
            <span v-if="withdrawalType">{{capitalize(withdrawalType)}} withdrawals</span>
            <span v-if="!withdrawalType">Withdrawals</span>
          </h4>
          <table>
            <tr>
              <th>Withdrawal ID</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
            <tr v-for="wit of withdrawals">
              <td>{{wit.id}}</td>
              <td>{{toBlockchainUnits(wit.transaction.amount)}}<span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span></td>
              <td>{{wit.created}}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  };
}

export default getComponent;
