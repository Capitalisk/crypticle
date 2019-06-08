import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getComponent(options) {
  let {socket, mainInfo} = options;
  let view;

  if (options.type === 'pending') {
    view = 'accountDepositsPendingView';
  } else if (options.type === 'settled') {
    view = 'accountDepositsSettledView';
  }

  return {
    data: function () {
      this.depositCollection = new AGCollection({
        socket,
        type: 'Deposit',
        view,
        viewParams: {
          accountId: socket.authToken && socket.authToken.accountId
        },
        fields: ['transactionId', 'amount', 'height', 'canceled', 'createdDate'],
        pageOffset: 0,
        pageSize: 10,
        getCount: mainInfo.paginationShowTotalCounts
      });

      return {
        mainInfo,
        deposits: this.depositCollection.value,
        depositsMeta: this.depositCollection.meta,
        depositType: options.type
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
        this.depositCollection.fetchPreviousPage();
      },
      goToNextPage: function () {
        this.depositCollection.fetchNextPage();
      }
    },
    computed: {
      firstItemIndex: function () {
        if (!this.deposits.length) {
          return 0;
        }
        return this.depositsMeta.pageOffset + 1;
      },
      lastItemIndex: function () {
        return this.depositsMeta.pageOffset + this.deposits.length;
      },
      hasMultiplePages: function () {
        return this.depositsMeta.count > this.depositsMeta.pageSize;
      }
    },
    watch: {
      'mainInfo.paginationShowTotalCounts': function (value) {
        this.depositCollection.getCount = value;
      }
    },
    template: `
      <div class="component-container container is-fullhd">
        <h4 class="title is-4" v-if="depositType">{{capitalize(depositType)}} deposits</h4>
        <h4 class="title is-4" v-if="!depositType">Deposits</h4>
        <div v-bind:class="{'deposits-paginated-table-container': hasMultiplePages}">
          <table class="table is-striped is-bordered is-fullwidth deposits-table">
            <thead>
              <tr>
                <th>Deposit ID</th>
                <th>Amount</th>
                <th v-if="depositType === 'settled'">Height</th>
                <th v-if="depositType === 'settled'">Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="dep of deposits">
                <tr v-bind:class="{'table-row-failure': dep.canceled}">
                  <td class="table-cell-id table-first-column">{{dep.id}}</td>
                  <td class="table-cell-amount">{{toBlockchainUnits(dep.amount)}}<span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span></td>
                  <td v-if="depositType === 'settled'" class="table-cell-height">{{dep.height}}</td>
                  <td v-if="depositType === 'settled'" class="table-cell-status">{{getStatus(dep.canceled)}}</td>
                  <td class="table-cell-date">{{toSimpleDate(dep.createdDate)}}</td>
                </tr>
              </template>
              <tr v-if="deposits.length <= 0">
                <td class="table-empty-row deposit-table-empty-row" colspan="5">No {{depositType}} deposits</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="mainInfo.paginationShowTotalCounts" class="paginator-container">
          <input type="button" class="button" value="Previous page" v-bind:disabled="firstItemIndex <= 1" @click="goToPrevPage" /> <div class="paginator-text">Items <b>{{firstItemIndex}}</b> to <b>{{lastItemIndex}}</b> of <b>{{depositsMeta.count}}</b></div> <input type="button" class="button" value="Next page" v-bind:disabled="lastItemIndex >= depositsMeta.count" @click="goToNextPage" />
        </div>
        <div v-if="!mainInfo.paginationShowTotalCounts" class="paginator-container">
          <input type="button" class="button" value="Previous page" v-bind:disabled="firstItemIndex <= 1" @click="goToPrevPage" /> <div class="paginator-text">Items <b>{{firstItemIndex}}</b> to <b>{{lastItemIndex}}</b></div> <input type="button" class="button" value="Next page" @click="goToNextPage" />
        </div>
      </div>
    `
  };
}

export default getComponent;
