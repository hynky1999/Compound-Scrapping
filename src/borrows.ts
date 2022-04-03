import { ApolloClient } from '@apollo/client/core'
import 'cross-fetch/polyfill'
import { InMemoryCache } from '@apollo/client/cache'
import { gql } from "@apollo/client/core"

const APIURL = 'https://api.thegraph.com/subgraphs/name/graphprotocol/compound-v2'



class Queue{
  size: number
  queue: Array<any>
  blockNumber: number
  skip: number
  client: any
  query: any
  constructor(client, size, query, blockNumber){
    this.size = size
    this.client = client
    this.query = query
    this.blockNumber = blockNumber
    this.queue = []
    this.skip = 0
  }

  pop(): any{
    if (this.queue.length == 0){
      this.queue = this.getNextQueue()
    }

    const next = this.queue.shift()
    if(next.blockNumber == this.blockNumber){
      this.skip += 1;
    }
    else{
      this.skip = 1
      this.blockNumber = next.blockNumber
    }
    return next
  }

  getNextQueue(): Array<any>{
    client
      .query({
        query: gql(this.query, {first: this.size, skip: this.skip, lastBlock: this.blockNumber }),
      })
      .then((data) => {
        return data.data
      })
      .catch((err) => {
        console.log('Error fetching data: ', err)
      })
    return []
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
`

const client = new ApolloClient({
  uri: APIURL,
  cache: new InMemoryCache(),
})


let borrowQueue = new Queue(client, 1000, borrowQuery, 0)
while(true){
  const borrow = borrowQueue.pop()
  if (borrow == undefined){
    break;
  }
  console.log(borrow)
}

