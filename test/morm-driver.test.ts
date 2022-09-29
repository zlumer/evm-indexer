import { describe, it } from "@jest/globals"

import { EntityCaseNamingStrategy, MikroORM } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import { TsMorphMetadataProvider } from "@mikro-orm/reflection"

import { Event as EventEntity } from "../src/mikro-orm/Event"
import { __evm_blocks } from "../src/mikro-orm/__evm_blocks"
import { Offer, __evm__history__Offer } from "./entities/Offer"
import { Address, __evm__history__Address } from "./entities/Address"
import { Bid, __evm__history__Bid } from "./entities/Bid"
import { mikroOrmStorage, validateSchema } from "../src/storage-mikroorm"

const DB_URL = "postgresql://postgres:password@localhost:5432/postgres?sslmode=disable"

let ORMS: MikroORM<PostgreSqlDriver>[] = []
const createOrm = async (schema: string) =>
{
	let orm = await MikroORM.init<PostgreSqlDriver>({
		type: "postgresql",
		schema,
		// driverOptions: { connection: { ssl: { rejectUnauthorized: false } } },
		namingStrategy: EntityCaseNamingStrategy,
		metadataProvider: TsMorphMetadataProvider,
		clientUrl: DB_URL,
		entities: [
			__evm_blocks,
			EventEntity,
			Offer, __evm__history__Offer,
			Address, __evm__history__Address,
			Bid, __evm__history__Bid,
		],
	})
	ORMS.push(orm)
	return orm
}
const cleanupOrms = async () =>
{
	let promises = ORMS.map(async orm =>
	{
		await orm.schema.dropSchema()
		orm.close(true)
	})
	ORMS = []

	await Promise.all(promises)
}
const randomSchemaName = () => "testschema" + Math.random().toString(36).substring(2)

const expectReject = <T>(p: Promise<T>, msg = "Expected promise to reject") => p.then(() => { throw new Error(msg) }, () => { })

