# Meme API Documentation

## Authentication

Endpoints that require authentication are marked `AUTH REQUIRED`. Pass the following fields in the HTTP headers:

| Header | Description | Required when |
|---|---|---|
| `meme-api-key` | Your assigned API Key | All `AUTH REQUIRED` endpoints |
| `meme-api-timestamp` | Current Unix timestamp in milliseconds | `POST` / `PUT` endpoints |
| `meme-api-secret` | Base64-encoded RSA signature of `requestBody + timestamp` | `POST` / `PUT` endpoints |

- `GET` requests only validate that `meme-api-key` is valid.
- `POST` / `PUT` requests validate the signature, and the timestamp must be within 90 seconds of server time.

---

## Public Endpoints

### Get Token Info

Query basic token information by contract address or token ID.

`GET https://four.meme/meme-api/api/v1/public/token`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `address` | string | No | Token contract address. |
| `tokenId` | integer | No | Token ID. If both `address` and `tokenId` are provided, `tokenId` takes priority. |
| `networkCode` | integer | No | Network code. Defaults to `56` (BSC). |

> At least one of `address` or `tokenId` must be provided.

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": {
    "id": 12345,
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "name": "My Awesome Token",
    "shortName": "MBT",
    "symbol": "BNB",
    "totalAmount": 1000000000,
    "saleAmount": 500000000,
    "b0": 100,
    "t0": 0.0001,
    "launchTime": 1672531200000,
    "endTime": 1675209600000,
    "minBuy": 1000,
    "maxBuy": 1000000,
    "userAddress": "0xcreatoraddress...",
    "version": 9,
    "status": 1,
    "reserveAmount": 10000000,
    "raisedAmount": 50,
    "networkCode": "BSC",
    "createDate": "2023-01-01T00:00:00Z"
  }
}
```

#### Response Fields (`data` object)

| Field | Type | Description |
|---|---|---|
| `id` | integer | Unique token ID. |
| `address` | string | Token contract address. |
| `name` | string | Full token name. |
| `shortName` | string | Short name or ticker. |
| `symbol` | string | Quote currency symbol (e.g. BNB). |
| `totalAmount` | number | Total token supply. |
| `saleAmount` | number | Amount of tokens available for sale. |
| `b0` | number | Initial liquidity provided. |
| `t0` | number | Initial price. |
| `launchTime` | integer | Launch timestamp (milliseconds). |
| `endTime` | integer | Sale end timestamp (milliseconds). |
| `minBuy` | number | Minimum purchase amount. |
| `maxBuy` | number | Maximum purchase amount. |
| `userAddress` | string | Token creator address. |
| `version` | integer | Contract version. |
| `status` | integer | Current token status. |
| `reserveAmount` | number | Reserved token amount. |
| `raisedAmount` | number | Amount of funds raised. |
| `networkCode` | string | Network code (e.g. "BSC"). |
| `createDate` | string | Creation date and time (ISO 8601). |


---

### Get Token Detail

Query detailed token information, including social links and description.

`GET https://four.meme/meme-api/api/v1/public/token/detail`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `address` | string | No | Token contract address. |
| `tokenId` | integer | No | Token ID. If both `address` and `tokenId` are provided, `tokenId` takes priority. |
| `networkCode` | integer | No | Network code. Defaults to `56` (BSC). |

