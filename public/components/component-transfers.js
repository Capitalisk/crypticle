import AGCollection from '/node_modules/ag-collection/ag-collection.js';

function getComponent(options) {
  let {socket, mainInfo} = options;
  let view;

  if (options.type === 'pending') {
    view = 'accountTransfersPendingView';
  } else if (options.type === 'settled') {
    view = 'accountTransfersSettledView';
  }

  return {
    data: function () {
      this.transactionCollection = new AGCollection({
        socket,
        type: 'Transaction',
        view,
        viewParams: {
          accountId: socket.authToken && socket.authToken.accountId
        },
        fields: ['type', 'recordType', 'amount', 'counterpartyAccountId', 'data', 'canceled', 'createdDate'],
        pageOffset: 0,
        pageSize: 10,
        getCount: true
      });
      return {
        mainInfo,
        transactions: this.transactionCollection.value,
        transactionsMeta: this.transactionCollection.meta,
        transactionType: options.type
      };
    },
    methods: {
      toBlockchainUnits: function (amount, recordType) {
        let value = Number(amount) / Number(mainInfo.cryptocurrency.unit);
        if (recordType === 'debit') {
          value *= -1;
        }
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
        this.transactionCollection.fetchPreviousPage();
      },
      goToNextPage: function () {
        this.transactionCollection.fetchNextPage();
      }
    },
    computed: {
      firstItemIndex: function () {
        if (!this.transactions.length) {
          return 0;
        }
        return this.transactionsMeta.pageOffset + 1;
      },
      lastItemIndex: function () {
        return this.transactionsMeta.pageOffset + this.transactions.length;
      },
      hasMultiplePages: function () {
        return this.transactionsMeta.count > this.transactionsMeta.pageSize;
      }
    },
    template: `
      <div class="component-container container is-fullhd">
        <h4 class="title is-4" v-if="transactionType">{{capitalize(transactionType)}} transfers</h4>
        <h4 class="title is-4" v-if="!transactionType">Transfers</h4>
        <div v-bind:class="{'transfers-paginated-table-container': hasMultiplePages}">
          <table class="table is-striped is-bordered is-fullwidth transfers-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Counterparty account ID</th>
                <th>Data</th>
                <th v-if="transactionType === 'settled'">Status</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="transaction of transactions">
                <tr v-bind:class="{'table-row-failure': transaction.canceled}">
                  <td class="table-cell-id table-first-column">{{transaction.id}}</td>
                  <td>{{transaction.counterpartyAccountId}}</td>
                  <td>{{transaction.data}}</td>
                  <td v-if="transactionType === 'settled'" class="table-cell-status">{{getStatus(transaction.canceled)}}</td>
                  <td class="table-cell-amount">{{toBlockchainUnits(transaction.amount, transaction.recordType)}}<span v-if="mainInfo.cryptocurrency"> {{mainInfo.cryptocurrency.symbol}}</span></td>
                  <td class="table-cell-date">{{toSimpleDate(transaction.createdDate)}}</td>
                </tr>
              </template>
              <tr v-if="transactions.length <= 0">
                <td class="table-empty-row tranfer-table-empty-row" colspan="5">No {{transactionType}} transfers</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="paginator-container">
          <input type="button" class="button" value="Previous page" v-bind:disabled="firstItemIndex <= 1" @click="goToPrevPage" /> <div class="paginator-text">Items <b>{{firstItemIndex}}</b> to <b>{{lastItemIndex}}</b> of <b>{{transactionsMeta.count}}</b></div> <input type="button" class="button" value="Next page" v-bind:disabled="lastItemIndex >= transactionsMeta.count" @click="goToNextPage" />
        </div>
      </div>
    `
  };
}

export default getComponent;
