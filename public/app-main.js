import getLoginPageComponent from '/pages/page-login.js';
import getDashboardPageComponent from '/pages/page-dashboard.js';

let socket = window.socket = asyngularClient.create();

let pageOptions = {
  socket
};

let PageDashboard = getDashboardPageComponent(pageOptions);
let PageLogin = getLoginPageComponent(pageOptions);

let routes = [
  // { path: '/category/:categoryId/product/:productId', component: PageProductDetails, props: true }, // TODO 2
  { path: '/', component: PageDashboard, props: true }
];

let router = new VueRouter({
  routes
});

new Vue({
  el: '#app',
  router,
  components: {
    'page-login': PageLogin
  },
  data: function () {
    return {
      isAuthenticated: false
    };
  },
  created: function () {
    this.isAuthenticated = this.isSocketAuthenticated();

    (async () => {
      for await (let event of socket.listener('authStateChange')) {
        this.isAuthenticated = this.isSocketAuthenticated();
      }
    })();

    this._localStorageAuthHandler = (change) => {
      // In case the user logged in from a different tab
      if (change.key === socket.options.authTokenName) {
       if (this.isAuthenticated) {
         if (!change.newValue) {
           socket.deauthenticate();
         }
       } else if (change.newValue) {
         socket.authenticate(change.newValue);
       }
      }
    };
    window.addEventListener('storage', this._localStorageAuthHandler);
  },
  destroyed: function () {
    window.removeEventListener('storage', this._localStorageAuthHandler);
  },
  methods: {
    isSocketAuthenticated: function () {
      return socket.authState === 'authenticated';
    }
  },
  template: `
    <div>
      <div v-if="isAuthenticated" style="padding: 10px;">
        <router-view></router-view>
      </div>
      <div v-if="!isAuthenticated" style="padding: 10px;">
        <page-login></page-login>
      </div>
    </div>
  `
});
