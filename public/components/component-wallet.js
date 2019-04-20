import AGModel from '/node_modules/ag-model/ag-model.js';

function getComponent(options) {
  let {socket, nodeInfo} = options;

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
        nodeInfo,
        account: this.accountModel.value
      };
    },
    computed: {
      walletVerificationAmount: function () {
        return Number(this.account.cryptoWalletVerificationKey) / Number(nodeInfo.cryptocurrency.unit);
      }
    },
    methods: {
      saveAccount: function () {
        this.accountModel.save();
      }
    },
    template: `
      <div class="component-container">
        <div class="content-body" v-if="account.cryptoWalletAddress">
          <div class="form-area">
            <label for="input-name">
              Your wallet address: <b>{{account.cryptoWalletAddress}}</b>
              <span v-if="account.cryptoWalletVerified" class="success-container">(verified)</span>
              <span v-if="!account.cryptoWalletVerified" class="error-container">(not verified)</span>
            </label>
          </div>
          <p v-if="account.cryptoWalletVerified">
            <span>To deposit funds into your account on this service, send <span>{{nodeInfo.cryptocurrency.symbol}}</span> tokens to the following wallet address: <b>{{nodeInfo.nodeWalletAddress}}</b>.</span>
            <span class="error-container">Note that the funds must come from your own verified wallet address or else they will be lost!</span>
            <span>
              You will need to wait for <b>{{nodeInfo.requiredBlockConfirmations}}</b> confirmations before the funds can be used.
            </span>
          </p>
          <p v-if="!account.cryptoWalletVerified" class="error-container">
            You will not be able to use this service until you have proven that you are the owner of the wallet address above.
            To prove your ownership of the wallet address, you will need to make a transfer of exactly
            <b>{{walletVerificationAmount}}</b> <span>{{nodeInfo.cryptocurrency.symbol}}</span> (not counting the transaction fee) from that wallet
            to the following wallet address: <b>{{nodeInfo.nodeWalletAddress}}</b>.
            Your wallet will be verified once the transaction has been added to a block on the <span>{{nodeInfo.cryptocurrency.name}}</span> blockchain.
            Note that you will need to wait for <b>{{nodeInfo.requiredBlockConfirmations}}</b> confirmations before the funds can be used.
          </p>
        </div>
      </div>
    `
  };
}

export default getComponent;
