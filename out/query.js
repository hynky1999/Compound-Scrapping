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
const promises_1 = require("fs/promises");
const axios_1 = require("axios");
const ctoken_url = "/ctoken";
const start_date = new Date("1.1.2019");
// const start_date : Date = new Date("2.19.2022")
const end_date = new Date(Date.now());
// const end_date : Date = new Date("1.3.2021")
const baseURL = "https://api.compound.finance/api/v2";
function saveMarketData(data) {
    return __awaiter(this, void 0, void 0, function* () {
        data.sort((firstEl, secondEl) => { return firstEl.block_timestamp < secondEl.block_timestamp ? -1 : 1; });
        let file;
        try {
            file = yield (0, promises_1.open)('output2.csv', 'a');
            file.truncate();
            const csv_header = 'Date,Name,Symbol,Price(USD),Price(ETH),Supply APY,Borrow APY,Total Supply,Total Borrow,Market Liquidity,# of Suppliers,# of Borrowers,ETH Borrow Cap,Reserves,Reserve Factor,Collateral Factor,cToken Minted,Exchange Rate';
            file.write(csv_header + '\n');
            data.forEach(dato => {
                file.write(`${dato.block_timestamp.toLocaleDateString('en-GB')},${dato.underlying_name},${dato.underlying_symbol},${dato.underlying_price_usd},${dato.underlying_price},${dato.supply_rate},${dato.borrow_rate},${dato.total_supply},${dato.total_borrows},${dato.cash},${dato.number_of_suppliers},${dato.number_of_borrowers},${dato.borrow_cap},${dato.reserves},${dato.reserve_factor},${dato.collateral_factor},${dato.c_minted},${dato.exchange_rate}\n`);
            });
        }
        catch (e) {
            console.log(e);
            return;
        }
    });
}
function readQueries() {
    return __awaiter(this, void 0, void 0, function* () {
        let current_date = start_date;
        const market_data = [];
        while (current_date <= end_date) {
            try {
                const ctokens_response = yield axios_1.default.get(ctoken_url, {
                    baseURL: baseURL,
                    params: {
                        block_timestamp: Math.floor(current_date.getTime() / 1000),
                    }
                });
                const tokens_data = ctokens_response.data.cToken;
                tokens_data.forEach(element => {
                    element.block_timestamp = new Date(current_date);
                    for (const name of ['borrow_cap', 'borrow_rate', 'cash', 'collateral_factor', 'exchange_rate', 'reserve_factor', 'reserves', 'supply_rate', 'total_borrows', 'total_supply', 'underlying_price']) {
                        element[name] = element[name].value;
                    }
                    market_data.push(element);
                });
            }
            catch (e) {
                console.log(e);
                // Wait for 1 second
                yield new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            console.log(`Fetched from ${current_date.toLocaleDateString()}`);
            current_date.setDate(current_date.getDate() + 1);
        }
        const price_eth = (yield axios_1.default.get('simple/price', {
            baseURL: 'https://api.coingecko.com/api/v3',
            params: {
                vs_currencies: 'usd',
                ids: 'ethereum',
            }
        })).data.ethereum.usd;
        for (const dato of market_data) {
            // cMint
            dato['c_minted'] = dato['total_supply'];
            // Price
            dato['underlying_price_usd'] = dato['underlying_price'] * price_eth;
            // Total Borrow
            dato['total_borrows'] = dato['total_borrows'] * dato['underlying_price_usd'];
            // Total Supply
            dato['total_supply'] = dato['cash'] * dato['underlying_price_usd'] + dato['total_borrows'] - dato['reserves'] * dato['underlying_price_usd'];
            // Cap
            dato.borrow_cap = dato.borrow_cap === 0 ? 'No Limit' : dato.borrow_cap;
            // Exchange Rate
            dato.exchange_rate = 1 / dato.exchange_rate;
        }
        return market_data;
    });
}
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    let data = yield readQueries();
    yield saveMarketData(data);
});
main();
//# sourceMappingURL=query.js.map