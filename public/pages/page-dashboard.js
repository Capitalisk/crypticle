import getWalletComponent from '/components/component-wallet.js';

function getPageComponent(pageOptions) {
  let {socket, nodeInfo} = pageOptions;

  return {
    components: {
      'component-wallet': getWalletComponent({
        socket,
        nodeInfo
      })
    },
    data: function () {
      return {};
    },
    methods: {},
    template: `
      <div class="page-container">
        <h2 class="content-row heading">Dashboard</h2>
        <div class="content-body">
          <component-wallet></component-wallet>
        </div>
      </div>
    `
  };
}

export default getPageComponent;
