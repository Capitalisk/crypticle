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
      <div class="component-container container is-fullhd">
        <h4 class="title is-4" v-if="withdrawalType">{{capitalize(withdrawalType)}} withdrawals</h4>
        <h4 class="title is-4" v-if="!withdrawalType">Withdrawals</h4>
        <table class="table is-striped is-bordered is-fullwidth">
          <thead>
            <tr>
              <th class="table-cell-id">Withdrawal ID</th>
              <th>Amount</th>
              <th v-if="withdrawalType === 'settled'">Height</th>
              <th v-if="withdrawalType === 'settled'">Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="wit of withdrawals">
              <tr v-bind:class="{'table-row-failure': wit.canceled}">
                <td class="table-cell-id table-first-column">{{wit.id}}</td>
                <td class="table-cell-amount">{{toBlockchainUnits(wit.amount)}}<span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span></td>
                <td v-if="withdrawalType === 'settled'" class="table-cell-height">{{wit.height}}</td>
                <td v-if="withdrawalType === 'settled'" class="table-cell-status">{{getStatus(wit.canceled)}}</td>
                <td class="table-cell-date">{{toSimpleDate(wit.createdDate)}}</td>
              </tr>
            </template>
            <tr v-if="withdrawals.length <= 0">
              <td class="table-empty-row withdrawals-table-empty-row" colspan="5">No {{withdrawalType}} withdrawals</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  };
}

export default getComponent;
