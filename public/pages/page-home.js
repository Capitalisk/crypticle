
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
          Coming soon...
        </div>
      </div>
    `
  };
}

export default getPageComponent;
