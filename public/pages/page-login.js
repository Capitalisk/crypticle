
function getPageComponent(pageOptions) {
  let {socket} = pageOptions;

  return {
    data: function () {
      return {
        error: null,
        email: '',
        password: ''
      };
    },
    methods: {
      login: async function () {
        var details = {
          email: this.email,
          password: this.password
        };
        try {
          await socket.invoke('login', details);
        } catch (error) {
          this.error = `Failed to login. ${error.message}`;

          return;
        }
        this.error = '';
      },
      inputKeyDown: function (event) {
        if (event.key === 'Enter') {
          this.login();
        }
      }
    },
    template: `
      <div class="page-container">
        <h2 class="content-row heading">Login</h2>
        <div class="content-body">
          <div v-if="error" class="form-area">
            <span class="error-container">{{error}}</span>
          </div>
          <div class="form-area">
            <div class="login-label">
              Email:
            </div>
            <input type="text" v-model="email" class="form-control" @keydown="inputKeyDown">
          </div>
          <div class="form-area">
            <div class="login-label">
              Password:
            </div>
            <input type="password" v-model="password" class="form-control" @keydown="inputKeyDown">
          </div>
          <div class="form-area" style="padding-top: 10px;">
            <input type="button" class="form-control" value="Login" @click="login">
          </div>
        </div>
      </div>
    `
  };
}

export default getPageComponent;
