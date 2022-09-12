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
}
export type AtomicDatabase<
	Records extends Record<string, unknown>,
	Events extends Record<string, EventParam<string, unknown>[]>
> = {
	startTransaction: (blockNumber: number) => Promise<DatabaseTransaction<Records, Events>>
	closeConnection: () => Promise<void>
}

const last = <T>(arr: T[]): T => arr[arr.length - 1]

const matchObject = <T>(obj: T, query: Partial<T>): boolean =>
{
	for (const key in query)
		if (obj[key] !== query[key])
			return false

	return true
}

export const inMemoryStorage = <
	Records extends Record<string, unknown>,
	Events extends Record<string, EventParam<string, unknown>[]>
>(
	onCommit?: (
		db: {
			saved: {
				[modelName in keyof Records]: {
					[id: string]: {
						blockNumber: number
						value: any
					}[]
				}
			},
			events: {
				[topic in keyof Events]: Event<Events[topic]>[]
			}
		}) => Promise<void>,
	onCloseConnection?: (
		db: {
			saved: {
				[modelName in keyof Records]: {
					[id: string]: {
						blockNumber: number
						value: any
					}[]
				}
			},
			events: {
				[topic in keyof Events]: Event<Events[topic]>[]
			}
		}
	) => Promise<void>
): AtomicDatabase<Records, Events> =>
{
	let saved = {} as {
		[modelName in keyof Records]: {
			[id: string]: {
				blockNumber: number
				value: any
			}[]
		}
	}
	let events = {} as {
		[topic in keyof Events]: Event<Events[topic]>[]
	}
	return {
		async closeConnection()
		{
			console.log(`Closing connection to in-memory database`)
			// console.log(saved)
			// console.log(events)
			// for (let s in saved)
			// 	for (let m in saved[s])
			// 		console.log(saved[s][m])

			if (onCloseConnection)
				await onCloseConnection({
					saved,
					events
				})
		},
		async startTransaction(blockNumber)
		{
			console.log(`db transaction started`)
			let db = clone(saved)
			let eventDb = clone(events)
			return {
				eventCollection(topic, contract)
				{
					return {
						async add(data)
						{
							console.log(`adding event ${data.fullName}`)
							eventDb[topic] = eventDb[topic] || []
							eventDb[topic].push(data)
						},
					}
				},
				collection(name)
				{
					db[name] ||= {}
					async function load(id: string)
					{
						console.log(`loading ${String(name)}.${id}`)

						if (!db[name]?.[id]?.length)
							return undefined

						return clone(last<any>(db[name][id]).value)
					}
					async function findOne(query: Partial<{}>)
					{
						for (let id in db[name])
						{
							let l = last(db[name][id])
							if (matchObject(l.value, query))
								return l.value
						}
						return undefined
					}
					async function findMany(query: Partial<{}>)
					{
						let arr = []
						for (let id in db[name])
						{
							let l = last(db[name][id])
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
							let val = load(id)
							if (!val)
								throw new Error(`${String(name)} ${id} not found!`)

							return val
						},
						async save(id, data)
						{
							console.log(`saving ${String(name)}.${id}: ${JSON.stringify(data)}`)

							db[String(name)][id] ||= []

							db[name][id].push({
								blockNumber,
								value: data,
							})
						},
						async findOneThrow(query)
						{
							let val = await findOne(query)
							if (!val)
								throw new Error(`${String(name)} not found! ${JSON.stringify(query)}`)

							return val
						},
						async delete(id)
						{
							console.log(`deleting ${String(name)}.${id}`)
							if (!db[name]?.[id]?.length)
								return

							last<any>(db[name][id]).value = undefined
						},
					}
				},
				async commit()
				{
					console.log(`db transaction commited`)
					saved = db
					events = eventDb
					if (onCommit)
						await onCommit({ saved, events })

					return true
				}
			}
		},
	}
}