> At least one of `address` or `tokenId` must be provided.

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": {
    "id": 12345,
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "image": "https://example.com/token_image.png",
    "descr": "An awesome token for a great project.",
    "webUrl": "https://example.com",
    "telegramUrl": "https://t.me/example",
    "twitterUrl": "https://twitter.com/example"
  }
}
```

#### Response Fields (`data` object)

| Field | Type | Description |
|---|---|---|
| `id` | integer | Unique token ID. |
| `address` | string | Token contract address. |
| `image` | string | URL of the token image/logo. |
| `descr` | string | Short token description. |
| `webUrl` | string | Official website URL. |
| `telegramUrl` | string | Official Telegram group URL. |
| `twitterUrl` | string | Official Twitter profile URL. |

---

### Get Token Ticker

Query real-time price and market data for a token.

`GET https://four.meme/meme-api/api/v1/public/token/ticker`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tokenId` | integer | Yes | Token ID. |
| `address` | string | No | Token contract address. |
| `networkCode` | integer | No | Network code. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": {
    "id": 12345,
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "price": 0.000123,
    "progress": 75.5,
    "bnbAmount": 50.12,
    "marketCap": 123000,
    "trading": 50000,
    "dayTrading": 12000,
    "status": 1,
    "liquidity": 80000,
    "networkCode": 56,
    "tradingUsd": 50000,
    "holderCount": 1500
  }
}
```

#### Response Fields (`data` object)

| Field | Type | Description |
|---|---|---|
| `id` | integer | Unique token ID. |
| `address` | string | Token contract address. |
| `price` | number | Current token price. |
| `progress` | number | Sale progress percentage. |
| `bnbAmount` | number | Total BNB raised. |
| `marketCap` | number | Current market cap. |
| `trading` | number | Total trading volume. |
| `dayTrading` | number | 24-hour trading volume. |
| `status` | integer | Current token status. |
| `liquidity` | number | Total liquidity in the pool. |
| `networkCode` | integer | Network code. |
| `tradingUsd` | number | Trading volume in USD. |
| `holderCount` | integer | Number of unique holders. |

---

### Get Token Tax Info

Query tax and fee structure for a specific token.

`GET https://four.meme/meme-api/api/v1/public/token/token_tax`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tokenId` | integer | Yes | Token ID. |
| `address` | string | No | Token contract address. |
| `networkCode` | integer | No | Network code. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": {
    "id": 12345,
    "feeRate": 5,
    "recipientRate": 10,
    "burnRate": 20,
    "divideRate": 30,
    "liquidityRate": 40,
    "recipientAddress": "0xrecipientaddress...",
    "minSharing": 100000,
    "lastFeeDispatchTime": "2023-03-15T12:00:00Z",
    "feeBurn": 500000
  }
}
```

#### Response Fields (`data` object)

| Field | Type | Description |
|---|---|---|
| `id` | integer | Unique token ID. |
| `feeRate` | number | Base trading fee rate (%). |
| `recipientRate` | number | Percentage of fees allocated to a specific recipient (%). |
| `burnRate` | number | Percentage of fees to burn (%). |
| `divideRate` | number | Percentage of fees distributed as dividends (%). |
| `liquidityRate` | number | Percentage of fees added to the liquidity pool (%). |
| `recipientAddress` | string | Address that receives a portion of fees. |
| `minSharing` | number | Minimum token balance required to receive dividends. |
| `lastFeeDispatchTime` | string | Time of the last dividend fee dispatch (ISO 8601). |
| `feeBurn` | number | Total tokens burned from fees. |

---

### Get Token Pair Info

Query the liquidity pair address for a token.

`GET https://four.meme/meme-api/api/v1/public/token/pair`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tokenId` | integer | Yes | Token ID. |
| `address` | string | No | Token contract address. |
| `networkCode` | integer | No | Network code. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": {
    "pairAddress": "0xpairaddress...",
    "factoryVersion": 2
  }
}
```

#### Response Fields (`data` object)

| Field | Type | Description |
|---|---|---|
| `pairAddress` | string | Address of the liquidity pair contract. |
| `factoryVersion` | integer | Version of the DEX factory used to create the pair. |

---

### Get Token Holders

Query the list of token holders.

`GET https://four.meme/meme-api/api/v1/public/token/holder`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tokenId` | integer | No | Token ID. |
| `address` | string | No | Token contract address. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": {
    "reserve": {
      "userName": "Reserve Wallet",
      "address": "0xreserveaddress...",
      "amount": 10000000
    },
    "lp": {
      "userName": "Liquidity Pool",
      "address": "0xlppooladdress...",
      "amount": 50000000
    },
    "clickFun": {
      "userName": "ClickFun Wallet",
      "address": "0xclickfunaddress...",
      "amount": 2000000
    },
    "tokenHolders": [
      {
        "userName": "Alice",
        "address": "0xaliceaddress...",
        "amount": 150000
      },
      {
        "userName": "Bob",
        "address": "0xbobaddress...",
        "amount": 120000
      }
    ]
  }
}
```

#### Response Fields (`data` object)

| Field | Type | Description |
|---|---|---|
| `reserve` | object | Reserve wallet info. See `TokenHolder` structure. |
| `lp` | object | Liquidity pool wallet info. See `TokenHolder` structure. |
| `clickFun` | object | ClickFun wallet info. See `TokenHolder` structure. |
| `tokenHolders` | array | List of top token holders. See `TokenHolder` structure. |

#### `TokenHolder` Structure

| Field | Type | Description |
|---|---|---|
| `userName` | string | Holder name. |
| `address` | string | Holder wallet address. |
| `amount` | number | Amount of tokens held. |

---

### Get Hidden Tokens

Query the list of tokens hidden from public view.

`GET https://four.meme/meme-api/api/v1/public/token/hide`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `starIndex` | integer | No | Pagination start index. Defaults to `0`. |
| `pageSize` | integer | No | Number of items per page. Max `10000`. Defaults to `500`. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": {
    "address": [
      "0xhiddenaddress1...",
      "0xhiddenaddress2..."
    ],
    "nextStarIndex": 500,
    "finished": false
  }
}
```

#### Response Fields (`data` object)

| Field | Type | Description |
|---|---|---|
| `address` | array | List of hidden token contract addresses. |
| `nextStarIndex` | integer | `starIndex` to use for the next page. |
| `finished` | boolean | `true` if this is the last page. |

---

### Get Platform Config

Query platform-level configuration and settings.

`GET https://four.meme/meme-api/api/v1/public/config`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `platform` | string | Yes | Platform type. Enum: `MEME`, `PANCAKE`. |
| `networkCode` | string | Yes | Network code. Enum: `BSC`, `ETH`, `SOLANA`, `ARBI_ONE`, `GOERLI`, `TON`, `BASE`, `OP_BNB`. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": [
    {
      "symbol": "BNB",
      "nativeSymbol": "BNB",
      "symbolAddress": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      "deployCost": 0.1,
      "buyFee": 1,
      "sellFee": 1,
      "minTradeFee": 0.001,
      "b0Amount": 10,
      "totalBAmount": 1000,
      "totalAmount": 1000000000,
      "logoUrl": "https://example.com/bnb_logo.png",
      "tradeLevel": [10, 50, 100],
      "status": "ACTIVE",
      "buyTokenLink": "https://pancakeswap.finance/swap?outputCurrency=...",
      "reservedNumber": 4,
      "saleRate": 50,
      "networkCode": "BSC",
      "platform": "MEME"
    }
  ]
}
```

#### Response Fields (`data` array item)

| Field | Type | Description |
|---|---|---|
| `symbol` | string | Currency symbol. |
| `nativeSymbol` | string | Display symbol. |
| `symbolAddress` | string | Currency contract address. |
| `deployCost` | number | Cost to deploy a new token. |
| `buyFee` | number | Buy trade fee (%). |
| `sellFee` | number | Sell trade fee (%). |
| `minTradeFee` | number | Minimum trade fee. |
| `b0Amount` | number | Default initial liquidity. |
| `totalBAmount` | number | Default total fundraising target. |
| `totalAmount` | number | Default total token supply. |
| `logoUrl` | string | Currency logo URL. |
| `tradeLevel` | array | Predefined trade amount levels. |
| `status` | string | Config status. Enum: `ACTIVE`, `INACTIVE`. |
| `buyTokenLink` | string | Link to buy the token. |
| `reservedNumber` | integer | Reserved decimal places for display. |
| `saleRate` | number | Sale percentage of total supply. |
| `networkCode` | string | Network code. |
| `platform` | string | Platform code. |

---

### Get Contract Addresses

Query the list of core contract addresses for a given network.

`GET https://four.meme/meme-api/api/v1/public/address`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `networkCode` | string | Yes | Network code. Enum: `BSC`, `ETH`, `SOLANA`, `ARBI_ONE`, `GOERLI`, `TON`, `BASE`, `OP_BNB`. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": [
    {
      "name": "TokenManager",
      "address": "0xmanageraddress...",
      "networkCode": "BSC",
      "network": 56
    },
    {
      "name": "Factory",
      "address": "0xfactoryaddress...",
      "networkCode": "BSC",
      "network": 56
    }
  ]
}
```

#### Response Fields (`data` array item)

| Field | Type | Description |
|---|---|---|
| `name` | string | Contract name. |
| `address` | string | Contract address. |
| `networkCode` | string | Network code (e.g. "BSC"). |
| `network` | integer | Network ID (e.g. 56 for BSC). |

---

### Get Trade Fills

Query recent trade fills for a token.

`GET https://four.meme/meme-api/api/v1/public/token/fill`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tokenId` | integer | Yes | Token ID. |
| `networkCode` | string | No | Network code. Defaults to `BSC`. |
| `address` | string | No | Filter trades by a specific user address. |
| `symbol` | string | No | Quote currency symbol. |
| `symbolAddress` | string | No | Quote currency address. |
| `endDate` | integer | No | End timestamp for the query (milliseconds). |
| `pageIndex` | integer | No | Page number. Defaults to `1`. |
| `pageSize` | integer | No | Items per page. Defaults to `30`. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": [
    {
      "userAddress": "0xbuyeraddress...",
      "userName": "CryptoKing",
      "userId": 9876,
      "avatarPath": "https://example.com/avatar.png",
      "symbol": "BNB",
      "side": "BUY",
      "txHash": "0xtransactionhash...",
      "price": 0.000124,
      "amount": 10000,
      "volume": 1.24,
      "createDate": "2023-03-15T12:05:00Z",
      "tokenId": 12345
    }
  ]
}
```

#### Response Fields (`data` array item)

| Field | Type | Description |
|---|---|---|
| `userAddress` | string | Trader wallet address. |
| `userName` | string | Trader username. |
| `userId` | integer | Trader user ID. |
| `avatarPath` | string | Trader avatar URL. |
| `symbol` | string | Quote currency symbol. |
| `side` | string | Trade side. Enum: `BUY`, `SELL`. |
| `txHash` | string | Transaction hash. |
| `price` | number | Execution price. |
| `amount` | number | Amount of tokens traded. |
| `volume` | number | Total trade value in quote currency. |
| `createDate` | string | Trade timestamp (ISO 8601). |
| `tokenId` | integer | ID of the traded token. |

---

### Get User Presale Subscription Info

Query a user's subscription and allocation details for a token presale.

`GET https://four.meme/meme-api/api/v1/public/presale/user`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `userAddress` | string | Yes | User wallet address. |
| `tokenId` | integer | Yes | Presale token ID. |
| `isRwa` | boolean | No | Whether the token is an RWA type. Defaults to `false`. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": {
    "subscribedAmount": 1.5,
    "refundAmount": 0,
    "airdropAmount": 1000,
    "orderFillAmount": 0,
    "uploadSignature": true,
    "subscribedAmountSub": 0,
    "refundAmountSub": 0,
    "refundStatus": "SUCCESS",
    "refundTxHash": "0xrefundhash...",
    "airdropStatus": "SUCCESS",
    "airdropTxHash": "0xairdrophash...",
    "pointsEligible": true,
    "allocateAmount": 15000,
    "allocateAmountSub": 0
  }
}
```

#### Response Fields (`data` object)

| Field | Type | Description |
|---|---|---|
| `subscribedAmount` | number | Amount the user has subscribed (in quote currency). |
| `refundAmount` | number | Amount refunded to the user. |
| `airdropAmount` | number | Amount of tokens airdropped to the user. |
| `orderFillAmount` | number | Sell-order fill amount. |
| `uploadSignature` | boolean | `true` if the user has uploaded a signature. |
| `subscribedAmountSub` | number | Subscription amount for the secondary token. |
| `refundAmountSub` | number | Refund amount for the secondary token. |
| `refundStatus` | string | Refund status. Enum: `INIT`, `PENDING`, `SUCCESS`, `FAIL`. |
| `refundTxHash` | string | Refund transaction hash. |
| `airdropStatus` | string | Airdrop status. Enum: `INIT`, `PENDING`, `SUCCESS`, `FAIL`. |
| `airdropTxHash` | string | Airdrop transaction hash. |
| `pointsEligible` | boolean | `true` if the user meets the points requirement. |
| `allocateAmount` | number | Final allocation of the primary token. |
| `allocateAmountSub` | number | Final allocation of the secondary token. |

---

### Get Token Presale Info

Query details of a token presale campaign.

`GET https://four.meme/meme-api/api/v1/public/token/presale`

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `userAddress` | string | Yes | User wallet address. |
| `tokenId` | integer | Yes | Presale token ID. |
| `isRwa` | boolean | No | Whether the token is an RWA type. Defaults to `false`. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": {
    "id": 12345,
    "address": "0xpresalecontractaddress...",
    "symbol": "USDT",
    "ruleDetail": "Presale rules and details go here.",
    "tokenName": "Awesome Presale Token",
    "tokenTicker": "APT",
    "desc": "Description of the presale token.",
    "banner": "https://example.com/banner.png",
    "image": "https://example.com/image.png",
    "webUrl": "https://example.com",
    "telegramUrl": "https://t.me/example",
    "twitterUrl": "https://twitter.com/example",
    "discord": "https://discord.gg/example",
    "totalSupply": 1000000000,
    "presaleAmount": 200000000,
    "liquidityAmount": 100000000,
    "raiseAmount": 500,
    "minBuy": 0.1,
    "maxBuy": 5,
    "saleStartTime": 1672531200000,
    "saleEndTime": 1675209600000,
    "dexTime": 1675296000000,
    "subscribedAmount": 350.5,
    "subscribedCount": 250,
    "subscribedUserCount": 180,
    "status": "ACTIVE",
    "timeLimit": 3600,
    "buyLimit": 5,
    "price0": 0.0001,
    "maxPrice": 0.0005,
    "alphaPoint": 100,
    "pointsCost": 10,
    "k1": 1.1,
    "k2": 1.2,
    "k3": 1.3,
    "allocateAmount": 200000000,
    "isTest": false,
    "type": "STANDARD"
  }
}
```

#### Response Fields (`data` object)

| Field | Type | Description |
|---|---|---|
| `id` | integer | Presale/token ID. |
| `address` | string | Presale contract address. |
| `symbol` | string | Currency used for the presale (e.g. USDT). |
| `ruleDetail` | string | Detailed presale rules. |
| `tokenName` | string | Name of the token for sale. |
| `tokenTicker` | string | Ticker of the token for sale. |
| `desc` | string | Token/project description. |
| `banner` | string | Presale banner image URL. |
| `image` | string | Token image URL. |
| `webUrl`, `telegramUrl`, `twitterUrl`, `discord` | string | Social and website links. |
| `totalSupply` | number | Total token supply. |
| `presaleAmount` | number | Tokens available in the presale. |
| `liquidityAmount` | number | Tokens to be added to liquidity. |
| `raiseAmount` | number | Fundraising target (in quote currency). |
| `minBuy` | number | Minimum purchase amount per user. |
| `maxBuy` | number | Maximum purchase amount per user. |
| `saleStartTime`, `saleEndTime`, `dexTime` | integer | Timestamps for presale start, end, and DEX listing (milliseconds). |
| `subscribedAmount` | number | Total amount subscribed so far. |
| `subscribedCount` | integer | Total number of subscription transactions. |
| `subscribedUserCount` | integer | Total number of unique subscribers. |
| `status` | string | Current presale status. |
| `timeLimit` | integer | Time limit for the purchase cap. |
| `buyLimit` | number | Purchase limit within the time limit. |
| `price0` | number | Initial price. |
| `maxPrice` | number | Maximum possible price. |
| `alphaPoint`, `pointsCost`, `k1`, `k2`, `k3` | number/integer | Parameters related to points and allocation calculations. |
| `allocateAmount` | number | Total tokens to be allocated. |
| `isTest` | boolean | `true` if this is a test presale. |
| `type` | string | Presale type. |

---

## Public POST Endpoints

### Get K-line (Bar) Data

Query candlestick (K-line) data for a token price chart.

`POST https://four.meme/meme-api/api/v1/public/token/bar`

