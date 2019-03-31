
function getPageComponent(pageOptions) {
  let socket = pageOptions.socket;

  return Vue.extend({
    data: function () {
      return {};
    },
    methods: {},
    template: `
      <div class="page-container">
        <h2 class="content-row heading">Dashboard</h2>
        <div class="content-body">
          Coming soon...
        </div>
      </div>
    `
  });
}

export default getPageComponent;
