import { EntityManager, PostgreSqlDriver } from '@mikro-orm/postgresql'
import { EntityClass, FilterQuery, MikroORM, EntityRepository, RequiredEntityData, QueryOrderNumeric, wrap } from "@mikro-orm/core"
import { EventParam, AtomicDatabase, Collection, EventCollection, Event } from './storage'
import { __evm_blocks } from './mikro-orm/__evm_blocks'
import { Event as EventEntity } from './mikro-orm/Event'

/*
	Best-typed ORM according to

	https://www.prisma.io/dataguide/database-tools/evaluating-type-safety-in-the-top-8-typescript-orms
*/

export async function migrateSchemaDESTRUCTIVE(orm: MikroORM<PostgreSqlDriver>, schema: string)
{
	const generator = orm.getSchemaGenerator()
	console.log(`got generator, dropping schema... (1/3)`)
	await generator.dropSchema({
		wrap: false,
		schema,
	})
	console.log(`dropped schema, creating new... (2/3)`)
	await generator.createSchema({
		wrap: false,
		schema,
	})
	console.log(`created schema, updating... (3/3)`)
	await generator.updateSchema({
		wrap: false,
		schema,
	})
	console.log(`migration finished`)
}

export async function validateSchema(orm: MikroORM<PostgreSqlDriver>, schema: string)
{
	const generator = orm.getSchemaGenerator()
	try
	{
		// await generator.dropSchema()
		// await generator.createSchema()
		// await generator.updateSchema()
		await generator.updateSchema({
			dropTables: false,
			safe: true,
			wrap: false,
			schema,
		})
		if ((await generator.getUpdateSchemaSQL({ schema })).length > 0)
		{
			throw new Error("Schema is not up to date, migrate manually")
		}
	}
	catch (e)
	{
		// console.error(`Erorr trying to update schema! Migrate manually`)
		throw e
	}
}

async function upsert<T extends {}>(rep: EntityRepository<T>, where: FilterQuery<T>, data: RequiredEntityData<T>)
{
	let found = await rep.findOne(where)
	let e = found ? wrap(found).assign(data as any) : rep.create(data)

	rep.persist(e)

	return e
}
async function insertIfMissing<T extends {}>(rep: EntityRepository<T>, where: FilterQuery<T>, data: T)
{
	let found = await rep.findOne(where)
	if (!found)
	{
		let e = rep.create(data)
		rep.persist(e)
	}
}

const getCollection = <T extends { blockNumber: number }>(
	blockNumber: number,
	repository: EntityRepository<T>,
	history: EntityRepository<RequiredEntityData<T>>,
	findById: (id: string) => FilterQuery<T>,
	getVersion: (entity: T | RequiredEntityData<T>) => number,
	withVersion: <U extends Omit<T | RequiredEntityData<T>, "blockNumber">>(entity: U, version: number) => RequiredEntityData<T>,
): Collection<T, FilterQuery<T>, Omit<RequiredEntityData<T>, "blockNumber">> =>
{
	async function insertHistory(query: FilterQuery<T>, entity: RequiredEntityData<T> | null | undefined)
	{
		if (!entity)
			return

		// console.log(`Inserting history for at block ${getVersion(entity)} on ${blockNumber}`)

		return upsert(history, { ...query, blockNumber } as any, withVersion(entity, blockNumber))
	}
	return {
		load: async (id, mode) =>
		{
			let e = await repository.findOne(findById(id))

			if (mode == "write")
				await insertHistory(findById(id), e)

			return e
		},
		loadThrow: async (id, mode) =>
		{
			let e = await repository.findOneOrFail(findById(id))

			if (mode == "write")
				await insertHistory(findById(id), e)

			return e
		},
		findOne: async (query, mode) =>
		{
			let e = await repository.findOne(query)

			if (mode == "write")
				await insertHistory(query, e)

			return e
		},
		findOneThrow: async (query, mode) => 
		{
			let e = await repository.findOneOrFail(query)

			if (mode == "write")
				await insertHistory(query, e)

			return e
		},
		findMany: async (query, mode) =>
		{
			let all = await repository.find(query)

			if (mode == "write")
				for (let e of all)
					await insertHistory(query, e)

			return all
		},
		create: async (id, data) =>
		{
			let c = repository.create(withVersion(data, blockNumber))
			repository.persist(c)
			await insertHistory(findById(id), withVersion(data, blockNumber))
			return c
		},
		async save(id, data)
		{
			await upsert<T>(repository, findById(id), withVersion(data, blockNumber))
			await insertHistory(findById(id), withVersion(data, blockNumber))
			// console.log(`Saving ${id} with version ${blockNumber} over ${prevVersion ? getVersion(prevVersion) : 'nothing'}`)
			// if (prevVersion)
			// {
			// 	let lastHistory = await history.findOne(findById(id) as any)
			// 	if ((getVersion(prevVersion) != blockNumber) && lastHistory && (getVersion(lastHistory) != blockNumber))
			// 	{
			// 		let h = history.create(withVersion(prevVersion, blockNumber))
			// 		history.persist(h)
			// 	}
			// 	repository.remove(prevVersion)
			// }

			// let n = repository.create({ ...data })
			// repository.persist(n)
		},
	}
}

