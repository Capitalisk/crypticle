import AGModel from '/node_modules/ag-model/ag-model.js';
import AGCollection from '/node_modules/ag-collection/ag-collection.js';

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
        fields: ['transactionId', 'amount', 'height', 'canceled', 'createdDate'],
        pageOffset: 0,
        pageSize: 10
      });

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
      },
      getStatus: function (canceled) {
        return canceled ? 'canceled' : 'processed';
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
              <th v-if="withdrawalType === 'settled'">Height</th>
              <th v-if="withdrawalType === 'settled'">Status</th>
              <th>Date</th>
            </tr>
            <tr v-for="wit of withdrawals">
              <td>{{wit.id}}</td>
              <td>{{toBlockchainUnits(wit.amount)}}<span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span></td>
              <td v-if="withdrawalType === 'settled'">{{wit.height}}</td>
              <td v-if="withdrawalType === 'settled'">{{getStatus(wit.canceled)}}</td>
              <td>{{toSimpleDate(wit.createdDate)}}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  };
}

export default getComponent;
