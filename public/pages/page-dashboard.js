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
    template: `
      <div class="page-container container is-fullhd">
        <h3 class="title is-3">Dashboard</h3>

        <div class="spacer"></div>

        <component-account></component-account>

        <hr class="hr hr-big-spacing" />

        <component-settled-transfers></component-settled-transfers>
        <div class="spacer"></div>
        <component-pending-transfers></component-pending-transfers>

        <hr class="hr hr-big-spacing" />

        <component-settled-deposits></component-settled-deposits>
        <div class="spacer"></div>
        <component-pending-deposits></component-pending-deposits>

        <hr class="hr hr-big-spacing" />

        <component-settled-withdrawals></component-settled-withdrawals>
        <div class="spacer"></div>
        <component-pending-withdrawals></component-pending-withdrawals>
      </div>
    `
  };
}

export default getPageComponent;
