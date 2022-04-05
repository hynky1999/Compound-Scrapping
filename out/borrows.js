"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@apollo/client/core");
require("cross-fetch/polyfill");
const cache_1 = require("@apollo/client/cache");
const core_2 = require("@apollo/client/core");
const csv_1 = require("csv");
const csv_writer = require("csv-write-stream");
const fs = require("fs");
const APIURL = "https://api.thegraph.com/subgraphs/name/graphprotocol/compound-v2";
class APYS {
    constructor() {
        this.apys = new Map();
    }
    get(token, date) {
        var _a;
        let data = (_a = (this.apys.get(date))) === null || _a === void 0 ? void 0 : _a.get(token);
        if (data == undefined) {
            throw new Error("Not enough data");
        }
        return data;
    }
    load_apy_from_file(filename) {
        return __awaiter(this, void 0, void 0, function* () {
            // Load apy from output.csv using node-csv
            const stream = fs.createReadStream(filename, { encoding: "utf-8" })
                .pipe((0, csv_1.parse)({ delimiter: ",", columns: true }))
                .on("data", (chunk) => {
                let parts = chunk["Date"].split("/");
                const dateNum = new Date(parts[2], parts[1] - 1, parts[0]).getTime();
                let retrieved_data = this.apys.get(dateNum);
                if (retrieved_data == undefined) {
                    retrieved_data = new Map();
                    this.apys.set(dateNum, retrieved_data);
                }
                delete (chunk["Date"]);
                retrieved_data.set(chunk["Symbol"], chunk);
            })
                .on("error", (err) => { console.log(err); });
            yield new Promise(fulfill => stream.on("finish", fulfill));
        });
    }
}
class Borrower {
    constructor(token, borrows, account) {
        this.token = token;
        this.account = account;
        this.borrows = borrows;
    }
    static to_string(account, token) {
        return account + token;
    }
    to_string() {
        return Borrower.to_string(this.account, this.token);
    }
    add_borrow(amount, date) {
        // int to date
        const real_date = new Date(date * 1000);
        const norm_date = new Date(real_date.getFullYear(), real_date.getMonth(), real_date.getDate()).getTime();
        this.borrows.push({ date: norm_date, amount: Number(amount) });
    }
    repay_borrow(amount, date, apys) {
        amount = Number(amount);
        const start_amount = amount;
        const real_date = new Date(date * 1000);
        const norm_date = new Date(real_date.getFullYear(), real_date.getMonth(), real_date.getDate()).getTime();
        let cumulative_apy = 0;
        let start_date = norm_date;
        let end_date = norm_date;
        let data = apys.get(this.token, norm_date);
        if (amount == 0) {
            throw new Error("0 amount");
        }
        let apy = Number(data["Borrow APY"]);
        while (amount > 0) {
            if (this.borrows.length == 0) {
                cumulative_apy += apy * amount;
                break;
            }
            let borrow = this.borrows[0];
            // First run
            if (amount === start_amount) {
                start_date = borrow.date;
            }
            data = apys.get(this.token, borrow.date);
            apy = Number(data["Borrow APY"]);
            const years_between = (norm_date - borrow.date) / (1000 * 60 * 60 * 24 * 365);
            const real_borrow = apy * years_between + borrow.amount;
            if (real_borrow <= amount) {
                amount -= real_borrow;
                cumulative_apy += real_borrow * apy;
                this.borrows.shift();
            }
            else {
                borrow.amount = real_borrow - amount;
                borrow.date = norm_date;
                cumulative_apy += amount * apy;
                amount = 0;
            }
        }
        return { 'apy': cumulative_apy / start_amount, 'start_date': start_date, 'end_date': end_date };
    }
}
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
        return __awaiter(this, void 0, void 0, function* () {
            if (this.queue.length == 0) {
                const new_queue = yield this.getNextQueue();
                if (new_queue.length == 0) {
                    return undefined;
                }
                this.queue = new_queue;
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
        });
    }
    peek() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.queue.length == 0) {
                const new_queue = yield this.getNextQueue();
                if (new_queue.length == 0) {
                    return undefined;
                }
                this.queue = new_queue;
            }
            return this.queue[0];
        });
    }
    getNextQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            const vars = {
                first: this.size,
                skip: this.skip,
                lastBlock: this.blockNumber,
            };
            try {
                const data = yield this.client.query({
                    query: this.query,
                    variables: vars,
                });
                const arr = data.data[Object.keys(data.data)[0]];
                return [...arr];
            }
            catch (err) {
                console.log("Error fetching data: ", err);
            }
            return [];
        });
    }
}
class EventQueue {
    constructor(queues) {
        this.queues = queues;
    }
    pop() {
        return __awaiter(this, void 0, void 0, function* () {
            const peeks = yield Promise.all(this.queues.map((q) => __awaiter(this, void 0, void 0, function* () { var _a, _b; return (_b = ((_a = (yield q.peek())) === null || _a === void 0 ? void 0 : _a.blockNumber)) !== null && _b !== void 0 ? _b : Infinity; })));
            // If all peak are Infinity, then we have no more events
            if (peeks.every((p) => p == Infinity)) {
                return undefined;
            }
            const min = Math.min(...peeks);
            const min_index = peeks.indexOf(min);
            return this.queues[min_index].pop();
        });
    }
}
const borrowQuery = (0, core_2.gql) `
  query ($lastBlock: Int, $skip: Int, $first: Int) {
    borrowEvents(
      orderBy: blockTime
      first: $first
      skip: $skip
      where: { blockNumber_gte: $lastBlock }
    ) {
      amount
      underlyingSymbol
      borrower
      blockTime
      blockNumber
    }
  }
`;
const repayQuery = (0, core_2.gql) `
  query ($lastBlock: Int, $skip: Int, $first: Int) {
    repayEvents(
      orderBy: blockTime
      first: $first
      skip: $skip
      where: { blockNumber_gte: $lastBlock }
    ) {
      amount
      borrower
      underlyingSymbol
      blockTime
      blockNumber
    }
  }
`;
const liquidationQuery = (0, core_2.gql) `
  query ($lastBlock: Int, $skip: Int, $first: Int) {
    liquidationEvents(
      orderBy: blockTime
      first: $first
      skip: $skip
      where: { blockNumber_gte: $lastBlock }
    ) {
      amount
      from
      underlyingSymbol
      underlyingRepayAmount
      blockTime
      blockNumber
    }
  }
`;
const client = new core_1.ApolloClient({
    uri: APIURL,
    cache: new cache_1.InMemoryCache(),
});
function write_to_stream(stream, { data, amount, apy, start_date, end_date }, event) {
    start_date = new Date(start_date).toLocaleDateString('en-GB');
    end_date = new Date(end_date).toLocaleDateString('en-GB');
    const price_usd = Number(data["Price(USD)"]);
    const price_eth = Number(data["Price(ETH)"]);
    stream.write([
        event,
        start_date,
        amount,
        amount * price_usd,
        amount * price_eth,
        apy,
        end_date,
        data["Name"],
        data["Symbol"],
        data["Price(USD)"],
        data["Price(ETH)"],
        data["Supply APY"],
        data["Borrow APY"],
        data["Total Supply"],
        data["Total Borrow"],
        data["Market Liquidity"],
        data["# of Suppliers"],
        data["# of Borrowers"],
        data["ETH Borrow Cap"],
        data["Reserves"],
        data["Reserve Factor"],
        data["Collateral Factor"],
        data["cToken Minted"],
        data["Exchange Rate"]
    ]);
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const borrowers = new Map();
        let event;
        const apys = new APYS();
        for (const quotes_file of quotes_files) {
            yield apys.load_apy_from_file(quotes_file);
        }
        const writableStream = csv_writer({ headers: [
                "Event",
                "Start date",
                "Amount Paid",
                "Amount Paid (USD)",
                "Amount Paid (ETH)",
                "Cumulative APY",
                "End Date",
                "Name",
                "Symbol",
                "Price(USD)",
                "Price(ETH)",
                "Supply APY",
                "Borrow APY",
                "Total Supply",
                "Total Borrow",
                "Market Liquidity",
                "# of Suppliers",
                "# of Borrowers",
                "ETH Borrow Cap",
                "Reserves",
                "Reserve Factor",
                "Collateral Factor",
                "cToken Minted",
                "Exchange Rate"
            ] });
        writableStream.pipe(fs.createWriteStream('output-borrow.csv', { flags: 'w' }));
        while ((event = yield eventQueue.pop()) != undefined && event.blockTime <= lastBlockTime) {
            console.log(new Date(event.blockTime * 1000).toLocaleString('en-GB'));
            if (event.__typename == 'BorrowEvent') {
                let borrower = borrowers.get(Borrower.to_string(event.borrower, event.underlyingSymbol));
                if (borrower == undefined) {
                    borrower = new Borrower(event.underlyingSymbol, [], event.borrower);
                    borrowers.set(borrower.to_string(), borrower);
                }
                borrower.add_borrow(event.amount, event.blockTime);
            }
            if (event.__typename == 'RepayEvent' || event.__typename == 'LiquidationEvent') {
                const event_name = event.__typename == 'RepayEvent' ? event.borrower : event.from;
                let borrower = borrowers.get(Borrower.to_string(event_name, event.underlyingSymbol));
                if (borrower == undefined) {
                    console.log(`No borrower found for ${event.__typename}`);
                    continue;
                }
                try {
                    const { apy, start_date, end_date } = borrower.repay_borrow(event.amount, event.blockTime, apys);
                    const data = apys.get(event.underlyingSymbol, end_date);
                    const event_name = event.__typename == 'RepayEvent' ? 'Repay' : 'Liquidation';
                    if (event.blockTime >= firstBlockTime) {
                        write_to_stream(writableStream, { data: data, amount: event.amount, apy: apy, start_date: start_date, end_date: end_date }, event_name);
                    }
                }
                catch (err) {
                    console.log(err);
                    continue;
                }
            }
        }
    });
}
const firstBlock = 0;
const firstBlockTime = new Date("2021-01-01").getTime() / 1000;
const lastBlockTime = new Date("2022-02-19").getTime() / 1000;
const quotes_files = ["output.csv", "output2.csv"];
let borrowQueue = new Queue(client, 1000, borrowQuery, firstBlock);
let repayQueue = new Queue(client, 1000, repayQuery, firstBlock);
let liquidationQueue = new Queue(client, 1000, liquidationQuery, firstBlock);
// Order is important
let eventQueue = new EventQueue([borrowQueue, repayQueue, liquidationQueue]);
run();
//# sourceMappingURL=borrows.js.map