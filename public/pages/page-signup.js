import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getPageComponent(pageOptions) {
  let {socket} = pageOptions;

  return {
    data: function () {
      this.accountCollection = new AGCollection({
        socket,
        type: 'Account',
        fields: ['cryptoWalletAddress', 'password'],
        writeOnly: true
      });

      return {
        success: null,
        error: null,
        cryptoWalletAddress: '',
        password: '',
        showConsoleLink: false
      };
    },
    methods: {
      signup: async function () {
        let details = {
          cryptoWalletAddress: this.cryptoWalletAddress,
          password: this.password
        };
        try {
          await this.accountCollection.create(details);
        } catch (error) {
          this.error = `Failed to sign up. ${error.message}`;
          this.showConsoleLink = error.name === 'SignUpWalletAddressTakenError';
          this.success = null;
          return;
        }

        this.error = null;
        this.success = 'Account was created successfully.';
        this.showConsoleLink = true;
      }
    },
    template: `
      <div class="page-container">
        <h2 class="content-row heading">Sign up</h2>
        <div class="content-body">
          <div v-if="error" class="error-container">
            <span>{{error}}</span>
          </div>
          <div v-if="success" class="success-container">
            <span>{{success}}</span>
          </div>
          <span v-if="showConsoleLink"><a href="#/console">Click here</a> to go to the console.</span>
          <div class="form-area">
            <div class="signup-label">
              Blockchain wallet address:
            </div>
            <input type="text" v-model="cryptoWalletAddress" class="form-control" @keydown.enter="signup">
          </div>
          <div class="form-area">
            <div class="signup-label">
              Password:
            </div>
            <input type="password" v-model="password" class="form-control" @keydown.enter="signup">
          </div>
          <div class="form-area" style="padding-top: 10px;">
            <input type="button" class="form-control" value="Sign up" @click="signup">
          </div>
        </div>
      </div>
    `
  };
}

export default getPageComponent;
