import getAccountComponent from '/components/component-account.js';
import getTransfersComponent from '/components/component-transfers.js';
import getWithdrawalsComponent from '/components/component-withdrawals.js';
import getDepositsComponent from '/components/component-deposits.js';
import getMakeTransferComponent from '/components/component-make-transfer.js';
import getMakeWithdrawalComponent from '/components/component-make-withdrawal.js';

function getPageComponent(pageOptions) {
  let {socket, publicInfo} = pageOptions;

  return {
    components: {
      'component-account': getAccountComponent({
        socket,
        publicInfo
      }),
      'component-settled-deposits': getDepositsComponent({
        socket,
        publicInfo,
        type: 'settled'
      }),
      'component-pending-deposits': getDepositsComponent({
        socket,
        publicInfo,
        type: 'pending'
      }),
      'component-settled-withdrawals': getWithdrawalsComponent({
        socket,
        publicInfo,
        type: 'settled'
      }),
      'component-pending-withdrawals': getWithdrawalsComponent({
        socket,
        publicInfo,
        type: 'pending'
      }),
      'component-settled-transfers': getTransfersComponent({
        socket,
        publicInfo,
        type: 'settled'
      }),
      'component-pending-transfers': getTransfersComponent({
        socket,
        publicInfo,
        type: 'pending'
      }),
      'component-make-transfer': getMakeTransferComponent({
        socket,
        publicInfo
      }),
      'component-make-withdrawal': getMakeWithdrawalComponent({
        socket,
        publicInfo
      })
    },
    data: function () {
      return {
        accountId: socket.authToken && socket.authToken.accountId
      };
    },
    template: `
      <div class="page-container container is-fullhd content">
        <h3 class="title is-3">Dashboard</h3>

        <div class="spacer"></div>

        <component-account></component-account>

        <hr class="hr hr-big-spacing" />

        <component-settled-transfers></component-settled-transfers>
        <div class="spacer"></div>
        <component-pending-transfers></component-pending-transfers>

        <div class="spacer"></div>

        <component-make-transfer></component-make-transfer>

        <hr class="hr hr-big-spacing" />

        <component-settled-deposits></component-settled-deposits>
        <div class="spacer"></div>
        <component-pending-deposits></component-pending-deposits>

        <hr class="hr hr-big-spacing" />

        <component-settled-withdrawals></component-settled-withdrawals>
        <div class="spacer"></div>
        <component-pending-withdrawals></component-pending-withdrawals>

        <div class="spacer"></div>

        <component-make-withdrawal></component-make-withdrawal>

        <div class="spacer"></div>
      </div>
    `
  };
}

export default getPageComponent;
