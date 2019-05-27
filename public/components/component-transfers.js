import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getComponent(options) {
  let {socket, mainInfo} = options;
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
        fields: ['type', 'amount', 'data', 'canceled', 'createdDate'],
        pageOffset: 0,
        pageSize: 50,
        getCount: true
      });
      return {
        mainInfo,
        transactions: this.transactionCollection.value,
        transactionType: options.type
      };
    },
    methods: {
      toBlockchainUnits: function (amount, type) {
        let value = Number(amount) / Number(mainInfo.cryptocurrency.unit);
        if (type === 'debit') {
          value *= -1;
        }
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
            <span v-if="transactionType">{{capitalize(transactionType)}} transfers</span>
            <span v-if="!transactionType">Transfers</span>
          </h4>
          <table>
            <tr>
              <th>
                <span>Transaction ID</span>
              </th>
              <th>Amount</th>
              <th>Data</th>
              <th v-if="transactionType === 'settled'">Status</th>
              <th>Date</th>
            </tr>
            <tr v-for="transaction of transactions">
              <td>{{transaction.id}}</td>
              <td>{{toBlockchainUnits(transaction.amount, transaction.type)}}<span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span></td>
              <td>{{transaction.data}}</td>
              <td v-if="transactionType === 'settled'">{{getStatus(transaction.canceled)}}</td>
              <td>{{toSimpleDate(transaction.createdDate)}}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  };
}

export default getComponent;
