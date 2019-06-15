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
      (async () => {
        for await (let {error} of this.depositCollection.listener('error')) {
          console.error(error);
        }
      })();

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
        return this.depositsMeta.pageOffset > 0 || !this.depositsMeta.isLastPage;
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
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="dep of deposits">
                <tr v-bind:class="{'table-row-failure': dep.canceled}">
                  <td class="table-cell-id table-first-column">{{dep.id}}</td>
                  <td class="table-cell-amount">{{toBlockchainUnits(dep.amount)}}<span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span></td>
                  <td v-if="depositType === 'settled'" class="table-cell-height">{{dep.height}}</td>
                  <td class="table-cell-date">{{toSimpleDate(dep.createdDate)}}</td>
                </tr>
              </template>
              <tr v-if="deposits.length <= 0">
                <td class="table-empty-row deposit-table-empty-row" colspan="10">No {{depositType}} deposits</td>
              </tr>
            </tbody>
          </table>
        </div>
        <input type="button" class="button" value="Previous page" v-bind:disabled="!depositsMeta.pageOffset" @click="goToPrevPage" />
        <div class="paginator-text">Items <b>{{firstItemIndex}}</b> to <b>{{lastItemIndex}}</b><span v-if="mainInfo.paginationShowTotalCounts"> of <b>{{depositsMeta.count}}</b></span></div>
        <input type="button" class="button" value="Next page" v-bind:disabled="depositsMeta.isLastPage" @click="goToNextPage" />
      </div>
    `
  };
}

export default getComponent;
