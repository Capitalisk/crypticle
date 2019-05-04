import AGModel from '/node_modules/ag-model/ag-model.js';
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
        fields: ['transactionId', 'amount', 'height', 'createdDate'],
        defaultFieldValues: {
          transaction: {}
        },
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
              <td>{{toBlockchainUnits(dep.amount)}}<span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span></td>
              <td>{{dep.height}}</td>
              <td>{{toSimpleDate(dep.createdDate)}}</td>
            </tr>
          </table>
        </div>
      </div>
    `
  };
}

export default getComponent;