type Versionless<T> = Omit<T, "blockNumber">

export const mikroOrmStorage = <
	Records extends Record<string, { blockNumber: number }>,
	Events extends Record<string, EventParam<string, {}>[]>,
>(
	timeTravelDepth: number = 20,
	orm: MikroORM<PostgreSqlDriver>,
	schema: { [key in keyof Records]: {
		byId: (id: string) => FilterQuery<Records[key]>,
		getId: (obj: Versionless<Records[key] | RequiredEntityData<Records[key]>>) => string,
		version: (obj: Records[key] | RequiredEntityData<Records[key]>) => number,
		withVersion: <U extends Versionless<Records[key] | RequiredEntityData<Records[key]>>>(obj: U, version: number) => RequiredEntityData<Records[key]>
		entity: EntityClass<Records[key]>,
		history: EntityClass<RequiredEntityData<Records[key]>>,
	} },
	events: { [key in keyof Events]?: EntityClass<Event<Events[key]>> },
): AtomicDatabase<Records, Events, { [key in keyof Records]: FilterQuery<Records[key]> }, { [key in keyof Records]: Versionless<RequiredEntityData<Records[key]>> }> =>
{
	const getLastProcessedBlockNumber = async () =>
	{
		let last = await orm.em.fork().find(__evm_blocks, {}, { orderBy: { blockNumber: QueryOrderNumeric.DESC }, limit: 1 })
		return last[0]?.blockNumber || 0
	}
	const revertToBlock = (em: EntityManager) => async (blockNumber: number) =>
	{
		console.log(`Reverting to block ${blockNumber}`)
		let rep = em.getRepository(__evm_blocks)
		let blocks = await rep.find({ blockNumber: { $gt: blockNumber } })
		for (let block of blocks)
			rep.remove(block)

		// await rep.nativeDelete({ blockNumber: { $gt: blockNumber } })

		let oldEvents = await em.find(EventEntity, { blockNumber: { $gt: blockNumber } })
		for (let e of oldEvents)
			em.remove(e)

		for (let s in schema)
		{
			// console.log(`processing ${s}`)
			let x = schema[s]
			let rep = em.getRepository(x.entity)
			let hist = em.getRepository(x.history)

			let oldHistory = await hist.find({ blockNumber: { $gt: blockNumber } } as any)
			// console.log(`removing ${oldHistory.length} history entries`)
			// console.log(oldHistory)
			for (let h of oldHistory)
				hist.remove(h)

			let old = await rep.find({ blockNumber: { $gt: blockNumber } } as any)
			for (let o of old)
			{
				let query = x.byId(x.getId(o))
				let historical = await hist.find({ ...query, blockNumber: { $lte: blockNumber } } as any, {
					orderBy: { blockNumber: QueryOrderNumeric.DESC },
					limit: 1
				} as any)
				// console.log(`found ${historical.length} historical entries`)
				// console.log(query)
				// console.log(`blockNumber: ${blockNumber}`)
				// console.log(await hist.findAll({}))
				
				if (historical.length)
				{
					rep.assign(o, historical[0])
					// rep.persist(rep.create(historical[0]))
					hist.remove(historical[0])
				}
				else
				{
					rep.remove(o)
				}
			}
		}
	}
	return {
		getLastProcessedBlockNumber,
		async vacuum()
		{
			//throw new Error(`Not implemented`)
		},
		async prepare()
		{
			let lastProcessedBlock = await getLastProcessedBlockNumber()
			let em = orm.em.fork()
			await revertToBlock(em)(lastProcessedBlock)
			await em.flush()
		},
		closeConnection()
		{
			return orm.close()
		},
		async startTransaction(blockNumber, blockHash)
		{
			let em = orm.em.fork()
			await em.begin()

			return {
				commit: async () =>
				{
					await upsert<__evm_blocks>(em.getRepository(__evm_blocks), { blockNumber }, { blockNumber, blockHash })
					return em.commit()
				},
				rollback: () => em.rollback(),
				collection(name)
				{
					let s = schema[name]
					return getCollection(
						blockNumber,
						em.getRepository(s.entity),
						em.getRepository(s.history),
						s.byId,
						s.version,
						s.withVersion,
					)
				},
				eventCollection<Topic extends keyof Events>(topic: Topic, contract: string): EventCollection<Events[Topic]>
				{
					let ev = events[topic]
					return {
						add: async data =>
						{
							em.persist(em.create(ev || EventEntity, data))
						},
					}
				},
			}
		},
		async startMetaTransaction()
		{
			let em = orm.em.fork()
			await em.begin()

			return {
				commit: () => em.commit(),
				rollback: () => em.rollback(),
				revertToBlock: revertToBlock(em),
				async getAvailableParsedBlocks()
				{
					let rep = em.getRepository(__evm_blocks)
					let blocks = await rep.findAll({ orderBy: { blockNumber: QueryOrderNumeric.DESC }, limit: timeTravelDepth })
					// console.log(`blocks`, blocks)
					return blocks.reverse()
				},

			}
		},
	}
}