> **Note:** Parameters for this endpoint must be sent as **query parameters**, not in the request body.

#### Request Parameters (Query Parameters)

| Parameter | Type | Required | Description |
|---|---|---|---|
| `type` | string | Yes | K-line interval. Enum: `MIN1`, `MIN5`, `MIN15`, `MIN30`, `HOUR1`, `HOUR4`, `DAY1`. |
| `tokenId` | integer | Yes | Token ID. |
| `dex` | integer | Yes | Data source. `0` for internal, `1` for DEX. |
| `category` | string | No | Price quote currency. Enum: `USDT`, `ORIGN`. |
| `networkCode` | string | No | Network code. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": [
    {
      "id": 123456,
      "open": 0.000123,
      "high": 0.000125,
      "low": 0.000122,
      "close": 0.000124,
      "volume": 5000,
      "amount": 620,
      "tokenId": 12345,
      "type": "MIN5",
      "createDate": "2023-03-15T12:05:00Z"
    }
  ]
}
```

#### Response Fields (`data` array item)

| Field | Type | Description |
|---|---|---|
| `id` | integer | Unique K-line ID. |
| `open` | number | Open price. |
| `high` | number | High price. |
| `low` | number | Low price. |
| `close` | number | Close price. |
| `volume` | number | Volume in quote currency. |
| `amount` | number | Volume in base currency (token). |
| `tokenId` | integer | Token ID. |
| `type` | string | K-line interval. |
| `createDate` | string | K-line start time (ISO 8601). |

---

### Get Ranking

Query the token ranking board with various filters.

`POST https://four.meme/meme-api/api/v1/public/token/ranking`

