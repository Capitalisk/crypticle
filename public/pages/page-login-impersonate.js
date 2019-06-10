
function getPageComponent(pageOptions) {
  let {socket} = pageOptions;

  return {
    props: {
      redirect: {
        type: String,
        default: null
      }
    },
    data: function () {
      return {
        error: null,
        username: ''
      };
    },
    methods: {
      login: async function () {
        var details = {
          username: this.username
        };
        try {
          await socket.invoke('adminLogin', details);
        } catch (error) {
          this.error = `Failed to login. ${error.message}`;
          return;
        }
        this.error = '';

        if (this.redirect != null) {
          window.location.href = decodeURIComponent(this.redirect);
        }
      }
    },
    template: `
      <div class="page-container container login-container">
        <h2 class="title is-2">Admin impersonate login</h2>
        <div v-if="error" class="field has-text-danger">
          <span>{{error}}</span>
        </div>
        <div class="field">
          <label class="label" for="login-form-username">
            Username
          </label>
          <input id="login-form-username" type="text" v-model="username" class="input" @keydown.enter="login">
        </div>
        <div class="field">
          <input type="button" class="button is-medium is-link" value="Login" @click="login">
        </div>
      </div>
    `
  };
}

export default getPageComponent;
