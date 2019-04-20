import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getComponent(options) {
  let {socket, nodeInfo} = options;
  let view;

  if (options.type === 'pending') {
    view = 'accountTransfersPendingView';
  } else if (options.type === 'settled') {
    view = 'accountTransfersSettledView';
  }

  return {
    data: function () {
      this.transactionCollection = new AGCollection({
        socket,
        type: 'Transaction',
        view,
        viewParams: {
          accountId: socket.authToken && socket.authToken.accountId
        },
        fields: ['amount', 'created'],
        pageOffset: 0,
        pageSize: 50,
        getCount: true
      });
      return {
        nodeInfo,
        transactions: this.transactionCollection.value,
        transactionType: options.type
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
            <span v-if="transactionType">{{capitalize(transactionType)}} transfers</span>
            <span v-if="!transactionType">Transfers</span>
          </h4>
          <table>
            <tr>
              <th>
                <span>Transaction ID</span>
              </th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
            <tr v-for="transaction of transactions">
              <td>{{transaction.id}}</td>
              <td>{{toBlockchainUnits(transaction.amount)}}<span v-if="nodeInfo.cryptocurrency"> {{nodeInfo.cryptocurrency.symbol}}</span></td>
              <td>{{toSimpleDate(transaction.created)}}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  };
}

export default getComponent;