#### Request Body

```json
{
  "type": "HOT",
  "rankingKind": "MarketCapUSD1",
  "version": "V9",
  "symbol": "BNB",
  "minCap": 100000,
  "maxVol": 5000000,
  "pageSize": 20
}
```

#### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | Yes | Primary ranking type. Enum: `HOT`, `NEW`, `GAIN`, `VOLUME`. |
| `rankingKind` | string | No | Sub-ranking type. Enum: `MarketCapUSD1`, `BINANCE`. |
| `version` | string | No | Filter by token version. Enum: `NOR`, `V9`, `V10`. |
| `symbol` | string | No | Filter by currency symbol (e.g. `BNB`). |
| `minCap` / `maxCap` | number | No | Filter by min/max market cap. |
| `minVol` / `maxVol` | number | No | Filter by min/max volume. |
| `minHold` / `maxHold` | number | No | Filter by min/max holder count. |
| `pageSize` | integer | No | Number of results to return. Defaults to `20`. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": [
    {
      "tokenId": 12345,
      "name": "Awesome Token",
      "shortName": "MBT",
      "descr": "An awesome token",
      "userAddress": "0xcreatoraddress...",
      "symbol": "BNB",
      "tokenAddress": "0xtokenaddress...",
      "progress": 75.5,
      "price": 0.000124,
      "cap": 124000,
      "capUSDT": 124000,
      "hold": 1500,
      "img": "https://example.com/token.png",
      "tag": "Meme",
      "increase": 15.5,
      "min5Increase": 2.1,
      "min30Increase": 5.3,
      "hourIncrease": 8.7,
      "hour4Increase": 12.0,
      "day1Increase": 15.5,
      "volume": 50000,
      "day1Vol": 12000,
      "day1VolUSDT": 50000,
      "taxFee": 5,
      "createDate": "2023-03-15T12:00:00Z",
      "networkCode": 56,
      "version": 9,
      "status": "TRADE",
      "showStatus": "SHOW",
      "rank": 1,
      "score": "95.5",
      "spaceId": "myspace",
      "feeBurn": 500000
    }
  ]
}
```

---

### Search Tokens

Search tokens by keyword and other filters.

`POST https://four.meme/meme-api/api/v1/public/token/search`

