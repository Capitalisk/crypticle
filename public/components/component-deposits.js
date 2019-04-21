import AGCollection from '/node_modules/ag-collection/ag-collection.js';

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
        pageOffset: 0,
        pageSize: 10
      });
      this.transactionCollection = new AGCollection({
        socket,
        type: 'Transaction',
        view,
        viewParams: {
          accountId: socket.authToken && socket.authToken.accountId
        },
        fields: ['amount', 'created'],
        pageOffset: 0,
        pageSize: 10,
        getCount: true
      });
      return {
        nodeInfo,
        deposits: this.depositCollection.value,
        transactions: this.transactionCollection.value,
        depositType: options.type
      };
    },
    methods: {
      getHeight: function (transaction) {
        let matchingDeposit = this.deposits.find((deposit) => {
          return deposit.internalTransactionId === transaction.id;
        });
        return matchingDeposit ? matchingDeposit.height : '';
      },
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
              <th>Transaction ID</th>
              <th>Amount</th>
              <th>Height</th>
              <th>Date</th>
            </tr>
            <tr v-for="txn of transactions">
              <td>{{txn.id}}</td>
              <td>{{toBlockchainUnits(txn.amount)}}<span v-if="nodeInfo.cryptocurrency"> {{nodeInfo.cryptocurrency.symbol}}</span></td>
              <td>{{getHeight(txn)}}</td>
              <td>{{toSimpleDate(txn.created)}}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  };
}

export default getComponent;
