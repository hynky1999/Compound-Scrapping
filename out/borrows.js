"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@apollo/client/core");
require("cross-fetch/polyfill");
const cache_1 = require("@apollo/client/cache");
const core_2 = require("@apollo/client/core");
const APIURL = 'https://api.thegraph.com/subgraphs/name/graphprotocol/compound-v2';
class Queue {
    constructor(client, size, query, blockNumber) {
        this.size = size;
        this.client = client;
        this.query = query;
        this.blockNumber = blockNumber;
        this.queue = [];
        this.skip = 0;
    }
    pop() {
        if (this.queue.length == 0) {
            this.queue = this.getNextQueue();
        }
        const next = this.queue.shift();
        if (next.blockNumber == this.blockNumber) {
            this.skip += 1;
        }
        else {
            this.skip = 1;
            this.blockNumber = next.blockNumber;
        }
        return next;
    }
    getNextQueue() {
        client
            .query({
            query: (0, core_2.gql)(this.query, { first: this.size, skip: this.skip, lastBlock: this.blockNumber }),
        })
            .then((data) => {
            return data.data;
        })
            .catch((err) => {
            console.log('Error fetching data: ', err);
        });
        return [];
    }
}
const borrowQuery = `
  query BorrowDetails($lastBlock: Int, $skip: Int, $first: Int) {
    borrowEvents(orderBy: blockTime, first: $first, skip: $skip, where: {blockNumber_gte: $lastBlock}) {
        amount
        borrower
        blockTime
        blockNumber
    }
  }
`;
const client = new core_1.ApolloClient({
    uri: APIURL,
    cache: new cache_1.InMemoryCache(),
});
let borrowQueue = new Queue(client, 1000, borrowQuery, 0);
while (true) {
    const borrow = borrowQueue.pop();
    if (borrow == undefined) {
        break;
    }
    console.log(borrow);
}
//# sourceMappingURL=borrows.js.map