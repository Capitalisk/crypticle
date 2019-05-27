import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getComponent(options) {
  let {socket, mainInfo} = options;
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
        fields: ['transactionId', 'amount', 'height', 'canceled', 'createdDate'],
        pageOffset: 0,
        pageSize: 10
      });

      return {
        mainInfo,
        deposits: this.depositCollection.value,
        depositType: options.type
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
            <span v-if="depositType">{{capitalize(depositType)}} deposits</span>
            <span v-if="!depositType">Deposits</span>
          </h4>
          <table>
            <tr>
              <th>Deposit ID</th>
              <th>Amount</th>
              <th v-if="depositType === 'settled'">Height</th>
              <th v-if="depositType === 'settled'">Status</th>
              <th>Date</th>
            </tr>
            <tr v-for="dep of deposits">
              <td>{{dep.id}}</td>
              <td>{{toBlockchainUnits(dep.amount)}}<span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span></td>
              <td v-if="depositType === 'settled'">{{dep.height}}</td>
              <td v-if="depositType === 'settled'">{{getStatus(dep.canceled)}}</td>
              <td>{{toSimpleDate(dep.createdDate)}}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  };
}

export default getComponent;
