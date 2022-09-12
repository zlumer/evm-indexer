import Web3 from "web3"
import type { AbiItem } from "web3-utils"
import { loadNextChunkLogsForContract } from "./loadLogs"
import { splitWeb3Result } from "./parser"
import type { AtomicDatabase, Event, EventParam, Handlers, NamedArgs } from "./storage"

export type Config<Events extends Record<string, EventParam<string, unknown>[]>, StorageMap extends Record<string, unknown>> = {
	rpc: string
	contracts: Record<string, {
		address: string
		createdBlockNumber: number
		abi: AbiItem[]
		handlers: Handlers<Events, StorageMap>
	}>
}

const filterEvents = (arr: AbiItem[]) => arr.filter(x => x.type == "event") as (AbiItem & { type: "event" })[]

const removeDuplicates = (arr: string[]) => Object.keys(arr.reduce((acc, cur) => Object.assign(acc, { [cur]: 1 }), {}))

const eventsByTopic = (abi: AbiItem[], getTopic: (abi: AbiItem) => string) => abi.reduce((acc, cur) => Object.assign(acc, {
	[getTopic(cur)]: cur
}), {} as Record<string, (AbiItem & { type: "event" })>)

const mapObj = <Key extends string, Value extends unknown, Result extends unknown>(obj: Record<Key, Value>, f: (k: Key, v: Value) => Result) =>
{
	const result = {} as Record<Key, Result>
	for (let k in obj)
		result[k] = f(k, obj[k])
	return result
}

const pickFK = <T extends {}, K extends keyof T>(obj: T, f: (k: keyof T) => k is K) =>
{
	const result = {} as { [k in K]: T[k] }
	for (let k in obj)
		if (f(k))
			result[k] = obj[k]
	return result
}
const partitionFK = <T extends {}, K extends keyof T>(obj: T, f: (k: keyof T) => k is K) =>
{
	const yes = {} as { [k in K]: T[k] }
	const no = {} as { [k in Exclude<keyof T, K>]: T[k] }
	for (let k in obj)
		if (f(k))
			yes[k] = obj[k]
		else
			(no as any)[k] = obj[k]
	return {
		yes, no
	}
}

async function checkForLastValidBlock(web3: Web3, blocks: { blockHash: string, blockNumber: number }[])
{
	blocks = blocks.slice()
	let last = blocks.pop()
	while (last)
	{
		let block = await web3.eth.getBlock(last.blockNumber)
		if (block.hash == last.blockHash)
			return last.blockNumber

		last = blocks.pop()
	}
	return 0
}
async function validateStorage(web3: Web3, storage: AtomicDatabase<{}, {}>)
{
	let metaTx = await storage.startMetaTransaction()
	let blocks = await metaTx.getAvailableParsedBlocks()
	if (!blocks.length)
		return console.log(`validateStorage: no blocks, rolling back`), metaTx.rollback()

	let lastValidBlock = await checkForLastValidBlock(web3, blocks)
	if (lastValidBlock != blocks[blocks.length - 1].blockNumber)
		console.log(`validateStorage: reverting from ${blocks[blocks.length - 1].blockNumber} to ${lastValidBlock}`), await metaTx.revertToBlock(lastValidBlock)

	await metaTx.commit()
}
async function getLastProcessedBlock(storage: AtomicDatabase<{}, {}>)
{
	let metaTx = await storage.startMetaTransaction()
	let blocks = await metaTx.getAvailableParsedBlocks()
	await metaTx.rollback()

	if (!blocks.length)
		return 0

	return blocks[blocks.length - 1].blockNumber
}

async function skipBlock(storage: AtomicDatabase<{}, {}>, blockNumber: number, blockHash: string)
{
	let tx = await storage.startTransaction(blockNumber, blockHash)
	await tx.commit()
}

export async function startLoop<
	Events extends Record<string, EventParam<string, unknown>[]>,
	Db extends Record<string, unknown>
>(storage: AtomicDatabase<Db, Events>, config: Config<Events, Db>)
{
	let web3 = new Web3(config.rpc)
	let addresses = Object.keys(config.contracts)
	let abis = Object.values(config.contracts).reduce((acc, cur) => acc.concat(cur.abi), [] as AbiItem[])
	let topics = removeDuplicates(filterEvents(abis).map(web3.eth.abi.encodeEventSignature))
	let startingBlock = Math.min(...Object.values(config.contracts).map(x => x.createdBlockNumber))
	let events = mapObj(config.contracts, (k, v) => eventsByTopic(v.abi, web3.eth.abi.encodeEventSignature))

	while (true)
	{
		await validateStorage(web3, storage)
		await storage.vacuum()

		let blockHeight = await web3.eth.getBlockNumber()
		let lastProcessedBlock = await getLastProcessedBlock(storage) + 1
		// console.log(`startingBlock: ${startingBlock}, lastProcessedBlock: ${lastProcessedBlock}`)
		if (lastProcessedBlock < startingBlock)
			lastProcessedBlock = startingBlock
		if (lastProcessedBlock >= blockHeight)
		{
			console.log(`[${lastProcessedBlock}] No new blocks to process, waiting...`)
			await new Promise(resolve => setTimeout(resolve, 3000))
			continue
		}
		let nextChunk = await loadNextChunkLogsForContract(web3, addresses, topics, blockHeight, lastProcessedBlock, 1999)
		if (!nextChunk.logsCount)
		{
			await skipBlock(storage, nextChunk.lastBlock.number, nextChunk.lastBlock.hash)
			continue
		}
		for (let logs of nextChunk.groupedLogs)
		{
			let blockNumber = logs[0].blockNumber
			let blockHash = logs[0].blockHash

			console.log(`processing block ${blockNumber}`)

			let dbTx = await storage.startTransaction(blockNumber, blockHash)

			let block = await web3.eth.getBlock(blockNumber)
			if (block.hash != blockHash)
			{
				console.log(`[${blockNumber}] block hash mismatch, reverting`)
				break
			}

			let tx = await web3.eth.getTransaction(logs[0].transactionHash)
			for (let log of logs)
			{
				if (tx.hash != log.transactionHash)
					tx = await web3.eth.getTransaction(log.transactionHash)

				let contract = config.contracts[log.address]
				let topic = log.topics[0]
				// console.log(log)
				let abi = events[log.address][topic]
				let eventArgs = web3.eth.abi.decodeLog(abi.inputs || [], log.data, log.topics.slice(1))
				let { obj: args, arr: parameters } = splitWeb3Result<Event<Events[string]>["args"]>(eventArgs, abi.inputs || [])

				let event: Event<Events[string]> = {
					address: log.address,

					name: abi.name || "",
					fullName: (web3.utils as any)._jsonInterfaceMethodToString(abi),
					topic,

					blockNumber,
					blockHash: block.hash,
					txHash: log.transactionHash,
					logIndex: log.logIndex,
					args,
					parameters,
				}
				await dbTx.eventCollection(topic, log.address).add(event)

				// console.log(event)

				let handler = contract.handlers[topic]
				if (handler)
				{
					await handler(event, dbTx, {
						block: block,
						tx: tx,
					})
				}
			}
			await dbTx.commit()
		}
		await skipBlock(storage, nextChunk.lastBlock.number, nextChunk.lastBlock.hash)
	}
}
