import type { BlockTransactionString } from "web3-eth"
import type { Transaction } from "web3-core"

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

	data: string

	// transactionLogIndex: BigInt
	// logType: string | null
}

type EventHandler<
	Events extends Record<string, EventParam<string, unknown>[]>,
	Key extends keyof Events,
	StorageMap extends Record<string, unknown>,
	Queries extends Record<keyof StorageMap, {}>,
	StorageMapCreateData extends Record<keyof StorageMap, {}>
> =
	(e: Event<Events[Key]>, storage: DatabaseTransaction<StorageMap, Events, Queries, StorageMapCreateData>, context: {
		block: BlockTransactionString
		tx: Transaction
		// receipt?: TransactionReceipt
	}) => Promise<void>

export type Handlers<
	Events extends Record<string, EventParam<string, unknown>[]>,
	StorageMap extends Record<string, unknown>,
	Queries extends Record<keyof StorageMap, {}>,
	StorageMapCreateData extends Record<keyof StorageMap, {}>,
> = {
		[K in keyof Events]?: EventHandler<Events, K, StorageMap, Queries, StorageMapCreateData>
	}

export type Collection<T, Query, CreateData> = {
	load: (id: string) => Promise<T | undefined | null>
	loadThrow: (id: string) => Promise<T>
	findOne: (query: Query) => Promise<T | undefined | null>
	findOneThrow: (query: Query) => Promise<T>
	findMany: (query: Query) => Promise<T[]>
	save: (id: string, data: CreateData) => Promise<void>
	create: (id: string, data: CreateData) => Promise<T>
	// delete: (id: string) => Promise<void>
}
export type EventCollection<T extends EventParam<string, unknown>[]> = {
	add: (data: Event<T>) => Promise<void>
}
export type DatabaseTransaction<
	Records extends Record<string, unknown>,
	Events extends Record<string, EventParam<string, unknown>[]>,
	Queries extends Record<keyof Records, {}>,
	RecordCreateData extends { [key in keyof Records]: unknown },
> = {
	collection: <Name extends keyof Records>(name: Name) => Collection<Records[Name], Queries[Name], RecordCreateData[Name]>
	eventCollection: <Topic extends keyof Events>(topic: Topic, contract: string) => EventCollection<Events[Topic]>
	commit: () => Promise<void>
	rollback: () => Promise<void>
}
export type MetaTransaction = {
	getAvailableParsedBlocks: () => Promise<{ blockNumber: number, blockHash: string }[]>
	revertToBlock: (blockNumber: number) => Promise<void>
	commit: () => Promise<void>
	rollback: () => Promise<void>
}
export type AtomicDatabase<
	Records extends Record<string, unknown>,
	Events extends Record<string, EventParam<string, unknown>[]>,
	Queries extends Record<keyof Records, {}>,
	StorageMapCreateData extends Record<keyof Records, unknown>
> = {
	startTransaction: (blockNumber: number, blockHash: string) => Promise<DatabaseTransaction<Records, Events, Queries, StorageMapCreateData>>
	startMetaTransaction: () => Promise<MetaTransaction>
	getLastProcessedBlockNumber: () => Promise<number>
	prepare: () => Promise<void>,
	vacuum: () => Promise<void>,
	closeConnection: () => Promise<void>
}
