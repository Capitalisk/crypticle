import AGModel from '/node_modules/ag-model/ag-model.js';

function getComponent(options) {
  let {socket, mainInfo} = options;
  let view;

  return {
    data: function () {
      this.accountModel = new AGModel({
        socket,
        type: 'Account',
        id: socket.authToken && socket.authToken.accountId,
        fields: ['depositWalletAddress']
      });
      return {
        mainInfo,
        account: this.accountModel.value,
      };
    },
    methods: {
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
            To top up your account, you should deposit {{mainInfo.cryptocurrency.symbol}} tokens to the following wallet address: <b>{{account.depositWalletAddress}}</b>
          </div>
        </div>
      </div>
    `
  };
}

export default getComponent;
