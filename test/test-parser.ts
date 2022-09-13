import Web3 from "web3"
import { splitWeb3Result } from "../src/parser"

const inputs = [
	{
		indexed: true,
		internalType: 'uint256',
		name: 'id',
		type: 'uint256'
	},
	{
		indexed: true,
		internalType: 'address',
		name: 'aliceAddress',
		type: 'address'
	},
	{
		indexed: true,
		internalType: 'address',
		name: 'tokenAlice',
		type: 'address'
	},
	{
		components: [
			{
				"internalType": "address",
				"name": "tokenAlice",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amountAlice",
				"type": "uint256"
			},
			{
				"internalType": "address[]",
				"name": "tokensBob",
				"type": "address[]"
			},
			{ "internalType": "uint256", "name": "feeAlice", "type": "uint256" },
			{ "internalType": "uint256", "name": "feeBob", "type": "uint256" }
		],
		indexed: false,
		internalType: 'struct IMarsbaseBestBid.BBOfferParams',
		name: 'params',
		type: 'tuple'
	}
]
const data = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7"
const topics = [
	'0x0000000000000000000000000000000000000000000000000000000000000000',
	'0x00000000000000000000000025fa0cc65f8b5db764eb2243b13db4d63b29fd58',
	'0x0000000000000000000000000000000000000000000000000000000000000000'
]

let web3 = new Web3()
let testData = web3.eth.abi.decodeLog(inputs, data, topics)

// console.log(testData)

console.log(splitWeb3Result(testData, inputs))
