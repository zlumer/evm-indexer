import Web3 from "web3"
import type { AbiItem } from "web3-utils"
import { loadLogsForContract } from "./loadLogs"
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
	await loadLogsForContract(web3, addresses, topics, startingBlock, 1999, async (blockNumber, logs) =>
	{
		if (!logs.length)
			return

		let block = await web3.eth.getBlock(blockNumber)
		let dbTx = await storage.startTransaction(blockNumber)
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

			let event: Event<Events[string]> = {
				address: log.address,

				name: abi.name || "",
				fullName: (web3.utils as any)._jsonInterfaceMethodToString(abi),
				topic,

				blockNumber,
				blockHash: block.hash,
				txHash: log.transactionHash,
				logIndex: log.logIndex,
				args: eventArgs as any,
				parameters: eventArgs as any,
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
	})
	await storage.closeConnection()
}
