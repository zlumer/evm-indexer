import { clone } from "froebel"

import type { BlockHeader, BlockTransactionString } from "web3-eth"
import type { Transaction, TransactionReceipt, Log } from "web3-core"

export type EventParam<K, V> = {
	name: K
	value: V
}
export type NamedArgs<T extends EventParam<string, unknown>[]> = {
	[K in T[number]["name"]]: Extract<T[number], { name: K }>["value"]
}
// export type PositionalArgs<T extends EventParam<string, unknown>[]> = [] & {
// 	[K in Extract<keyof T, number>]: T[K]["value"]
// }

export type Event<T extends EventParam<string, unknown>[]> = {
	address: string

	name: string
	fullName: string
	topic: string

	blockNumber: number
	blockHash: string
	txHash: string
	logIndex: number

	args: NamedArgs<T>

	parameters: unknown[]

	// transactionLogIndex: BigInt
	// logType: string | null
}

type EventHandler<Events extends Record<string, EventParam<string, unknown>[]>, Key extends keyof Events, StorageMap extends Record<string, unknown>> =
	(e: Event<Events[Key]>, storage: DatabaseTransaction<StorageMap, Events>, context: {
		block: BlockTransactionString
		tx: Transaction
		// receipt?: TransactionReceipt
	}) => Promise<void>

export type Handlers<Events extends Record<string, EventParam<string, unknown>[]>, StorageMap extends Record<string, unknown>> = {
	[K in keyof Events]?: EventHandler<Events, K, StorageMap>
}

export type Collection<T> = {
	load: (id: string) => Promise<T | undefined>
	loadThrow: (id: string) => Promise<T>
	findOne: (query: Partial<{ [K in keyof T]: T[K] }>) => Promise<T | undefined>
	findOneThrow: (query: Partial<{ [K in keyof T]: T[K] }>) => Promise<T>
	findMany: (query: Partial<{ [K in keyof T]: T[K] }>) => Promise<T[]>
	save: (id: string, data: T) => Promise<void>
	delete: (id: string) => Promise<void>
}
export type EventCollection<T extends EventParam<string, unknown>[]> = {
	add: (data: Event<T>) => Promise<void>
}
export type DatabaseTransaction<
	Records extends Record<string, unknown>,
	Events extends Record<string, EventParam<string, unknown>[]>
> = {
	collection: <Name extends keyof Records>(name: Name) => Collection<Records[Name]>
	eventCollection: <Topic extends keyof Events>(topic: Topic, contract: string) => EventCollection<Events[Topic]>
	commit: () => Promise<boolean>
	rollback: () => Promise<boolean>
}
export type MetaTransaction = {
	getAvailableParsedBlocks: () => Promise<{ blockNumber: number, blockHash: string }[]>
	revertToBlock: (blockNumber: number) => Promise<boolean>
	commit: () => Promise<boolean>
	rollback: () => Promise<boolean>
}
export type AtomicDatabase<
	Records extends Record<string, unknown>,
	Events extends Record<string, EventParam<string, unknown>[]>
> = {
	startTransaction: (blockNumber: number, blockHash: string) => Promise<DatabaseTransaction<Records, Events>>
	startMetaTransaction: () => Promise<MetaTransaction>
	vacuum: () => Promise<void>,
	closeConnection: () => Promise<void>
}

const last = <T>(arr: T[]): T | undefined => arr.length ? arr[arr.length - 1] : undefined

const matchObject = <T>(obj: T, query: Partial<T>): boolean =>
{
	for (const key in query)
		if (obj[key] !== query[key])
			return false

	return true
}

function filterAllExceptLast<T>(arr: T[], predicate: (x: T) => boolean): T[]
{
	if (arr.length < 2)
		return arr

	const firstValidIndex = arr.findIndex(predicate)
	if ((firstValidIndex === -1) || (firstValidIndex === arr.length - 1))
		return [last(arr)!]

	return arr.slice(firstValidIndex)
}

type LocalDb<
	Records extends Record<string, unknown>,
	Events extends Record<string, EventParam<string, unknown>[]>
> = {
	saved: {
		[modelName in keyof Records]: {
			[id: string]: {
				blockNumber: number
				value: any
			}[]
		}
	}
	events: {
		[topic in keyof Events]: Event<Events[topic]>[]
	}
	meta: {
		blockHash: string
		blockNumber: number
	}[]
}
export const inMemoryStorage = <
	Records extends Record<string, unknown>,
	Events extends Record<string, EventParam<string, unknown>[]>
