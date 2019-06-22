FROM node:11.13.0-slim

LABEL maintainer="Jonathan Gros-Dubois"
LABEL version="1.1.0"
LABEL description="Docker file for Crypticle."

RUN mkdir -p /usr/src/
WORKDIR /usr/src/
COPY . /usr/src/

RUN npm install .

EXPOSE 8000

CMD ["npm", "run", "start:docker"]
