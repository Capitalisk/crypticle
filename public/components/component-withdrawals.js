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
      this.withdrawalsCollection = new AGCollection({
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
        withdrawals: this.withdrawalsCollection.value,
        withdrawalType: options.type
      };
    },
    methods: {
      toBlockchainUnits: function (amount) {
        let value = Number(amount) / Number(nodeInfo.cryptocurrency.unit);
        return Math.round(value * 100) / 100;
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
              <th>
                <span v-if="nodeInfo.cryptocurrency">{{nodeInfo.cryptocurrency.name}}</span>
                <span v-if="!nodeInfo.cryptocurrency">Blockchain</span>
                <span>transaction ID</span>
              </th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
            <tr v-for="withdrawal of withdrawals">
              <td>{{withdrawal.referenceId}}</td>
              <td>{{toBlockchainUnits(withdrawal.amount)}}<span v-if="nodeInfo.cryptocurrency"> {{nodeInfo.cryptocurrency.symbol}}</span></td>
              <td>{{toSimpleDate(withdrawal.created)}}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  };
}

export default getComponent;
