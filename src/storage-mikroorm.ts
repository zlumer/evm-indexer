import { EntityManager, PostgreSqlDriver } from '@mikro-orm/postgresql'
import { EntityClass, FilterQuery, MikroORM, EntityRepository, RequiredEntityData, QueryOrderNumeric, wrap } from "@mikro-orm/core"
import { EventParam, AtomicDatabase, Collection, EventCollection, Event } from './storage'
import { __evm_blocks } from './storage/mikro-orm/meta/__evm_blocks'
import { Event as EventEntity } from './storage/mikro-orm/events/Event'

/*
	Best-typed ORM according to

	https://www.prisma.io/dataguide/database-tools/evaluating-type-safety-in-the-top-8-typescript-orms
*/

export async function validateSchema(orm: MikroORM<PostgreSqlDriver>)
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
		})
		if ((await generator.getUpdateSchemaSQL()).length > 0)
		{
			console.error("Schema is not up to date, migrate manually")
			process.exit(1)
		}
	}
	catch (e)
	{
		console.error(`Erorr trying to update schema! Migrate manually`)
		throw e
	}
}

async function upsert<T extends {}>(rep: EntityRepository<T>, where: FilterQuery<T>, data: T)
{
	let found = await rep.findOne(where)
	let e = found ? wrap(found).assign(data) : rep.create(data)
	
	rep.persist(e)

	return e
}

const getCollection = <T extends { blockNumber: number }>(
	blockNumber: number,
	repository: EntityRepository<T>,
	history: EntityRepository<RequiredEntityData<T>>,
	findById: (id: string) => FilterQuery<T>,
	getVersion: (entity: T | RequiredEntityData<T>) => number,
	withVersion: <U extends T | RequiredEntityData<T>>(entity: U, version: number) => U,
): Collection<T, FilterQuery<T>, RequiredEntityData<T>> =>
{
	return {
		load: id => repository.findOne(findById(id)),
		loadThrow: id => repository.findOneOrFail(findById(id)),
		findOne: query => repository.findOne(query),
		findOneThrow: query => repository.findOneOrFail(query),
		findMany: query => repository.find(query),
		create: async (id, data) => repository.create(data),
		async save(id, data)
		{
			let prevVersion = await repository.findOne(findById(id))
			// console.log(`Saving ${id} with version ${blockNumber} over ${prevVersion ? getVersion(prevVersion) : 'nothing'}`)
			if (prevVersion)
			{
				if (getVersion(prevVersion) != blockNumber)
				{
					let h = history.create(withVersion(prevVersion, blockNumber))
					history.persist(h)
				}
				repository.remove(prevVersion)
			}

			let n = repository.create({ ...data })
			repository.persist(n)
		},
	}
}

export const mikroOrmStorage = <
	Records extends Record<string, { blockNumber: number }>,
	Events extends Record<string, EventParam<string, {}>[]>,
>(
	timeTravelDepth: number = 20,
	orm: MikroORM<PostgreSqlDriver>,
	schema: { [key in keyof Records]: {
		byId: (id: string) => FilterQuery<Records[key]>,
		getId: (obj: Records[key] | RequiredEntityData<Records[key]>) => string,
		version: (obj: Records[key] | RequiredEntityData<Records[key]>) => number,
		withVersion: <U extends Records[key] | RequiredEntityData<Records[key]>>(obj: U, version: number) => U
		entity: EntityClass<Records[key]>,
		history: EntityClass<RequiredEntityData<Records[key]>>,
	} },
	events: { [key in keyof Events]: EntityClass<Event<Events[key]>> },
): AtomicDatabase<Records, Events, { [key in keyof Records]: FilterQuery<Records[key]> }, { [key in keyof Records]: RequiredEntityData<Records[key]> }> =>
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
			let x = schema[s]
			let rep = em.getRepository(x.entity)
			let hist = em.getRepository(x.history)
			
			let oldHistory = await hist.find({ blockNumber: { $gt: blockNumber } } as any)
			for (let h of oldHistory)
				hist.remove(h)

			let old = await rep.find({ blockNumber: { $gt: blockNumber } } as any)
			for (let o of old)
			{
				rep.remove(o)
				let historical = await hist.find(x.byId(x.getId(o)) as any, {
					orderBy: { blockNumber: QueryOrderNumeric.DESC },
					limit: 1
				} as any)
				if (historical.length)
					rep.persist(rep.create(historical[0]))
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
					return blocks
				},

			}
		},
	}
}
