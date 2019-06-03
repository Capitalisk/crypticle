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
        fields: ['depositWalletAddress', 'admin']
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
        pageSize: 1,
        getCount: true
      });
      return {
        mainInfo,
        account: this.accountModel.value,
        lastSettledTransactions: this.lastSettledTransactionsCollection.value,
        lastSettledTransactionsMeta: this.lastSettledTransactionsCollection.meta
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
    computed: {
      isBalanceReady: function () {
        return this.lastSettledTransactionsMeta.count != null && (
          this.lastSettledTransactionsMeta.count === 0 ||
          (this.lastSettledTransactions.length > 0 && this.lastSettledTransactions[0].balance != null)
        );
      }
    },
    template: `
      <div class="component-container container is-fullhd">
        <h4 class="title is-4">
          Account
        </h4>
        <table class="table is-bordered">
          <tbody>
            <tr v-if="account.admin" class="table-row-success">
              <td colspan="2">This account has admin privileges.</td>
            </tr>
            <tr>
              <td><b>Account ID</b></td>
              <td>{{account.id}}</td>
            </tr>
            <tr>
              <td><b>Balance</b></td>
              <template v-if="!isBalanceReady">
                <td>
                  <span>Loading...</span>
                </td>
              </template>
              <template v-if="isBalanceReady">
                <td v-if="!lastSettledTransactions.length">
                  <span>0</span>
                  <span v-if="mainInfo.cryptocurrency">{{mainInfo.cryptocurrency.symbol}}</span>
                </td>
                <td v-for="txn of lastSettledTransactions">
                  <span v-for="txn of lastSettledTransactions">{{toBlockchainUnits(txn.balance)}}</span>
                  <span v-if="mainInfo.cryptocurrency">{{mainInfo.cryptocurrency.symbol}}</span>
                </td>
              </template>
            </tr>
            <tr>
              <td>
                <b>Deposit wallet address ({{mainInfo.cryptocurrency.symbol}})</b>
              </td>
              <td>{{account.depositWalletAddress}}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  };
}

export default getComponent;
