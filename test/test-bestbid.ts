import { AbiItem } from "web3-utils"
import { logProgress, startLoop, Handlers } from "../src"
import bestBidAbi from "./MarsbaseBestbid.json"
import { MarsbaseBestbid } from "./generated/MarsbaseBestbid"
import fs from "fs/promises"
import { inMemoryStorage } from "../src/storage-local"

type StorageRecords = {
	"Offers": {
		offerId: string

		status: "open" | "closed"
		aliceAddress: string
		tokenAlice: string
		tokensBob: string[]

		totalBids: number

		acceptedBidId?: string
	},
	"Bids": {
		bidId: string

		offerId: string
		bidIdx: string
		bobAddress: string
		tokenBob: string
		amountBob: string

		status: "active" | "cancelled" | "accepted" | "rejected"
	},
	"Addresses": {
		address: string

		offersCreated: string[]
		bidsCreated: string[]
		tradedWith: Record<string, number>
	}
}

const newAddress = (address: string): StorageRecords["Addresses"] => ({
	address,
	tradedWith: {},
	offersCreated: [],
	bidsCreated: [],
})

const BestBidHandlers: Handlers<MarsbaseBestbid, StorageRecords, {[key in keyof StorageRecords]: Partial<StorageRecords[key]>}, StorageRecords> = {
	// OfferCreated(uint256,address,address,(address,uint256,address[],uint256,uint256))
	"0x19d1f9dc6c04d1d8eb9182a087f0ff2a22f6e744ae25151016543e0e44e5732a": async (e, storage, ctx) =>
	{
		// console.log(e.args)
		await storage.collection("Offers").save(e.args.id, {
			offerId: e.args.id,
			status: "open",
			aliceAddress: e.args.aliceAddress,
			tokenAlice: e.args.tokenAlice,
			tokensBob: e.args.params.tokensBob,
			totalBids: 0,
		})

		let alice = await storage.collection("Addresses").load(e.args.aliceAddress)
		if (!alice)
			alice = newAddress(e.args.aliceAddress)

		alice.offersCreated.push(e.args.id)
		await storage.collection("Addresses").save(alice.address, alice)
	},
	// OfferClosed(uint256,address,uint8,(bool,uint256,address,(address,uint256,address[],uint256,uint256),uint256,uint256))
	"0x4e3b99cbdb847d983244b1224fc11819f8aa93c57eef1dd5910368bff74115d7": async (e, storage, ctx) =>
	{
		let offer = await storage.collection("Offers").loadThrow(e.args.id, "write")

		offer.status = "closed"
		await storage.collection("Offers").save(e.args.id, offer)
	},
	// 	"BidAccepted(indexed uint256,indexed address,uint256,uint256,uint256,uint256,(bool,uint256,address,(address,uint256,address[],uint256,uint256),uint256,uint256),(uint256,uint256,address,address,uint256))",
	"0x07a0c38b538343b8de726f8cd188d2ef18693286f1ebceefda2d8a2b49fe1642": async (e, storage, ctx) =>
	{
		let offer = await storage.collection("Offers").loadThrow(e.args.id, "write")

		let bid = await storage.collection("Bids").findOneThrow({
			offerId: offer.offerId,
			bidIdx: e.args.bid.bidIdx,
		}, "write")

		offer.status = "closed"
		offer.acceptedBidId = bid.bidId
		bid.status = "accepted"

		await storage.collection("Offers").save(e.args.id, offer)
		await storage.collection("Bids").save(bid.bidId, bid)

		let otherBids = await storage.collection("Bids").findMany({
			offerId: offer.offerId,
		})
		otherBids = otherBids.filter(b => b.bidId !== bid.bidId)
		await Promise.all(otherBids.map(x => storage.collection("Bids").save(x.bidId, {
			...x,
			status: "rejected"
		})))

		let alice = await storage.collection("Addresses").loadThrow(offer.aliceAddress)
		let bob = await storage.collection("Addresses").loadThrow(bid.bobAddress)
		alice.tradedWith[bob.address] = (alice.tradedWith[bob.address] || 0) + 1
		bob.tradedWith[alice.address] = (bob.tradedWith[alice.address] || 0) + 1
		await Promise.all([
			storage.collection("Addresses").save(alice.address, alice),
			storage.collection("Addresses").save(bob.address, bob),
		])
	},

	// 	"BidCancelled(indexed uint256,indexed address,indexed address,uint8,uint256,bytes32,(uint256,uint256,address,address,uint256))",
	"0x394db9698a101ce2339695d33ddff66e399a792ac64e529d270297bf637d459c": async (e, storage, ctx) =>
	{
		let offer = await storage.collection("Offers").loadThrow(e.args.offerId)
		let bid = await storage.collection("Bids").loadThrow(e.args.bidId, "write")

		bid.status = "cancelled"
		await storage.collection("Bids").save(bid.bidId, bid)
	},

	// 	"BidCreated(indexed uint256,indexed address,indexed address,uint256,bytes32,(uint256,uint256,address,address,uint256))",
	"0x251eb44a58e51aaca9c6fd37e7ea841675bde0aa89166bbe7f53ced3bce0830e": async (e, storage, ctx) =>
	{
		await storage.collection("Bids").save(e.args.bidId, {
			status: "active",
			bidId: e.args.bidId,
			bidIdx: e.args.bid.bidIdx,
			offerId: e.args.offerId,
			bobAddress: e.args.bid.bobAddress,
			amountBob: e.args.bid.amountBob,
			tokenBob: e.args.bid.tokenBob,
		})

		let offer = await storage.collection("Offers").loadThrow(e.args.offerId, "write")
		offer.totalBids = offer.totalBids + 1
		await storage.collection("Offers").save(e.args.offerId, offer)

		let bob = await storage.collection("Addresses").load(e.args.bid.bobAddress)
		if (!bob)
			bob = newAddress(e.args.bid.bobAddress)

		bob.bidsCreated.push(e.args.bidId)

		await storage.collection("Addresses").save(bob.address, bob)
	},
}

const CONFIGS = {
	mainnet: {
		db: "./test/db/db.json",
		rpc: "https://rpc.ankr.com/eth",
		address: "0x76263a5EFC2C1352815b309B412c429537b017A3",
		createdBlockNumber: 15351862,
	},
	rinkeby: {
		db: "./test/db/db-rin.json",
		rpc: "https://rpc.ankr.com/eth_rinkeby",
		address: "0xa8FEd9fa8beF5168682A5020CF050769D82ABCB7",
		createdBlockNumber: 11149754,
	},
	bsc: {
		db: "./test/db/db-bsc.json",
		rpc: "https://rpc.ankr.com/bsc",
		address: "0xd4c3C428a457A149338F91715614E36056F2019E",
		createdBlockNumber: 20458137,
	}
}
const config = CONFIGS.rinkeby

async function loadDb()
{
	try
	{
		let db = await fs.readFile(config.db, "utf8")
		return JSON.parse(db)
	}
	catch (e)
	{
		return undefined
	}
}

async function saveDb(db: unknown)
{
	await fs.writeFile(config.db, JSON.stringify(db, null, 4))
}

loadDb().then(db =>
{
	startLoop(inMemoryStorage<StorageRecords, MarsbaseBestbid>(20, db, saveDb, saveDb), {
		rpc: config.rpc,
		contracts: {
			[config.address]: {
				address: config.address,
				createdBlockNumber: config.createdBlockNumber,
				abi: bestBidAbi as AbiItem[],
				handlers: BestBidHandlers
			}
		}
	}, logProgress)
})