#### Request Body

```json
{
  "keyword": "Doge",
  "pageIndex": 1,
  "pageSize": 20,
  "type": "HOT",
  "listType": "NOR",
  "tag": ["Meme"],
  "status": "ALL",
  "sort": "DESC"
}
```

#### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `keyword` | string | No | Search keyword. |
| `pageIndex` | integer | No | Page number. Defaults to `1`. Max `100`. |
| `pageSize` | integer | No | Results per page. Defaults to `30`. Max `500`. |
| `type` | string | No | Ranking type. Enum: `HOT`, `NEW`, `GAIN`, `VOLUME`. |
| `listType` | string | No | List type. Enum: `NOR`, `ADV`, `USD1`, `USD1_DEX`, `BIN`, `BIN_DEX`. |
| `symbol` | string | No | Filter by currency symbol. |
| `tag` | array | No | Filter by tags (e.g. `["AI", "Game"]`). |
| `status` | string | No | Filter by token status. Enum: `PUBLISH`, `TRADE`, `ALL`. Defaults to `ALL`. |
| `sort` | string | No | Sort direction. Enum: `ASC`, `DESC`. Defaults to `DESC`. |
| `version` | string | No | Filter by token version. Enum: `NOR`, `V9`, `V10`. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": [
    {
      "tokenId": 54321,
      "name": "Doge Killer",
      "shortName": "DOGEK",
      "descr": "Doge Killer token description",
      "userAddress": "0xcreatoraddress...",
      "symbol": "BNB",
      "tokenAddress": "0xtokenaddress...",
      "progress": 100,
      "price": 0.0000123,
      "cap": 1230000,
      "capUSDT": 1230000,
      "hold": 5400,
      "img": "https://example.com/dogek.png",
      "tag": "Meme",
      "increase": 25.1,
      "min5Increase": 3.2,
      "min30Increase": 8.5,
      "hourIncrease": 12.3,
      "hour4Increase": 18.7,
      "day1Increase": 25.1,
      "volume": 150000,
      "day1Vol": 35000,
      "day1VolUSDT": 150000,
      "taxFee": 3,
      "createDate": "2023-03-10T08:00:00Z",
      "networkCode": 56,
      "version": 9,
      "status": "TRADE",
      "showStatus": "SHOW",
      "rank": 5,
      "score": "88.2",
      "spaceId": "dogekspace",
      "feeBurn": 120000
    }
  ]
}
```

#### `ListTokenRet` Structure (used by ranking and search)

| Field | Type | Description |
|---|---|---|
| `tokenId` | integer | Unique token ID. |
| `name` | string | Full token name. |
| `shortName` | string | Short token name. |
| `descr` | string | Token description. |
| `userAddress` | string | Creator wallet address. |
| `symbol` | string | Quote currency symbol. |
| `tokenAddress` | string | Token contract address. |
| `progress` | number | Sale progress percentage. |
| `price` | number | Current price. |
| `cap` | number | Market cap. |
| `capUSDT` | number | Market cap in USDT. |
| `hold` | integer | Number of unique holders. |
| `img` | string | Token image URL. |
| `tag` | string | Token tag. |
| `increase` | number | Price increase percentage. |
| `min5Increase` | number | 5-minute increase. |
| `min30Increase` | number | 30-minute increase. |
| `hourIncrease` | number | 1-hour increase. |
| `hour4Increase` | number | 4-hour increase. |
| `day1Increase` | number | 24-hour increase. |
| `volume` | number | Total trading volume. |
| `day1Vol` | number | 24-hour trading volume. |
| `day1VolUSDT` | number | 24-hour trading volume in USDT. |
| `taxFee` | number | Tax fee rate. |
| `createDate` | string | Creation time (ISO 8601). |
| `networkCode` | integer | Network code. |
| `version` | integer | Contract version. |
| `status` | string | Token status. |
| `showStatus` | string | Display status. |
| `rank` | integer | Rank (for BN ranking board). |
| `score` | string | Score (for BN ranking board). |
| `spaceId` | string | SpaceId domain. |
| `feeBurn` | number | Cumulative fee burn amount. |

---

## Private Endpoints (`AUTH REQUIRED`)

### Check User Login Record

Check whether a user has login records within a given time range.

`POST https://four.meme/meme-api/api/v1/token/login/record`

