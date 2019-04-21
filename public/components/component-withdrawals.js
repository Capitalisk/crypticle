import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getComponent(options) {
  let {socket, nodeInfo} = options;
  let view;

  if (options.type === 'pending') {
    view = 'accountWithdrawalsPendingView';
  } else if (options.type === 'settled') {
    view = 'accountWithdrawalsSettledView';
  }

  return {
    data: function () {
      this.transactionsCollection = new AGCollection({
        socket,
        type: 'Transaction',
        view,
        viewParams: {
          accountId: socket.authToken && socket.authToken.accountId
        },
        fields: ['referenceId', 'amount', 'created'],
        pageOffset: 0,
        pageSize: 10,
        getCount: true
      });
      return {
        nodeInfo,
        transactions: this.transactionsCollection.value,
        withdrawalType: options.type
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
            <span v-if="withdrawalType">{{capitalize(withdrawalType)}} withdrawals</span>
            <span v-if="!withdrawalType">Withdrawals</span>
          </h4>
          <table>
            <tr>
              <th>Transaction ID</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
            <tr v-for="txn of transactions">
              <td>{{txn.id}}</td>
              <td>{{toBlockchainUnits(txn.amount)}}<span v-if="nodeInfo.cryptocurrency"> {{nodeInfo.cryptocurrency.symbol}}</span></td>
              <td>{{toSimpleDate(txn.created)}}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  };
}

export default getComponent;
