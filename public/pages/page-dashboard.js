import getDepositsComponent from '/components/component-deposits.js';
import getWithdrawalsComponent from '/components/component-withdrawals.js';
import getTransfersComponent from '/components/component-transfers.js';
import getAccountComponent from '/components/component-account.js';

function getPageComponent(pageOptions) {
  let {socket, mainInfo} = pageOptions;

  return {
    components: {
      'component-account': getAccountComponent({
        socket,
        mainInfo
      }),
      'component-settled-deposits': getDepositsComponent({
        socket,
        mainInfo,
        type: 'settled'
      }),
      'component-pending-deposits': getDepositsComponent({
        socket,
        mainInfo,
        type: 'pending'
      }),
      'component-settled-withdrawals': getWithdrawalsComponent({
        socket,
        mainInfo,
        type: 'settled'
      }),
      'component-pending-withdrawals': getWithdrawalsComponent({
        socket,
        mainInfo,
        type: 'pending'
      }),
      'component-settled-transfers': getTransfersComponent({
        socket,
        mainInfo,
        type: 'settled'
      }),
      'component-pending-transfers': getTransfersComponent({
        socket,
        mainInfo,
        type: 'pending'
      })
    },
    data: function () {
      return {
        accountId: socket.authToken && socket.authToken.accountId
      };
    },
    methods: {},
    template: `
      <div class="page-container">
        <h2 class="content-row heading">Dashboard</h2>
        <div class="content-body">
          <component-account></component-account>

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