#### Request Body

```json
{
  "address": "0xuseraddress...",
  "startTime": 1672531200000,
  "endTime": 1675209600000
}
```

#### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | string | Yes | User wallet address. |
| `startTime` | integer | No | Start of the time range (Unix milliseconds). |
| `endTime` | integer | No | End of the time range (Unix milliseconds). |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": {
    "isLogin": 1
  }
}
```

#### Response Fields (`data` object)

| Field | Type | Description |
|---|---|---|
| `isLogin` | integer | `1` if a login record exists, otherwise `0`. |

---

### Set Token SpaceId

Batch-set SpaceId for multiple tokens.

`PUT https://four.meme/meme-api/api/v1/token/spaceid`

#### Request Body

```json
{
  "spaceIds": [
    {
      "address": "0xtokenaddress1...",
      "domain": "myspace1"
    },
    {
      "address": "0xtokenaddress2...",
      "domain": "myspace2"
    }
  ]
}
```

#### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `spaceIds` | array | Yes | List of token–domain pairs. Max 100 items. |

#### `spaceIds` Array Item

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | string | Yes | Token contract address. |
| `domain` | string | Yes | SpaceId domain string. Max 100 characters. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": [
    "0xtokenaddress1...",
    "0xtokenaddress2..."
  ]
}
```

---

### Generate Nonce

Generate a nonce for the user to sign. This is the first step of the wallet binding flow.

`POST https://four.meme/meme-api/api/v1/private/nonce/generate`

