import getWalletComponent from '/components/component-wallet.js';
import getDepositsComponent from '/components/component-deposits.js';
import getWithdrawalsComponent from '/components/component-withdrawals.js';
import getTransfersComponent from '/components/component-transfers.js';

function getPageComponent(pageOptions) {
  let {socket, nodeInfo} = pageOptions;

  return {
    components: {
      'component-wallet': getWalletComponent({
        socket,
        nodeInfo
      }),
      'component-settled-deposits': getDepositsComponent({
        socket,
        nodeInfo,
        type: 'settled'
      }),
      'component-pending-deposits': getDepositsComponent({
        socket,
        nodeInfo,
        type: 'pending'
      }),
      'component-settled-withdrawals': getWithdrawalsComponent({
        socket,
        nodeInfo,
        type: 'settled'
      }),
      'component-pending-withdrawals': getWithdrawalsComponent({
        socket,
        nodeInfo,
        type: 'pending'
      }),
      'component-settled-transfers': getTransfersComponent({
        socket,
        nodeInfo,
        type: 'settled'
      }),
      'component-pending-transfers': getTransfersComponent({
        socket,
        nodeInfo,
        type: 'pending'
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

          <component-settled-transfers></component-settled-transfers>
          <component-pending-transfers></component-pending-transfers>

          <component-settled-deposits></component-settled-deposits>
          <component-pending-deposits></component-pending-deposits>

          <component-settled-withdrawals></component-settled-withdrawals>
          <component-pending-withdrawals></component-pending-withdrawals>
        </div>
      </div>
    `
  };
}

export default getPageComponent;
