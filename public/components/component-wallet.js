import AGModel from '/node_modules/ag-model/ag-model.js';
import config from '/config.js';

function getComponent(options) {
  let {socket} = options;

  return {
    data: function () {
      this.accountModel = new AGModel({
        socket,
        type: 'Account',
        id: socket.authToken && socket.authToken.accountId,
        fields: [
          'cryptoWalletAddress',
          'cryptoWalletVerified',
          'cryptoWalletVerificationKey'
        ]
      });
      return {
        config,
        account: this.accountModel.value
      };
    },
    methods: {
      saveValue: function () {
        this.accountModel.save();
      }
    },
    template: `
      <div class="component-container">
        <div class="content-body">
          <div class="form-area">
            <label for="input-name">Wallet address:</label>
            <div>
              <input id="input-name" type="text" class="form-control" v-model="account.cryptoWalletAddress" @change="saveValue">
              <span v-if="account.cryptoWalletVerified" class="success-container">(verified)</span>
              <span v-if="!account.cryptoWalletVerified" class="error-container">(not verified)</span>
            </div>
          </div>
          <div v-if="!account.cryptoWalletVerified" class="error-container">
            To verify ownership of the wallet address above, you will need to make a transfer of exactly
            0.{{account.cryptoWalletVerificationKey}} <span>{{config.cryptocurrency.symbol}}</span> (in addition to transaction fee) from your wallet
            to the following wallet address: <span>{{config.nodeWalletAddress}}<span>.
            Your wallet will be verified once the transaction has been added to a block on the main <span>{{config.cryptocurrency.name}}</span> blockchain.
          </div>
        </div>
      </div>
    `
  };
}

export default getComponent;
