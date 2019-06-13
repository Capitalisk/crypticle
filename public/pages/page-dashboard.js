import getAccountComponent from '/components/component-account.js';
import getTransfersComponent from '/components/component-transfers.js';
import getWithdrawalsComponent from '/components/component-withdrawals.js';
import getDepositsComponent from '/components/component-deposits.js';
import getMakeTransferComponent from '/components/component-make-transfer.js';
import getMakeWithdrawalComponent from '/components/component-make-withdrawal.js';

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
      }),
      'component-make-transfer': getMakeTransferComponent({
        socket,
        mainInfo
      }),
      'component-make-withdrawal': getMakeWithdrawalComponent({
        socket,
        mainInfo
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