#### Request Body

```json
{
  "accountAddress": "0xuseraddress...",
  "verifyType": "LOGIN",
  "networkCode": "BSC"
}
```

#### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `accountAddress` | string | Yes | User wallet address (e.g. `0x...`). |
| `verifyType` | string | Yes | Verification type. Currently only `LOGIN` is supported. |
| `networkCode` | string | No | Network code. Defaults to `BSC`. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": "1678886400000-aBcDeFgHiJkLmNoP"
}
```

---

### Bind User Address

Bind a wallet address to a user account by verifying a signed nonce.

`POST https://four.meme/meme-api/api/v1/private/user/bind`

> **Flow:**
> 1. Call `POST /private/nonce/generate` to get a nonce.
> 2. In the user's wallet, sign the message `"You are sign in Meme " + nonce` (EIP-191 personal signature).
> 3. Call this endpoint with the signature.

#### Request Body

```json
{
  "address": "0xuseraddress...",
  "signature": "0x...",
  "verifyType": "LOGIN",
  "networkCode": "BSC"
}
```

#### Request Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `address` | string | Yes | User wallet address. |
| `signature` | string | Yes | EIP-191 signature as a 65-byte hex string (`r + s + v`). |
| `verifyType` | string | No | Verification type. Must match the type used when generating the nonce. |
| `networkCode` | string | No | Network code. Must match the network code used when generating the nonce. |

