import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getPageComponent(pageOptions) {
  let {socket, publicInfo} = pageOptions;

  return {
    data: function () {
      this.accountCollection = new AGCollection({
        socket,
        type: 'Account',
        fields: ['password'],
        writeOnly: true
      });

      return {
        success: null,
        error: null,
        accountId: '',
        password: '',
        secretSignupKey: null,
        showConsoleLink: false,
        publicInfo
      };
    },
    destroyed: function () {
      this.accountCollection.destroy();
    },
    methods: {
      signup: async function () {
        let details = {
          accountId: this.accountId,
          password: this.password,
          admin: false,
          secretSignupKey: this.secretSignupKey
        };
        try {
          await socket.invoke('signup', details);
        } catch (error) {
          this.error = `Failed to sign up. ${error.message}`;
          this.showConsoleLink = false;
          this.success = null;
          return;
        }

        this.error = null;
        this.success = 'Account was created successfully.';
        this.showConsoleLink = true;
      }
    },
    template: `
      <div class="page-container container signup-container">
        <h2 class="title is-2">Sign up user account</h2>
        <div v-if="error" class="has-text-danger field">
          <span>{{error}}</span>
        </div>
        <div v-if="success" class="has-text-success field">
          <span>{{success}}</span>
        </div>
        <div v-if="showConsoleLink" class="field"><a href="#/console">Click here</a> to go to the console.</div>
        <div class="field">
          <label class="label" for="signup-form-account-id">
            Account ID
          </label>
          <input id="signup-form-account-id" type="text" v-model="accountId" class="input" @keydown.enter="signup">
        </div>
        <div class="field">
          <label class="label" for="signup-form-password">
            Password
          </label>
          <input id="signup-form-password" type="password" v-model="password" class="input" @keydown.enter="signup">
        </div>
        <div v-if="publicInfo.alwaysRequireSecretSignupKey" class="field">
          <label class="label" for="signup-form-secret-signup-key">
            Secret signup key
          </label>
          <input id="signup-form-secret-signup-key" type="password" v-model="secretSignupKey" class="input" @keydown.enter="signup">
        </div>
        <div class="field">
          <input type="button" class="button is-medium is-link" value="Sign up" @click="signup">
        </div>
      </div>
    `
  };
}

export default getPageComponent;
