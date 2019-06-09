import AGModel from '/node_modules/ag-model/ag-model.js';
import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getComponent(options) {
  let {socket, mainInfo} = options;
  let view;

  if (options.type === 'pending') {
    view = 'accountWithdrawalsPendingView';
  } else if (options.type === 'settled') {
    view = 'accountWithdrawalsSettledView';
  }

  return {
    data: function () {
      this.withdrawalCollection = new AGCollection({
        socket,
        type: 'Withdrawal',
        view,
        viewParams: {
          accountId: socket.authToken && socket.authToken.accountId
        },
        fields: ['transactionId', 'amount', 'height', 'toWalletAddress', 'attemptCount', 'canceled', 'createdDate'],
        pageOffset: 0,
        pageSize: 10,
        getCount: mainInfo.paginationShowTotalCounts
      });

      return {
        mainInfo,
        withdrawals: this.withdrawalCollection.value,
        withdrawalsMeta: this.withdrawalCollection.meta,
        withdrawalType: options.type
      };
    },
    methods: {
      toBlockchainUnits: function (amount) {
        let value = Number(amount) / Number(mainInfo.cryptocurrency.unit);
        return Math.round(value * 10000) / 10000;
      },
      toSimpleDate: function (dateString) {
        return (new Date(dateString)).toLocaleString();
      },
      capitalize: function (message) {
        return message.charAt(0).toUpperCase() + message.slice(1)
      },
      getStatus: function (canceled) {
        return canceled ? 'canceled' : 'processed';
      },
      goToPrevPage: function () {
        this.withdrawalCollection.fetchPreviousPage();
      },
      goToNextPage: function () {
        this.withdrawalCollection.fetchNextPage();
      }
    },
    computed: {
      firstItemIndex: function () {
        if (!this.withdrawals.length) {
          return 0;
        }
        return this.withdrawalsMeta.pageOffset + 1;
      },
      lastItemIndex: function () {
        return this.withdrawalsMeta.pageOffset + this.withdrawals.length;
      },
      hasMultiplePages: function () {
        return this.withdrawalsMeta.pageOffset > 0 || !this.withdrawalsMeta.isLastPage;
      }
    },
    watch: {
      'mainInfo.paginationShowTotalCounts': function (value) {
        this.withdrawalCollection.getCount = value;
      }
    },
    template: `
      <div class="component-container container is-fullhd">
        <h4 class="title is-4" v-if="withdrawalType">{{capitalize(withdrawalType)}} withdrawals</h4>
        <h4 class="title is-4" v-if="!withdrawalType">Withdrawals</h4>
        <div v-bind:class="{'withdrawals-paginated-table-container': hasMultiplePages}">
          <table class="table is-striped is-bordered is-fullwidth withdrawals-table">
            <thead>
              <tr>
                <th class="table-cell-id">Withdrawal ID</th>
                <th>Amount</th>
                <th v-if="withdrawalType === 'settled'">Height</th>
                <th>To wallet address</th>
                <th v-if="withdrawalType === 'pending'">Attempts</th>
                <th v-if="withdrawalType === 'settled'">Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="wit of withdrawals">
                <tr v-bind:class="{'table-row-failure': wit.canceled}">
                  <td class="table-cell-id table-first-column">{{wit.id}}</td>
                  <td class="table-cell-amount">{{toBlockchainUnits(wit.amount)}}<span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span></td>
                  <td v-if="withdrawalType === 'settled'" class="table-cell-height">{{wit.height}}</td>
                  <td>{{wit.toWalletAddress}}</td>
                  <td v-if="withdrawalType === 'pending'">{{wit.attemptCount}}</td>
                  <td v-if="withdrawalType === 'settled'" class="table-cell-status">{{getStatus(wit.canceled)}}</td>
                  <td class="table-cell-date">{{toSimpleDate(wit.createdDate)}}</td>
                </tr>
              </template>
              <tr v-if="withdrawals.length <= 0">
                <td class="table-empty-row withdrawals-table-empty-row" colspan="10">No {{withdrawalType}} withdrawals</td>
              </tr>
            </tbody>
          </table>
        </div>
        <input type="button" class="button" value="Previous page" v-bind:disabled="!withdrawalsMeta.pageOffset" @click="goToPrevPage" />
        <div class="paginator-text">Items <b>{{firstItemIndex}}</b> to <b>{{lastItemIndex}}</b><span v-if="mainInfo.paginationShowTotalCounts"> of <b>{{withdrawalsMeta.count}}</b></span></div>
        <input type="button" class="button" value="Next page" v-bind:disabled="withdrawalsMeta.isLastPage" @click="goToNextPage" />
      </div>
    `
  };
}

export default getComponent;
