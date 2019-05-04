import AGModel from '/node_modules/ag-model/ag-model.js';
import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getComponent(options) {
  let {socket, mainInfo} = options;

  return {
    data: function () {
      this.accountModel = new AGModel({
        socket,
        type: 'Account',
        id: socket.authToken && socket.authToken.accountId,
        fields: ['depositWalletAddress']
      });
      this.latestSettledTransactionsCollection = new AGCollection({
        socket,
        type: 'Transaction',
        view: 'latestSettledTransactions',
        viewParams: {
          accountId: socket.authToken && socket.authToken.accountId
        },
        fields: ['balance'],
        pageOffset: 0,
        pageSize: 1
      });
      return {
        mainInfo,
        account: this.accountModel.value,
        latestSettledTransactions: this.latestSettledTransactionsCollection.value
      };
    },
    methods: {
      toBlockchainUnits: function (amount) {
        let value = Number(amount) / Number(mainInfo.cryptocurrency.unit);
        return Math.round(value * 10000) / 10000;
      },
      capitalize: function (message) {
        return message.charAt(0).toUpperCase() + message.slice(1)
      }
    },
    template: `
      <div class="component-container">
        <div class="content-body">
          <h4>
            Wallet address
          </h4>
          <div>
            <span>Balance:</span> <span v-for="txn of latestSettledTransactions">{{toBlockchainUnits(txn.balance)}}</span><span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span>
          </div>
          <div>
            To top up your account, you should deposit {{mainInfo.cryptocurrency.symbol}} tokens to the following wallet address: <b>{{account.depositWalletAddress}}</b>
          </div>
        </div>
      </div>
    `
  };
}

export default getComponent;