describe("MikroORM driver basic tests", () =>
{
	afterAll(cleanupOrms)
	it("should be able to connect to the database", async () =>
	{
		let orm = await createOrm(randomSchemaName())
		let result = await orm.em.getConnection().execute("SELECT 1 as hello;")
		expect(result).toEqual([{ "hello": 1 }])
	})
	it("should migrate schema on empty db", async () => 
	{
		let schemaName = randomSchemaName()
		let orm = await createOrm(schemaName)
		await validateSchema(orm, schemaName)
	})
	it("should require schema migration on non-empty db", async () => 
	{
		let schemaName = randomSchemaName()
		let orm = await createOrm(schemaName)
		await validateSchema(orm, schemaName)
		let con = orm.em.getConnection()
		await con.execute(`ALTER TABLE "${schemaName}"."__evm_blocks" ADD COLUMN "test" TEXT;`)

		await expectReject(validateSchema(orm, schemaName))
	})
})
const stopwatch = (timerName: string, autoDump = true) =>
{
	let start = Date.now()
	let lapStart = start
	let logs = [`[${timerName}] started`]
	function dump()
	{
		if (!logs.length)
			return
		
		console.log(logs.join("\n"))
		logs = []
	}
	function log(msg: string)
	{
		logs.push(msg)
		if (autoDump)
			dump()
	}
	return {
		lap: (msg: string) =>
		{
			let now = Date.now()
			let duration = now - lapStart
			log(`[${timerName}] ${msg}: ${duration / 1000}s`)
			lapStart = now
		},
		finish: () =>
		{
			let now = Date.now()
			let duration = now - start
			log(`[${timerName}] total: ${duration / 1000}s`)
			dump()
		},
		dump,
	}
}
describe("MikroORM entity handling", () =>
{
	afterAll(cleanupOrms)
	async function createStorage(schema: string)
	{
		let orm = await createOrm(schema)
		await validateSchema(orm, schema)
		let storage = mikroOrmStorage(10, orm, {
			Offer: {
				entity: Offer,
				history: __evm__history__Offer,
				byId: id => ({ offerId: id }),
				getId: x => x.offerId,
				version: x => x.blockNumber,
				withVersion: (x, blockNumber) => ({ ...x, blockNumber }),
			},
			Address: {
				entity: Address,
				history: __evm__history__Address,
				byId: id => ({ address: id }),
				getId: x => x.address,
				version: x => x.blockNumber,
				withVersion: (x, blockNumber) => ({ ...x, blockNumber }),
			},
		}, {})
		return { orm, storage }
	}
	it("should find entity in next tx", async () =>
	{
		let timer = stopwatch("should find entity in next tx")
		let schemaName = randomSchemaName()
		let { orm, storage } = await createStorage(schemaName)
		timer.lap(`storage created`)
		let tx1 = await storage.startTransaction(1, "0x1")
		await tx1.commit()
		timer.lap("tx1")

		let tx2 = await storage.startTransaction(2, "0x2")
		await tx2.collection("Address").create("Alice", {
			address: "Alice",
			tradedWith: [],
		})
		await tx2.commit()
		timer.lap("tx2")

		let tx3 = await storage.startTransaction(3, "0x3")
		let alice = await tx3.collection("Address").loadThrow("Alice")
		expect(alice).toMatchObject({
			address: "Alice",
			tradedWith: [],
		})
		await tx3.rollback()
		timer.lap("tx3")
		timer.finish()
	})
	it("should find entity in same tx", async () =>
	{
		// console.log("should find entity in same tx")
		let schemaName = randomSchemaName()
		let { orm, storage } = await createStorage(schemaName)
		let tx1 = await storage.startTransaction(1, "0x1")
		await tx1.commit()

		let tx2 = await storage.startTransaction(2, "0x2")
		await tx2.collection("Address").create("Alice", {
			address: "Alice",
			tradedWith: [],
		})
		expect(await tx2.collection("Address").loadThrow("Alice")).toMatchObject({
			address: "Alice",
			tradedWith: [],
		})
		await tx2.commit()
	})
	it("should revert entity change in the same block", async () =>
	{
		// console.log("should revert entity change in the same block")
		let schemaName = randomSchemaName()
		let { orm, storage } = await createStorage(schemaName)
		await storage.startTransaction(1, "0x1").then(tx => tx.commit())

		await storage.startTransaction(2, "0x2").then(async tx =>
		{
			let alice = await tx.collection("Address").create("Alice", {
				address: "Alice",
				tradedWith: [],
			})
			alice.tradedWith = ["Bob"]
			await tx.collection("Address").save("Alice", alice)
			return tx.commit()
		})

		await storage.startTransaction(3, "0x3").then(async tx =>
		{
			expect(await tx.collection("Address").loadThrow("Alice")).toMatchObject({
				address: "Alice",
				tradedWith: ["Bob"],
			})
			return tx.rollback()
		})
	}, 10000)
	it("should revert entity change in the next block", async () =>
	{
		// console.log("should revert entity change in the same block")
		let schemaName = randomSchemaName()
		let { orm, storage } = await createStorage(schemaName)
		await storage.startTransaction(1, "0x1").then(tx => tx.commit())

		await storage.startTransaction(2, "0x2").then(async tx =>
		{
			let alice = await tx.collection("Address").create("Alice", {
				address: "Alice",
				tradedWith: [],
			})
			alice.tradedWith = ["Bob"]
			await tx.collection("Address").save("Alice", alice)
			return tx.commit()
		})
		// await printAllEntities(orm)

		await storage.startTransaction(3, "0x3").then(async tx =>
		{
			expect(await tx.collection("Address").loadThrow("Alice")).toMatchObject({
				address: "Alice",
				tradedWith: ["Bob"],
			})
			return tx.rollback()
		})
		// await printAllEntities(orm)

		await storage.startTransaction(3, "0x3").then(async tx =>
		{
			let alice = await tx.collection("Address").loadThrow("Alice", "write")
			alice.tradedWith = ["Bob", "Charlie"]
			await tx.collection("Address").save("Alice", alice)
			expect(await tx.collection("Address").loadThrow("Alice")).toMatchObject({
				address: "Alice",
				tradedWith: ["Bob", "Charlie"],
			})
			return tx.commit()
		})
		// await printAllEntities(orm)

		await storage.startMetaTransaction().then(async mtx =>
		{
			await mtx.revertToBlock(2)
			return mtx.commit()
		})
		// await printAllEntities(orm)

		await storage.startTransaction(3, "0x3").then(async tx =>
		{
			expect(await tx.collection("Address").loadThrow("Alice")).toMatchObject({
				address: "Alice",
				tradedWith: ["Bob"],
			})
			return tx.rollback()
		})
	}, 10000)
	const printAllEntities = async (orm: MikroORM) =>
	{
		let em = orm.em.fork()
		let addresses = await em.getRepository(Address).findAll()
		let addressHistory = await em.getRepository(__evm__history__Address).findAll()
		console.log("addresses", addresses)
		console.log("addressHistory", addressHistory)
	}
	it("should revert entity creation", async () =>
	{
		// console.log("should revert entity creation")
		let schemaName = randomSchemaName()
		let { orm, storage } = await createStorage(schemaName)
		let tx1 = await storage.startTransaction(1, "0x1")
		await tx1.commit()

		let tx2 = await storage.startTransaction(2, "0x2")
		await tx2.collection("Address").create("Alice", {
			address: "Alice",
			tradedWith: [],
		})
		expect(await tx2.collection("Address").loadThrow("Alice")).toMatchObject({
			address: "Alice",
			tradedWith: [],
		})
		await tx2.commit()

		let metaTx = await storage.startMetaTransaction()
		await metaTx.revertToBlock(1)
		await metaTx.commit()

		let tx3 = await storage.startTransaction(3, "0x3")

		expect(await tx3.collection("Address").load("Alice")).toBeFalsy()
	}, 10000)
	it("should revert block after entity creation", async () =>
	{
		// console.log("should revert block after entity creation")
		let schemaName = randomSchemaName()
		let { orm, storage } = await createStorage(schemaName)
		let tx1 = await storage.startTransaction(1, "0x1")
		await tx1.commit()

		let tx2 = await storage.startTransaction(2, "0x2")
		await tx2.collection("Address").create("Alice", {
			address: "Alice",
			tradedWith: [],
		})
		expect(await tx2.collection("Address").loadThrow("Alice")).toMatchObject({
			address: "Alice",
			tradedWith: [],
		})
		await tx2.commit()

		let tx3 = await storage.startTransaction(3, "0x3")
		await tx3.commit()

		let metaTx = await storage.startMetaTransaction()
		await metaTx.revertToBlock(2)
		await metaTx.commit()

		let tx3_1 = await storage.startTransaction(3, "0x3")
		expect(await tx3_1.collection("Address").loadThrow("Alice")).toMatchObject({
			address: "Alice",
			tradedWith: [],
		})
	}, 10000)
})
