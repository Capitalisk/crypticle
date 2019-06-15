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
        fields: ['username', 'balance', 'depositWalletAddress', 'admin']
      });
      (async () => {
        for await (let {error} of this.accountModel.listener('error')) {
          console.error(error);
        }
      })();

      return {
        mainInfo,
        account: this.accountModel.value,
        isImpersonating: socket.authToken && !!socket.authToken.impersonator
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
      accountBalance: function () {
        if (this.account.username == null) {
          return 'Loading...';
        }
        return `${this.toBlockchainUnits(this.account.balance)} ${this.mainInfo.cryptocurrency.symbol}`;
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
            <tr v-if="isImpersonating" class="table-row-success">
              <td colspan="2">This account is being impersonated.</td>
            </tr>
            <tr>
              <td><b>Username</b></td>
              <td>{{account.username}}</td>
            </tr>
            <tr>
              <td><b>Account ID</b></td>
              <td>{{account.id}}</td>
            </tr>
            <tr>
              <td><b>Balance</b></td>
              <td>{{accountBalance}}</td>
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
