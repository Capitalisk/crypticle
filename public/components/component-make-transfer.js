import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getComponent(options) {
  let {socket, mainInfo} = options;

  return {
    data: function () {
      return {
        mainInfo,
        accountId: null,
        amount: null,
        data: null,
        error: null,
        success: null,
        isTransferModalActive: false
      };
    },
    methods: {
      openTransferModal: function () {
        this.isTransferModalActive = true;
      },
      closeTransferModal: function () {
        this.isTransferModalActive = false;
      },
      clearForm: function () {
        this.error = null;
        this.success = null;
        this.accountId = null;
        this.amount = null;
        this.data = null;
      },
      sendTransfer: async function () {
        if (!this.amount || !this.accountId) {
          this.error = 'Could not execute the transfer. The account ID and amount were not provided.';
          return;
        }
        if (mainInfo.cryptocurrency.unit == null) {
          this.error = 'Could not execute the transfer. The cryptocurrency unit value could not be determined.';
          return;
        }
        let accountId = this.accountId.trim();
        let unitAmount = parseFloat(this.amount);
        let totalAmount = unitAmount * parseInt(mainInfo.cryptocurrency.unit);
        let totalAmountString = totalAmount.toString();

        try {
          await socket.invoke('transfer', {
            amount: totalAmountString,
            toAccountId: accountId,
            data: this.data
          });
        } catch (error) {
          this.clearForm();
          this.success = null;
          this.error = error.message;
          return;
        }
        this.clearForm();
        this.error = null;
        this.success = 'Transfer was sent successfully.';
      }
    },
    template: `
      <div class="component-container container is-fullhd">
        <input type="button" class="button is-primary" value="Make transfer" @click="openTransferModal" />

        <div v-bind:class="{'modal': true, 'is-active': isTransferModalActive}">
          <div class="modal-background"></div>
          <div class="modal-card">
            <header class="modal-card-head">
              <span class="modal-card-title">Make a transfer</span>
              <button class="delete" aria-label="close" @click="closeTransferModal"></button>
            </header>
            <section class="modal-card-body">
              <div v-if="error" class="has-text-danger field">
                <span>{{error}}</span>
              </div>
              <div v-if="success" class="has-text-success field">
                <span>{{success}}</span>
              </div>
              <div class="field">
                <label class="label" for="make-transfer-account-id">
                  To account ID
                </label>
                <input id="make-transfer-account-id" type="text" v-model="accountId" class="input">
              </div>
              <div class="field">
                <label class="label" for="make-transfer-amount">
                  Amount ({{mainInfo.cryptocurrency.symbol}})
                </label>
                <input id="make-transfer-amount" type="text" v-model="amount" class="input">
              </div>
              <div class="field">
                <label class="label" for="make-transfer-data">
                  Data
                </label>
                <input id="make-transfer-data" type="text" v-model="data" class="input">
              </div>
            </section>
            <footer class="modal-card-foot">
              <button class="button is-link" @click="sendTransfer">Send transfer</button>
              <button class="button" @click="closeTransferModal">Cancel</button>
            </footer>
          </div>
        </div>
      </div>
    `
  };
}

export default getComponent;