>(
	timeTravelDepth: number = 20,
	initialData?: LocalDb<Records, Events>,
	onCommit?: (db: LocalDb<Records, Events>) => Promise<void>,
	onCloseConnection?: (db: LocalDb<Records, Events>) => Promise<void>
): AtomicDatabase<Records, Events> =>
{
	let db: LocalDb<Records, Events> = initialData || {
		saved: {} as LocalDb<Records, Events>["saved"],
		events: {} as LocalDb<Records, Events>["events"],
		meta: [],
	}
	return {
		async vacuum()
		{
			if (db.meta.length < 2)
				return

			let lastBlockNumber = db.meta[db.meta.length - 1].blockNumber
			let removeBefore = lastBlockNumber - timeTravelDepth
			let oldBlocks = db.meta.filter(x => x.blockNumber <= removeBefore)
			let lastValidBlock = last(oldBlocks)
			if (!lastValidBlock)
				return

			let lastValidBlockNumber = lastValidBlock.blockNumber
			db.meta = db.meta.filter(x => x.blockNumber >= lastValidBlockNumber)
			for (let modelName in db.saved)
			{
				for (let id in db.saved[modelName])
				{
					db.saved[String(modelName)][id] = filterAllExceptLast(db.saved[modelName][id], x => x.blockNumber >= lastValidBlockNumber)
				}
			}
		},
		async closeConnection()
		{
			console.log(`Closing connection to in-memory database`)
			// console.log(saved)
			// console.log(events)
			// for (let s in saved)
			// 	for (let m in saved[s])
			// 		console.log(saved[s][m])

			if (onCloseConnection)
				await onCloseConnection(db)
		},
		async startMetaTransaction(): Promise<MetaTransaction>
		{
			let finished = false

			return {
				async commit()
				{
					if (finished)
						throw new Error(`Meta transaction already finished`)

					finished = true

					// console.log(`meta transaction commited`)
					if (onCommit)
						await onCommit(db)

					return true
				},
				async rollback()
				{
					if (finished)
						throw new Error(`Meta transaction already finished`)

					finished = true

					// console.log(`meta transaction rolled back`)

					return true
				},
				async getAvailableParsedBlocks()
				{
					return db.meta
				},
				async revertToBlock(blockNumber)
				{
					console.log(`Reverting to block ${blockNumber}`)

					for (let event in db.events)
						db.events[event] = db.events[event].filter((e) => e.blockNumber <= blockNumber)

					for (let model in db.saved)
						for (let id in db.saved[model])
							db.saved[String(model)][id] = db.saved[model][id].filter((e) => e.blockNumber <= blockNumber)

					db.meta = db.meta.filter((e) => e.blockNumber <= blockNumber)
					return true
				},
			}
		},
		async startTransaction(blockNumber, blockHash)
		{
			console.log(`db transaction started at block ${blockNumber}`)
			let savedDraft = clone(db.saved)
			let eventDraft = clone(db.events)

			let finished = false

			return {
				eventCollection(topic, contract)
				{
					return {
						async add(data)
						{
							console.log(`adding event ${data.name}`)
							eventDraft[topic] = eventDraft[topic] || []
							eventDraft[topic].push(data)
						},
					}
				},
				collection(name)
				{
					savedDraft[name] ||= {}
					async function load(id: string)
					{
						if (finished)
							throw new Error(`Transaction for ${blockNumber} already finished!`)
						
						console.log(`loading ${String(name)}.${id}`)

						if (!savedDraft[name]?.[id]?.length)
							return undefined

						return clone(last<any>(savedDraft[name][id]).value)
					}
					async function findOne(query: Partial<{}>)
					{
						if (finished)
							throw new Error(`Transaction for ${blockNumber} already finished!`)

						for (let id in savedDraft[name])
						{
							let l = last(savedDraft[name][id])
							if (!l)
								continue

							if (matchObject(l.value, query))
								return l.value
						}
						return undefined
					}
					async function findMany(query: Partial<{}>)
					{
						if (finished)
							throw new Error(`Transaction for ${blockNumber} already finished!`)

						let arr = []
						for (let id in savedDraft[name])
						{
							let l = last(savedDraft[name][id])
							if (!l)
								continue

							if (matchObject(l.value, query))
								arr.push(l.value)
						}
						return arr
					}
					return {
						load,
						findOne,
						findMany,
						async loadThrow(id)
						{
							if (finished)
								throw new Error(`Transaction for ${blockNumber} already finished!`)
	
							let val = load(id)
							if (!val)
								throw new Error(`${String(name)} ${id} not found!`)

							return val
						},
						async save(id, data)
						{
							if (finished)
								throw new Error(`Transaction for ${blockNumber} already finished!`)
	
							console.log(`saving ${String(name)}.${id}`)

							savedDraft[String(name)][id] ||= []

							if (last(savedDraft[String(name)][id])?.blockNumber == blockNumber)
								savedDraft[String(name)][id].pop()

							savedDraft[name][id].push({
								blockNumber,
								value: data,
							})
						},
						async findOneThrow(query)
						{
							if (finished)
								throw new Error(`Transaction for ${blockNumber} already finished!`)
	
							let val = await findOne(query)
							if (!val)
								throw new Error(`${String(name)} not found! ${JSON.stringify(query)}`)

							return val
						},
						async delete(id)
						{
							if (finished)
								throw new Error(`Transaction for ${blockNumber} already finished!`)
	
							console.log(`deleting ${String(name)}.${id}`)
							if (!savedDraft[name]?.[id]?.length)
								return

							last<any>(savedDraft[name][id]).value = undefined
						},
					}
				},
				async commit()
				{
					if (finished)
						throw new Error(`Transaction for ${blockNumber} already finished!`)

					finished = true

					// console.log(`db transaction commited`)
					db.saved = savedDraft
					db.events = eventDraft
					db.meta.push({
						blockNumber,
						blockHash,
					})
					console.log(`block ${blockNumber} processed`)

					if (onCommit)
						await onCommit(db)

					return true
				},
				async rollback()
				{
					if (finished)
						throw new Error(`Transaction for ${blockNumber} already finished!`)

					finished = true

					console.log(`db transaction rolled back`)

					return true
				},
			}
		},
	}
}