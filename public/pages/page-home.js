
function getPageComponent(pageOptions) {
  let {socket} = pageOptions;

  return {
    data: function () {
      return {};
    },
    methods: {},
    template: `
      <div class="page-container container is-fullhd">
        <div class="container is-fullhd content">
          <h4 class="title is-4">API overview</h4>

          <p>
            Crypticle exposes a realtime WebSocket API for performing transactions and listening for realtime changes.
            The API adheres to the <a href="https://github.com/SocketCluster/socketcluster/blob/master/socketcluster-protocol.md#socketcluster-protocol-v1">SocketCluster protocol</a>.
            The following examples make use of the <a href="https://github.com/SocketCluster/asyngular-client">Asyngular JavaScript client</a>.
          </p>
          <p>
            For more details about the API including the realtime CRUD API, visit <a href="https://crypticle.io">crypticle.io</a>.
          </p>

          <hr class="hr hr-medium-spacing" />

          <h4 class="title is-4">Account RPCs</h4>
          <h5 class="title is-5">Signup</h5>
          <pre class="code-snippet"><code>
    try {
      await socket.invoke('signup', {
        username: 'alice123',
        password: 'password123',
        admin: false,
        secretSignupKey: '313e7cc1-ad75-4030-a927-6a09f39c1603'
      })
    } catch (error) {
      // Handle failure
    }
          </code></pre>
          <ul class="list">
            <li class="list-item"><code>username</code> is the account username.</li>
            <li class="list-item"><code>password</code> is the account password.</li>
            <li class="list-item"><code>admin</code> is a boolean which indicates whether or not the account should have admin privileges.</li>
            <li class="list-item">
              <p>
                <code>secretSignupKey</code> is a secret key which needs to be provided if either:
              </p>
              <ul>
                <li>
                  The account being created is an admin account.
                </li>
                <li>
                  The server side <code>alwaysRequireSecretSignupKey</code> config is <code>true</code>.
                </li>
              </ul>
              <p>
                If required, this key needs to match <code>secretSignupKey</code> from the service config file.
              </p>
            </li>
          </ul>
          <p>
            Returns a <code>Promise</code> which will be rejected if the signup operation fails on the server.
          </p>

          <div class="spacer"></div>

          <h5 class="title is-5">Login</h5>
          <pre class="code-snippet"><code>
    try {
      await socket.invoke('login', {
        username: 'alice123',
        password: 'password123'
      })
    } catch (error) {
      // Handle login failure.
    }
          </code></pre>
          <ul class="list">
            <li class="list-item"><code>username</code> is the account username.</li>
            <li class="list-item"><code>password</code> is the account password.</li>
          </ul>
          <p>
            Returns a <code>Promise</code> which will be rejected if the login operation fails on the server.
          </p>

          <div class="spacer"></div>

          <h5 class="title is-5">Transfer</h5>
          <pre class="code-snippet"><code>
    let {creditId, debitId} = await socket.invoke('transfer', {
      amount: '1000000000',
      toAccountId: '18b50e59-f3a1-4b57-8f0b-7daeba7259ad',
      data: 'Notes...'
    })
          </code></pre>
          <ul class="list">
            <li class="list-item"><code>amount</code> is the amount of funds to send to the specified Crypticle account - It is expressed in the smallest possible cryptocurrency unit.</li>
            <li class="list-item"><code>toAccountId</code> is the ID of the Crypticle account to send the funds to.</li>
            <li class="list-item"><code>data</code> is a custom string to add to both the debit and credit transactions which will be created as a result of the transfer.</li>
            <li class="list-item"><code>debitId</code> is an optional ID (string in UUID format) to use for the underlying debit transaction. If not provided, it will be automatically generated on the backend.</li>
            <li class="list-item"><code>creditId</code> is an optional ID (string in UUID format) to use for the underlying credit transaction. If not provided, it will be automatically generated on the backend.</li>
          </ul>
          <p>Returns a promise which resolves with an object containing the <code>creditId</code> and <code>debitId</code> (transaction IDs) of the underlying transactions.</p>

          <div class="spacer"></div>

          <h5 class="title is-5">Get balance</h5>
          <pre class="code-snippet"><code>
    let balance = await socket.invoke('getBalance')
          </code></pre>
          <p>
            Returns a <code>Promise</code> which resolves with the current logged in user's account balance as a string.
          </p>

          <div class="spacer"></div>

          <h5 class="title is-5">Withdraw</h5>
          <pre class="code-snippet"><code>
    let {withdrawalId} = await socket.invoke('withdraw', {
      amount: '1100000000',
      toWalletAddress: '6942317426094516776R'
    })
          </code></pre>
          <ul class="list">
            <li class="list-item"><code>amount</code> is the amount of funds to withdraw from your Crypticle account - It is expressed in the smallest possible cryptocurrency unit.</li>
            <li class="list-item"><code>toWalletAddress</code> is the blockchain wallet address to send the funds to.</li>
          </ul>
          <p>Returns a <code>Promise</code> which resolves with the withdrawal ID as a string.</p>

          <div class="spacer"></div>

          <h5 class="title is-5">Deposit</h5>
          <p>
            To make a deposit, send a blockchain transaction to the deposit address of your Crypticle account (as shown on your console dashboard). The deposit wallet address for your account is shown on your console dashboard.
          </p>
        </div>

        <hr class="hr hr-medium-spacing" />

        <div class="container is-fullhd content">
          <h4 class="title is-4">Admin RPCs</h4>

          <h5 class="title is-5">Impersonate</h5>
          <pre class="code-snippet"><code>
    try {
      await socket.invoke('adminImpersonate', {
        username: 'alice123'
      })
    } catch (error) {
      // Handle impersonation failure.
    }
          </code></pre>
          <ul class="list">
            <li class="list-item"><code>username</code> is the username of the account to impersonate.</li>
          </ul>
          <p>
            The <code>Promise</code> will be rejected if the impersonate operation fails on the server.
          </p>

          <div class="spacer"></div>

          <h5 class="title is-5">Transfer</h5>
          <pre class="code-snippet"><code>
    let {creditId, debitId} = await socket.invoke('adminTransfer', {
      amount: '20000000',
      fromAccountId: '213288af-9239-494d-844d-d064ced6f9ea',
      toAccountId: '18b50e59-f3a1-4b57-8f0b-7daeba7259ad',
      data: 'Notes...'
    })
          </code></pre>
          <ul class="list">
            <li class="list-item"><code>amount</code> is the amount of funds to send to the specified Crypticle account - It is expressed in the smallest possible cryptocurrency unit.</li>
            <li class="list-item"><code>fromAccountId</code> is the ID of the Crypticle account from which to take the funds from.</li>
            <li class="list-item"><code>toAccountId</code> is the ID of the Crypticle account to send the funds to.</li>
            <li class="list-item"><code>data</code> is a custom string to add to both the debit and credit transactions which will be created as a result of the transfer.</li>
            <li class="list-item"><code>debitId</code> is an optional ID (string in UUID format) to use for the underlying debit transaction. If not provided, it will be automatically generated on the backend.</li>
            <li class="list-item"><code>creditId</code> is an optional ID (string in UUID format) to use for the underlying credit transaction. If not provided, it will be automatically generated on the backend.</li>
          </ul>
          <p>Returns a promise which resolves with an object containing the <code>creditId</code> and <code>debitId</code> (transaction IDs) of the underlying transactions.</p>

          <div class="spacer"></div>

          <h5 class="title is-5">Get balance</h5>
          <pre class="code-snippet"><code>
    let balance = await socket.invoke('adminGetBalance', {
      accountId: '213288af-9239-494d-844d-d064ced6f9ea'
    })
          </code></pre>
          <ul class="list">
            <li class="list-item"><code>accountId</code> is the ID of the Crypticle account to get the balance from.</li>
          </ul>
          <p>
            Returns a <code>Promise</code> which resolves with the current balance of the specified account as a string.
          </p>

          <div class="spacer"></div>

          <h5 class="title is-5">Withdraw</h5>
          <pre class="code-snippet"><code>
    let {withdrawalId} = await socket.invoke('adminWithdraw', {
      amount: '234000000',
      fromAccountId: '7667174938767705051R',
      toWalletAddress: '6942317426094516776R'
    })
          </code></pre>
          <ul class="list">
            <li class="list-item"><code>amount</code> is the amount of funds to withdraw from the specified Crypticle account - It is expressed in the smallest possible cryptocurrency unit.</li>
            <li class="list-item"><code>fromAccountId</code> is the ID of the Crypticle account from which to withdraw the funds.</li>
            <li class="list-item"><code>toWalletAddress</code> is the blockchain wallet address to send the funds to.</li>
          </ul>
          <p>Returns a <code>Promise</code> which resolves with the withdrawal ID as a string.</p>
        </div>

        <hr class="hr hr-medium-spacing" />

        <div class="container is-fullhd content">
          <h4 class="title is-4">Realtime CRUD channels</h4>

          <p>
            Modifying data within Crypticle will cause change notifications to be published to specific channels.
            A channel can either represent a field of a specific resource or an entire view (collection).
          </p>

          <div class="spacer"></div>

          <h5 class="title is-5">Resource field changes</h5>
          <p>
            You can subscribe to and consume realtime changes from a resource field channel like this:
          </p>

          <pre class="code-snippet"><code>
    // This example shows how to detect when the 'settled' property of the
    // transaction with ID 1336b876-fda0-42dc-8834-b407d4d9d5fc has changed.

    let transactionSettledChannel = socket.subscribe(
      '<b>crud>Transaction/1336b876-fda0-42dc-8834-b407d4d9d5fc/settled</b>'
    );

    (async () => {
      for await (let {value} of transactionSettledChannel) {
        // value will be true when the transaction has settled.
      }
    })();
          </code></pre>
          <p>
            Note that it's possible to subscribe to a channel for any resource field defined in schema-data.js provided that the current authenticated user has the required access rights.
          </p>

          <div class="spacer"></div>

          <h5 class="title is-5">View changes</h5>
          <p>
            You can subscribe to and consume realtime change notifications from a view channel like this:
          </p>

          <pre class="code-snippet"><code>
    // This example shows how to detect when a transaction has been added to the
    // 'lastSettledTransactions' view for the account with ID 213288af-9239-494d-844d-d064ced6f9ea.

    let lastSettledTransactionsChannel = socket.subscribe(
      '<b>crud>lastSettledTransactions({"accountId":"213288af-9239-494d-844d-d064ced6f9ea"}):Transaction</b>'
    );

    (async () => {
      for await (let data of lastSettledTransactionsChannel) {
        // This loop will iterate once when whenever the view has been
        // modified (e.g. a new transaction was added). The data variable is always undefined.
        // It's a good time to re-fetch the latest account balance.
        let balance = await socket.invoke('getBalance');
      }
    })();
          </code></pre>
          <p>
            Note that it's possible to subscribe to a channel for any view defined in schema-data.js provided that the current authenticated user has the required access rights.
          </p>
        </div>
      </div>
    `
  };
}

export default getPageComponent;
