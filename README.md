# Crypticle

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

- Node.js v11.13.0 or higher: https://nodejs.org/en/
- RethinkDB v2.3 or higher: https://rethinkdb.com/

### Run from source

- `git clone git@github.com:jondubois/crypticle.git`
- `cd crypticle && npm install`
- `cd public && npm install ; cd ..`
- `npm start`

Note that by default, your JWT `authKey` will be generated every time you start the node; this will cause your sessions to be lost when you stop the node.
To keep your sessions, launch the node with:

- `ASYNGULAR_OPTIONS='{"authKey": "test"}' npm start`

## Deploying and scaling on Kubernetes

The node is designed to be deployed and scale on Kubernetes.
Transactions are automatically sharded across available nodes.

## Contributions

This software is distributed under the `AGPL-3.0` license. You are free to use and distribute the code so long as the code which uses or is derived from this project is made public under the same license. If you want to make a contribution to Crypticle then you must grant the Crytpicle project owners the right to use and redistribute your contributed code, content or media under any license. In addition to the main `AGPL-3.0` license, the Crypticle project owners reserve the right to distribute Crypticle (along with contributions made by any third parties) under alternate licenses for commercial purposes.

## Enterprise licenses

If the terms of the `AGPL-3.0` license are not suitable for your use case, please contact a Crypticle project owner to discuss alternative options.
