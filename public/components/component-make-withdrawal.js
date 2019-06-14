import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getComponent(options) {
  let {socket, mainInfo} = options;

  return {
    data: function () {
      return {
        mainInfo,
        walletAddress: null,
        amount: null,
        error: null,
        isModalActive: false
      };
    },
    methods: {
      openModal: function () {
        this.isModalActive = true;
      },
      closeModal: function () {
        this.clearForm();
        this.isModalActive = false;
      },
      clearForm: function () {
        this.error = null;
        this.walletAddress = null;
        this.amount = null;
      },
      sendWithdrawal: async function () {
        if (!this.walletAddress) {
          this.error = 'Could not execute the withdrawal. The wallet address was not provided.';
          return;
        }
        if (!this.amount || this.amount < 0) {
          this.error = 'Could not execute the withdrawal. The amount was not provided or was invalid.';
          return;
        }
        if (mainInfo.cryptocurrency.unit == null) {
          this.error = 'Could not execute the withdrawal. The cryptocurrency unit value could not be determined.';
          return;
        }
        let walletAddress = this.walletAddress.trim();
        let unitAmount = parseFloat(this.amount);
        let totalAmount = Math.round(unitAmount * parseInt(mainInfo.cryptocurrency.unit));
        let totalAmountString = totalAmount.toString();

        try {
          await socket.invoke('withdraw', {
            amount: totalAmountString,
            toWalletAddress: walletAddress
          });
        } catch (error) {
          this.error = error.message;
          return;
        }
        this.clearForm();
        this.closeModal();
      }
    },
    template: `
      <div class="component-container container is-fullhd">
        <input type="button" class="button is-primary" value="Make a withdrawal" @click="openModal" />

        <div v-bind:class="{'modal': true, 'is-active': isModalActive}">
          <div class="modal-background"></div>
          <div class="modal-card">
            <header class="modal-card-head">
              <span class="modal-card-title">Make a withdrawal</span>
              <button class="delete" aria-label="close" @click="closeModal"></button>
            </header>
            <section class="modal-card-body">
              <div v-if="error" class="has-text-danger field">
                <span>{{error}}</span>
              </div>
              <div class="field">
                <label class="label" for="make-withdrawal-wallet-address">
                  To wallet address
                </label>
                <input id="make-withdrawal-wallet-address" type="text" v-model="walletAddress" class="input" @keydown.enter="sendWithdrawal">
              </div>
              <div class="field">
                <label class="label" for="make-withdrawal-amount">
                  Amount ({{mainInfo.cryptocurrency.symbol}})
                </label>
                <input id="make-withdrawal-amount" type="text" v-model="amount" class="input" @keydown.enter="sendWithdrawal">
              </div>
            </section>
            <footer class="modal-card-foot">
              <button class="button is-link" @click="sendWithdrawal">Send withdrawal</button>
              <button class="button" @click="closeModal">Cancel</button>
            </footer>
          </div>
        </div>
      </div>
    `
  };
}

export default getComponent;
