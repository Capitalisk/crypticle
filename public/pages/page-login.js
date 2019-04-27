
function getPageComponent(pageOptions) {
  let {socket} = pageOptions;

  return {
    data: function () {
      return {
        error: null,
        username: '',
        password: ''
      };
    },
    methods: {
      login: async function () {
        var details = {
          username: this.username,
          password: this.password
        };
        try {
          await socket.invoke('login', details);
        } catch (error) {
          this.error = `Failed to login. ${error.message}`;

          return;
        }
        this.error = '';
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
              Username:
            </div>
            <input type="text" v-model="username" class="form-control" @keydown.enter="login">
          </div>
          <div class="form-area">
            <div class="login-label">
              Password:
            </div>
            <input type="password" v-model="password" class="form-control" @keydown.enter="login">
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
