import getHomePageComponent from '/pages/page-home.js';
import getLoginPageComponent from '/pages/page-login.js';
import getLoginImpersonatePageComponent from '/pages/page-impersonate.js';
import getSignupPageComponent from '/pages/page-signup.js';
import getSignupAdminPageComponent from '/pages/page-signup-admin.js';
import getDashboardPageComponent from '/pages/page-dashboard.js';

let socket = window.socket = asyngularClient.create({
  batchInterval: 50
});
socket.startBatching();

let pageOptions = {
  socket,
  mainInfo: {
    cryptocurrency: {},
    mainWalletAddress: null,
    requiredDepositBlockConfirmations: null,
    requiredWithdrawalBlockConfirmations: null,
    paginationShowTotalCounts: false,
    maxRecordDisplayAge: null,
    alwaysRequireSecretSignupKey: false,
    enableAdminAccountSignup: false
  }
};

(async () => {
  let mainInfo;
  try {
    mainInfo = await socket.invoke('getMainInfo');
  } catch (error) {
    console.error(error);
  }
  Object.assign(pageOptions.mainInfo, mainInfo);
})();

let PageHome = getHomePageComponent(pageOptions);
let PageDashboard = getDashboardPageComponent(pageOptions);
let PageLogin = getLoginPageComponent(pageOptions);
let PageLoginImpersonate = getLoginImpersonatePageComponent(pageOptions);
let PageSignup = getSignupPageComponent(pageOptions);
let PageSignupAdmin = getSignupAdminPageComponent(pageOptions);

function isSocketAuthenticated() {
  return socket.authState === 'authenticated';
}

let Console = {
  components: {
    'page-login': PageLogin,
    'page-dashboard': PageDashboard
  },
  data: function () {
    return {
      isAuthenticated: false
    };
  },
  created: function () {
    this.isAuthenticated = isSocketAuthenticated();

    (async () => {
      for await (let event of socket.listener('authStateChange')) {
        this.isAuthenticated = isSocketAuthenticated();
      }
    })();
  },
  template: `
    <div class="console container is-fullhd">
      <div v-if="isAuthenticated" class="container is-fullhd">
        <router-view></router-view>
      </div>
      <div v-if="!isAuthenticated" class="container is-fullhd">
        <page-login></page-login>
      </div>
    </div>
  `
};

let routes = [
  {path: '/', component: PageHome, props: true},
  {path: '/signup', component: PageSignup, props: true},
  {path: '/signup/admin', component: PageSignupAdmin, props: true},
  {path: '/login', component: PageLogin, props: (route) => ({redirect: route.query.redirect})},
  {path: '/impersonate', component: PageLoginImpersonate, props: (route) => ({redirect: route.query.redirect})},
  {
    path: '/console',
    component: Console,
    props: true,
    children: [
      {path: '/', component: PageDashboard, props: true}
    ]
  }
];

let router = new VueRouter({
  routes
});

new Vue({
  el: '#app',
  router,
  data: function () {
    return {
      mainInfo: pageOptions.mainInfo,
      isAuthenticated: false,
      isAdmin: false
    };
  },
  computed: {
    loginPath: function (arg) {
      return `#/login?redirect=${encodeURIComponent('#' + this.$route.path)}`;
    },
    impersonatePath: function () {
      return `#/impersonate?redirect=${encodeURIComponent('#' + this.$route.path)}`;
    }
  },

  created: function () {
    this.isAuthenticated = isSocketAuthenticated();

    (async () => {
      for await (let event of socket.listener('authStateChange')) {
        this.isAuthenticated = isSocketAuthenticated();
        if (socket.authToken && socket.authToken.admin) {
          this.isAdmin = true;
        } else {
          this.isAdmin = false;
        }
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
    logout: function () {
      socket.deauthenticate();
    },
    isOnPage: function (pagePath) {
      return this.$route.path === pagePath;
    }
  },
  template: `
    <div class="app-wrapper container is-fullhd">
      <nav class="navbar" role="navigation" aria-label="main navigation">
        <div class="navbar-brand">
          <h2 class="navbar-item title is-2">
            <a href="#/">Crypticle</a>
          </h2>
        </div>
        <div class="navbar-end">
          <div class="navbar-item">
            <div class="buttons">
              <a class="button is-link" href="#/console" v-bind:disabled="isOnPage('/console')">Console</a>
              <a v-if="isAdmin" class="button is-primary" v-bind:href="impersonatePath" v-bind:disabled="isOnPage('/impersonate')">Impersonate</a>
              <a v-if="mainInfo.enableAdminAccountSignup" class="button is-primary" href="#/signup/admin" v-bind:disabled="isOnPage('/signup/admin')">Signup admin</a>
              <a class="button is-primary" href="#/signup" v-bind:disabled="isOnPage('/signup')">Signup</a>
              <a v-if="!isAuthenticated" class="button is-primary" v-bind:href="loginPath" v-bind:disabled="isOnPage('/login')">Login</a>
              <input v-if="isAuthenticated" type="button" class="button is-primary" value="Logout" @click="logout">
            </div>
          </div>
        </div>
        <div>
      </nav>
      <div class="spacer"></div>
      <router-view></router-view>
    </div>
  `
});
