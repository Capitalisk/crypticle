import getHomePageComponent from '/pages/page-home.js';
import getLoginPageComponent from '/pages/page-login.js';
import getSignupPageComponent from '/pages/page-signup.js';
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
    maxRecordDisplayAge: null
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
let PageSignup = getSignupPageComponent(pageOptions);

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
  {path: '/signup', component: PageSignup, props: (route) => ({kind: route.query.kind})},
  {path: '/login', component: PageLogin, props: (route) => ({redirect: route.query.redirect})},
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
        <div v-if="isAuthenticated" class="navbar-end">
          <div class="navbar-item">
            <div class="buttons">
            <a v-if="location.hash !== '#/console'" class="button is-link" href="#/console">Console</a>
              <a class="button is-primary" href="#/signup">Signup</a>
              <input type="button" class="button is-primary" value="Logout" @click="logout">
            </div>
          </div>
        </div>
        <div v-if="!isAuthenticated" class="navbar-end">
          <div class="navbar-item">
            <div class="buttons">
            <a v-if="location.hash !== '#/console'" class="button is-link" href="#/console">Console</a>
            <a class="button is-primary" href="#/signup">Signup</a>
              <a class="button is-primary" href="#/login?redirect=${encodeURIComponent('#/')}">Login</a>
            </div>
          </div>
        </div>
      </nav>
      <div class="spacer"></div>
      <router-view></router-view>
    </div>
  `
});