#### Response Example

```json
{
  "code": 0,
  "msg": "Success",
  "data": null
}
```


### Create OpenFour token

>**Response:**

```javascript
{
  "code": 0,
  "msg": "success",
  "data": [
    {
        // token ID
      "tokenId": 100923280,
        // token address
      "tokenAddress": "0x773f34295579f9a20292f4c79669477c48634444",
        // create params for call contract
      "createArg": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000603f7930000000000000000000000000000000000000000000000000000019dfab455ea000000000000000000000000000000000000000000000000000000006a055b7700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000000000000033b2e3c9fd0803ce800000000000000000000000000000000000000000000000295be96e64066972000000000000000000000000000000000000000000000000000000002c68af0bb140000000000000000000000000000ae13d989dac2f0debff460ac112a837c89baa7cdaffde145be87c0fe8dc22d6afdd88fb201768aed497fc33a0f5cb9a36569206500000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000002e000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000320000000000000000000000000000000000000000000000000000000000000034000000000000000000000000000000000000000000000000000000000000003600000000000000000000000000000000000000000000000000000000000000002736400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047361647300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005268747470733a2f2f73332e61702d6e6f727468656173742d312e616d617a6f6e6177732e636f6d2f62696e617279782d67616d652f746f6b656e2d696e666f2f6273632f3130303932333238332e6a736f6e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", 
        // create signature for call contract
      "signature": "0x4ffed6b4a3f94027fbdfe5d217f238829d5c89b866309f2c217da481ef2434c2774a3aa091dab7a2bb17519fceb2b6e80cae20700f004323eacf6665e682bf701b"
    }
  ]
}
```
Create OpenFour Token

`POST /meme-api/v1/private/token_template/token/create`

**Parameters:**

Name | Type | Mandatory | Description          |  Demo
------------ | ------------ | ------------ |----------------------| ------------ 
templateId | LONG | YES | template contract id |
name | STRING | YES | token name           |
shortName | STRING | YES | token short name     |
symbol | STRING | YES | token quote symbol   |
desc | STRING | YES |                      |
imgUrl | STRING | YES |                      |
webUrl | STRING | NO |                      |
telegramUrl | STRING | NO |                      |
twitterUrl | STRING | NO |                      |
presaleQuote | DECIMAL | YES |                      |
feePlan | BOOLEAN | YES |                      |
initParams | LONG | YES |                      |

* initParams use open four js sdk
initParams: {curveParams: "0x", migrateParams: "0x", tokenParams: "0x", tradeParams: "0x", vaultParams: "0x",customDataParams: "0x"}
