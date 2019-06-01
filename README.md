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
