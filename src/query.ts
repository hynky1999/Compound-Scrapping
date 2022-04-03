import { open, FileHandle } from 'fs/promises'
import axios, { AxiosResponse } from 'axios'
import {getPrice, xd} from 'crypto-price'

interface MarketDato {
        total_supply : number; //usd
        total_borrows : number; //usd
        borrow_rate : number;
        supply_rate : number;
        underlying_name : string;
        underlying_symbol : string;
        underlying_price : number;
        underlying_price_usd : number;
        block_timestamp : Date;
        cash: number, //liquidity eth
        collateral_factor: number,
        exchange_rate: number, //invert
        number_of_borrowers: number,
        number_of_suppliers: number,
        reserves: number, //eth
        reserve_factor: number,
        borrow_cap: number | string,
        c_minted: number
}

const ctoken_url = "/ctoken"
const start_date : Date = new Date("1.1.2021")
// const start_date : Date = new Date("2.19.2022")
const end_date : Date = new Date(Date.now())
// const end_date : Date = new Date("1.3.2021")
const baseURL = "https://api.compound.finance/api/v2"


async function saveMarketData(data :Array<MarketDato>): Promise<void> {
    data.sort((firstEl, secondEl) => { return firstEl.block_timestamp < secondEl.block_timestamp ? -1 : 1 } )

    let file : FileHandle
    try{
        file = await open('output.csv', 'a')
        file.truncate()
        const csv_header = 'Date,Name,Symbol,Price(USD),Price(ETH),Supply APY,Borrow APY,Total Supply,Total Borrow,Market Liquidity,# of Suppliers,# of Borrowers,ETH Borrow Cap,Reserves,Reserve Factor,Collateral Factor,cToken Minted,Exchange Rate'
        file.write(csv_header + '\n')
        data.forEach(dato => {
            file.write(`${dato.block_timestamp.toLocaleDateString('en-GB')},${dato.underlying_name},${dato.underlying_symbol},${dato.underlying_price_usd},${dato.underlying_price},${dato.supply_rate},${dato.borrow_rate},${dato.total_supply},${dato.total_borrows},${dato.cash},${dato.number_of_suppliers},${dato.number_of_borrowers},${dato.borrow_cap},${dato.reserves},${dato.reserve_factor},${dato.collateral_factor},${dato.c_minted},${dato.exchange_rate}\n`)
        })
    }
    catch (e){
        console.log(e)
        return;
    }
}

 async function readQueries():  Promise<Array<MarketDato>> {
    let current_date: Date = start_date
    const market_data : Array<MarketDato> = []

    while(current_date <= end_date){
        try{
            const ctokens_response = await axios.get(ctoken_url, {
            baseURL: baseURL,
            params: {
                 block_timestamp: Math.floor(current_date.getTime()/1000),
            }
            })
            const tokens_data : Array<MarketDato> = ctokens_response.data.cToken as Array<MarketDato>
            tokens_data.forEach(element => {
                element.block_timestamp = new Date(current_date)
                for(const name of ['borrow_cap','borrow_rate','cash','collateral_factor','exchange_rate','reserve_factor','reserves', 'supply_rate','total_borrows','total_supply','underlying_price']){
                    element[name] = element[name].value
                }
                market_data.push(element)
            });
        }
        catch(e){
            console.log(e)
            continue;
        }
        console.log(`Fetched from ${current_date.toLocaleDateString()}`)
        current_date.setDate(current_date.getDate() + 1)
    }

    const price_eth = (await axios.get('simple/price', {
        baseURL: 'https://api.coingecko.com/api/v3',
        params: {
            vs_currencies: 'usd',
            ids: 'ethereum',
        }
    })).data.ethereum.usd


    for(const dato of market_data){
        // cMint
        dato['c_minted'] = dato['total_supply']
        // Price
        dato['underlying_price_usd'] = dato['underlying_price'] * price_eth
        // Total Borrow
        dato['total_borrows'] = dato['total_borrows'] * dato['underlying_price_usd']
        // Total Supply
        dato['total_supply'] = dato['cash']*dato['underlying_price_usd'] + dato['total_borrows'] - dato['reserves']*dato['underlying_price_usd']

        // Cap
        dato.borrow_cap = dato.borrow_cap === 0 ? 'No Limit' : dato.borrow_cap
        // Exchange Rate
        dato.exchange_rate = 1/dato.exchange_rate

    }


    return market_data;
}

const main = async () => {
    let data = await readQueries()
    await saveMarketData(data);
}

main()
