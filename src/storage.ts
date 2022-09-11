import { clone, atWrap } from "froebel"

export type Collection<T> = {
	load: (id: string) => Promise<T | undefined>
	save: (id: string, data: T) => Promise<void>
	delete: (id: string) => Promise<void>
}
export type DatabaseTransaction<Records extends Record<string, unknown>> = {
	collection: <Name extends keyof Records>(name: Name) => Collection<Records[Name]>
	commit: () => Promise<boolean>
}
export type AtomicDatabase<Records extends Record<string, unknown>> = {
	startTransaction: (blockNumber: number) => Promise<DatabaseTransaction<Records>>
	closeConnection: () => Promise<void>
}

const last = <T>(arr: T[]): T => arr[arr.length - 1]

export const inMemoryStorage = <Records extends Record<string, unknown>>(): AtomicDatabase<Records> =>
{
	let saved = {} as any
	return {
		async closeConnection() {
			console.log(`Closing connection to in-memory database`)
			console.log(saved)
			for (let s in saved)
				console.log(saved[s])
		},
		async startTransaction(blockNumber)
		{
			console.log(`db transaction started`)
			let db = clone(saved)
			return {
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

							if (!db[name])
								db[name] = {}

							if (!db[name][id])
								db[name][id] = []

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
					console.log(`db transaction commited`)
					return true
				}
			}
		},
	}
}