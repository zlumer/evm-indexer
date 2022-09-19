import Web3 from "web3"
import type { AbiItem } from "web3-utils"
import type { BlockTransactionString } from "web3-eth"
import { loadNextChunkLogsForContract } from "./loadLogs"
import { splitWeb3Result } from "./parser"
import { sleep } from "./sleep"
import type { AtomicDatabase, Event, EventParam, Handlers, NamedArgs } from "./storage"

export type Config<
	Events extends Record<string, EventParam<string, unknown>[]>,
	StorageMap extends Record<string, unknown>,
	Queries extends Record<keyof StorageMap, {}>,
	StorageMapCreateData extends Record<keyof StorageMap, {}>,
> = {
	rpc: string
	contracts: Record<string, {
		address: string
		createdBlockNumber: number
		abi: AbiItem[]
		handlers: Handlers<Events, StorageMap, Queries, StorageMapCreateData>
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
		let block: BlockTransactionString | undefined = await web3.eth.getBlock(last.blockNumber)
		if (block?.hash == last.blockHash)
			return last.blockNumber

		last = blocks.pop()
	}
	return 0
}
async function validateStorage<T extends AtomicDatabase<{}, {}, {}, {}>>(web3: Web3, storage: T)
{
	let metaTx = await storage.startMetaTransaction()
	let blocks = await metaTx.getAvailableParsedBlocks()
	if (!blocks.length)
	{
		console.log(`validateStorage: no blocks, starting from scratch`)
		return metaTx.rollback()
	}

	let lastValidBlock = await checkForLastValidBlock(web3, blocks)
	if (lastValidBlock != blocks[blocks.length - 1].blockNumber)
	{
		console.log(`validateStorage: reverting from ${blocks[blocks.length - 1].blockNumber} to ${lastValidBlock}`)
		await metaTx.revertToBlock(lastValidBlock)
	}

	await metaTx.commit()
}

async function skipBlock<T extends AtomicDatabase<{}, {}, {}, {}>>(storage: T, blockNumber: number, blockHash: string)
{
	let tx = await storage.startTransaction(blockNumber, blockHash)
	await tx.commit()
}

type ProgressHandler = (
	startBlockNumber: number,
	lastProcessedBlockNumber: number,
	blockHeight: number,
	timeStarted: number,
) => void

export const logProgress: ProgressHandler = (startBlockNumber, lastProcessedBlockNumber, blockHeight, timeStarted) =>
{
	let totalBlocks = blockHeight - startBlockNumber
	let processedBlocks = lastProcessedBlockNumber - startBlockNumber
	let remainingBlocks = totalBlocks - processedBlocks
	let percent = processedBlocks / totalBlocks * 100

	let now = Date.now()
	let timePassed = now - timeStarted
	let speed = processedBlocks / timePassed * 1000
	let timeRemaining = remainingBlocks / speed

	let timeString = ` ~${timeRemaining.toFixed(0)} seconds remaining`
	console.log(`index progress: ${percent.toFixed(2)}% (${processedBlocks}/${totalBlocks})${remainingBlocks > 1 ? timeString : ""}`)
}

export async function startLoop<
	Events extends Record<string, EventParam<string, unknown>[]>,
	Db extends Record<string, unknown>,
	Queries extends Record<keyof Db, {}>,
	DbRawCreateData extends Record<keyof Db, {}>
>(storage: AtomicDatabase<Db, Events, Queries, DbRawCreateData>, config: Config<Events, Db, Queries, DbRawCreateData>, onProgress?: ProgressHandler)
{
	let web3 = new Web3(config.rpc)
	let addresses = Object.keys(config.contracts)
	let abis = Object.values(config.contracts).reduce((acc, cur) => acc.concat(cur.abi), [] as AbiItem[])
	let topics = removeDuplicates(filterEvents(abis).map(web3.eth.abi.encodeEventSignature))
	let startingBlock = Math.min(...Object.values(config.contracts).map(x => x.createdBlockNumber))
	let events = mapObj(config.contracts, (k, v) => eventsByTopic(v.abi, web3.eth.abi.encodeEventSignature))

	let timeStarted = Date.now()

	console.log(`starting indexing from block #${startingBlock}`)

	console.log(`preparing db...`)
	await storage.prepare()
	console.log(`db ready`)

	let lastProcessedBlock = await storage.getLastProcessedBlockNumber()
	console.log(`last processed block is ${lastProcessedBlock}`)
	console.log(`current block height is ${await web3.eth.getBlockNumber()}`)
	while (true)
	{
		await validateStorage(web3, storage)
		await storage.vacuum()

		let blockHeight = await web3.eth.getBlockNumber()
		let nextBlockToProcess = (await storage.getLastProcessedBlockNumber()) + 1
		// console.log(`startingBlock: ${startingBlock}, lastProcessedBlock: ${lastProcessedBlock}, nextBlockToProcess: ${nextBlockToProcess}`)
		if (nextBlockToProcess < startingBlock)
			nextBlockToProcess = startingBlock

		if (onProgress)
			onProgress(startingBlock, nextBlockToProcess - 1, blockHeight, timeStarted)

		if (nextBlockToProcess > blockHeight)
		{
			// console.log(`[${nextBlockToProcess}] No new blocks to process, waiting...`)
			await sleep(3000)
			continue
		}
		let nextChunk = await loadNextChunkLogsForContract(web3, addresses, topics, blockHeight, nextBlockToProcess, 1999)
		if (!nextChunk)
		{
			// we're in the middle of reorg, just skip everything
			await sleep(1000)
			continue
		}
		if (!nextChunk.logsCount)
		{
			await skipBlock(storage, nextChunk.lastBlock.number, nextChunk.lastBlock.hash)
			continue
		}
		for (let logs of nextChunk.groupedLogs)
		{
			let blockNumber = logs[0].blockNumber
			let blockHash = logs[0].blockHash

			// console.log(`processing block ${blockNumber}`)

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
					data: log.data,
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
