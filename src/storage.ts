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
export type PositionalArgs<T extends EventParam<string, unknown>[]> = {
	[K in keyof T]: T[K]["value"]
}

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
	parameters: PositionalArgs<T>

	// transactionLogIndex: BigInt
	// logType: string | null
}

type EventHandler<Events extends Record<string, EventParam<string, unknown>[]>, T extends EventParam<string, unknown>[], StorageMap extends Record<string, unknown>> =
	(e: Event<T>, storage: DatabaseTransaction<StorageMap, Events>, context: {
		block: BlockTransactionString
		tx: Transaction
		// receipt?: TransactionReceipt
	}) => Promise<void>

export type Handlers<Events extends Record<string, EventParam<string, unknown>[]>, StorageMap extends Record<string, unknown>> = {
	[K in keyof Events]: EventHandler<Events, Events[K], StorageMap>
}

export type Collection<T> = {
	load: (id: string) => Promise<T | undefined>
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

export const inMemoryStorage = <
	Records extends Record<string, unknown>,
	Events extends Record<string, EventParam<string, unknown>[]>
>(): AtomicDatabase<Records, Events> =>
{
	let saved = {} as any
	let events = {} as any
	return {
		async closeConnection()
		{
			console.log(`Closing connection to in-memory database`)
			console.log(saved)
			console.log(events)
			for (let s in saved)
				for (let m in saved[s])
					console.log(saved[s][m])
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
					return {
						async load(id)
						{
							console.log(`loading ${String(name)}.${id}`)

							if (!db[name]?.[id]?.length)
								return undefined

							return last<any>(db[name][id]).value
						},
						async save(id, data)
						{
							console.log(`saving ${String(name)}.${id}: ${JSON.stringify(data)}`)

							db[name] ||= {}
							db[name][id] ||= []

							db[name][id].push({
								blockNumber,
								value: data,
							})
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
					saved = db
					events = eventDb
					console.log(`db transaction commited`)
					return true
				}
			}
		},
	}
}