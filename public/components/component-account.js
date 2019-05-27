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
      this.lastSettledTransactionsCollection = new AGCollection({
        socket,
        type: 'Transaction',
        view: 'lastSettledTransactions',
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
        lastSettledTransactions: this.lastSettledTransactionsCollection.value
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
            Account
          </h4>
          <div>
            <span>ID:</span> <span>{{account.id}}</span>
          </div>
          <div>
            <span>Balance:</span> <span v-if="!lastSettledTransactions.length">0</span><span v-for="txn of lastSettledTransactions">{{toBlockchainUnits(txn.balance)}}</span><span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span>
          </div>
          <div>
            To top up your account, you should send {{mainInfo.cryptocurrency.symbol}} tokens to the following wallet address: <b>{{account.depositWalletAddress}}</b>
          </div>
        </div>
      </div>
    `
  };
}

export default getComponent;
