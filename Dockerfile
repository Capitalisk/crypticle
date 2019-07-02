FROM node:11.13.0-slim

LABEL maintainer="Jonathan Gros-Dubois"
LABEL version="1.0.9"
LABEL description="Docker file for Crypticle."

RUN mkdir -p /usr/src/
WORKDIR /usr/src/
COPY . /usr/src/

WORKDIR /usr/src/blockchains/
RUN npm install .

WORKDIR /usr/src/public/
RUN npm install .

WORKDIR /usr/src/
RUN npm install .

EXPOSE 8000

CMD ["npm", "run", "start:docker"]
