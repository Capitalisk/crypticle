
function getPageComponent(pageOptions) {
  let {socket} = pageOptions;

  return {
    data: function () {
      return {};
    },
    methods: {},
    template: `
      <div class="page-container container is-fullhd">
        <div class="container is-fullhd">
          <h4 class="title is-4">API overview</h4>

          <p>
            Crypticle exposes a realtime WebSocket API for performing transactions and listening for realtime changes.
            The API adheres to the <a href="https://github.com/SocketCluster/socketcluster/blob/master/socketcluster-protocol.md#socketcluster-protocol-v1">SocketCluster protocol</a>.
            The following examples make use of the <a href="https://github.com/SocketCluster/asyngular-client">Asyngular JavaScript client</a>.
          </p>

          <hr class="hr hr-medium-spacing" />

          <h4 class="title is-4">Account RPCs</h4>
          <h5 class="title is-5">Transfer</h5>
          <pre class="code-snippet"><code>
    socket.invoke('transfer', {
      amount: '1000000000',
      toAccountId: '18b50e59-f3a1-4b57-8f0b-7daeba7259ad',
      data: 'Notes...'
    })
          </code></pre>
          <ul class="list">
            <li class="list-item"><code>amount</code> is the amount of funds to send to the specified Crypticle account - It is expressed in the smallest possible cryptocurrency unit.</li>
            <li class="list-item"><code>toAccountId</code> is the ID of the Crypticle account to send the funds to.</li>
            <li class="list-item"><code>data</code> is a custom string to add to both the debit and credit transactions which will be created as a result of the transfer.</li>
          </ul>
          <div class="spacer"></div>
          <h5 class="title is-5">Withdrawal</h5>
          <pre class="code-snippet"><code>
    socket.invoke('withdraw', {
      amount: '1100000000',
      toWalletAddress: '6942317426094516776R'
    })
          </code></pre>
          <ul class="list">
            <li class="list-item"><code>amount</code> is the amount of funds to withdraw from your Crypticle account - It is expressed in the smallest possible cryptocurrency unit.</li>
            <li class="list-item"><code>toWalletAddress</code> is the blockchain wallet address to send the funds to.</li>
          </ul>
          <div class="spacer"></div>
          <h5 class="title is-5">Deposit</h5>
          <p>
            To make a deposit, send a blockchain transaction to the deposit address of your Crypticle account (as shown on your console dashboard). The deposit wallet address for your account is shown on your console dashboard.
          </p>
        </div>

        <hr class="hr hr-medium-spacing" />

        <div class="container is-fullhd">
          <h4 class="title is-4">Admin RPCs</h4>
          <h5 class="title is-5">Transfer</h5>
          <pre class="code-snippet"><code>
    socket.invoke('adminTransfer', {
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
          </ul>
          <div class="spacer"></div>
          <h5 class="title is-5">Withdrawal</h5>
          <pre class="code-snippet"><code>
    socket.invoke('adminWithdraw', {
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
          <div class="spacer"></div>
          <h5 class="title is-5">Deposit</h5>
          <p>
            To make a deposit, send a blockchain transaction to the deposit address of the relevant Crypticle account.
          </p>
        </div>
      </div>
    `
  };
}

export default getPageComponent;
