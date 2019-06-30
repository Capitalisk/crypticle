# Crypticle

[![Join the chat at https://gitter.im/crypticle-io/community](https://badges.gitter.im/crypticle-io/community.svg)](https://gitter.im/crypticle-io/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## This project is pre-alpha and is not yet ready for production.

A multi-tenant hot wallet manager and off-chain payment microservice. Crypticle lets users convert value between blockchain tokens and pegged credit which can be efficiently spent and/or transferred between accounts within the context of a centralized service/platform. The credit is entrusted to the service provider and is pegged to the value of the underlying blockchain tokens - This credit can be used to support high-thoughput off-chain transactions (related to a specific service). Any unused credit can be converted back into trustless blockchain tokens at any time.

The goal of this project is to automate the payment and accounting layer for SaaS services and platforms using blockchain technology.
By reducing the friction involved in converting back and forth between trustless blockchain tokens and entrusted credit, users can choose their level of risk exposure when using a paid service from an unfamiliar third-party.

For example, a centralized service could charge a user by the minute (e.g. 1440 times per day, 10080 times per week) but that user may want to pay for it using a single blockchain transaction only once per day or once per week depending on how much they trust the service provider (and how much they want to save on blockchain transaction fees). The user's exposure to risk can be reduced by topping up their service credit/quota more often and in smaller amounts.

Some potential use cases:

- Exchanges
- Marketplaces
- SaaS platforms
- Games

After a Crypticle node has been attached to a specific Blockchain and has started accepting deposits from users, it becomes difficult for a service provider to move away from that blockchain without violating the implicit agreement that they have with their users. Attaching services to a specific blockchain using Crypticle should therefore help to create sustainable demand for the underlying blockchain token.

## Setup

### Software requirements

- Node.js v11.13 or higher: https://nodejs.org/en/
- RethinkDB v2.3 or higher: https://rethinkdb.com/

### Run from source

- `git clone git@github.com:jondubois/crypticle.git`
- `cd crypticle && npm install`
- `cd public && npm install ; cd ..`
- `npm start`

## Deploy and scale on Kubernetes from the command line

The node is designed to be deployed and scaled on Kubernetes.
Transactions are automatically sharded across available nodes.
More info on this coming soon.

- Make sure that you have [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/) and [docker](https://docs.docker.com/install/) installed
- Setup your Kubernetes cluster with multiple nodes on your provider ([Rancher](https://rancher.com/) is recommended) (3 is ideal for testing)
- Get the `Kubeconfig` from your K8s control panel (or cloud provider) and paste it into the `~/.kube/config` file on your local machine
- Install the `crypticle` CLI tool with `npm install -g crypticle`
- Create your project directory with `crypticle create myproject`
- Navigate to your project directory with `cd myproject`
- Upload configs to your K8s cluster using `kubectl create configmap crypticle-config --from-file=blockchains/rise/config.prod.json --from-file=blockchains/rise/config.dev.json` (replace `/rise/` with your blockchain name)
- Upload secrets `SECRET_SIGNUP_KEY`, `AUTH_KEY` and `BLOCKCHAIN_WALLET_PASSPHRASE` to your K8s cluster with `kubectl create secret generic crypticle-secret --from-literal=SECRET_SIGNUP_KEY=313e7cc1-ad75-4030-a927-6a09f39c1603 --from-literal=AUTH_KEY=15d16361-6402-41a5-8840-d2a330b8ea40 --from-literal=BLOCKCHAIN_WALLET_PASSPHRASE="drastic spot aerobic web wave tourist library first scout fatal inherit arrange"`
- If your custom `adapter.js` file has any dependencies, make sure that they are all inside the `blockchains/node_modules/` directory (to allow them to build correctly)
- Use `crypticle deploy` to build your Docker image containing your custom adapter logic and your config files and then deploy it to your K8s cluster

## Scaling on K8s

You can scale any `Deployment` or the RethinkDB `StatefulSet` using standard `kubectl scale ... --replicas=...` commands.
Be very careful when scaling down the RethinkDB `StatefulSet` as this may cause data loss if not done carefully.

## Contributions

This software is distributed under the `AGPL-3.0` license. You are free to use and distribute the code so long as the code which uses or is derived from this project is made public under the same license. If you want to make a contribution to Crypticle then you must grant the Crytpicle project owners the right to use and redistribute your contributed code, content or media under any license. In addition to the main `AGPL-3.0` license, the Crypticle project owners reserve the right to distribute Crypticle (along with contributions made by any third parties) under alternate licenses for commercial purposes.

## Enterprise licenses

If the terms of the `AGPL-3.0` license are not suitable for your use case, please contact a Crypticle project owner to discuss alternative options.
