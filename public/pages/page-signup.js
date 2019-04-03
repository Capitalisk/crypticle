import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getPageComponent(pageOptions) {
  let socket = pageOptions.socket;

  return Vue.extend({
    data: function () {
      this.accountCollection = new AGCollection({
        socket: pageOptions.socket,
        type: 'Account',
        fields: ['email', 'password']
      });

      return {
        error: null,
        email: '',
        password: ''
      };
    },
    methods: {
      signup: async function () {
        let details = {
          email: this.email,
          password: this.password
        };
        try {
          await this.accountCollection.create(details);
        } catch (error) {
          this.error = `Failed to sign up due to error: ${error}`;
          return;
        }

        this.error = '';
      },
      inputKeyDown: function (event) {
        if (event.key === 'Enter') {
          this.signup();
        }
      }
    },
    template: `
      <div class="page-container">
        <h2 class="content-row heading">Sign up</h2>
        <div class="content-body">
          <div v-if="error" class="input-area">
            <span class="error-container">{{error}}</span>
          </div>
          <div class="input-area">
            <div class="signup-label">
              Email:
            </div>
            <input type="text" v-model="email" class="form-control" @keydown="inputKeyDown">
          </div>
          <div class="input-area">
            <div class="signup-label">
              Password:
            </div>
            <input type="password" v-model="password" class="form-control" @keydown="inputKeyDown">
          </div>
          <div class="input-area" style="padding-top: 10px;">
            <input type="button" class="form-control" value="Sign up" @click="signup">
          </div>
        </div>
      </div>
    `
  });
}

export default getPageComponent;
