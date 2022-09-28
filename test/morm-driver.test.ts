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

const ORMS: MikroORM<PostgreSqlDriver>[] = []
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
const randomSchemaName = () => "testschema" + Math.random().toString(36).substring(2)

const expectReject = <T>(p: Promise<T>, msg = "Expected promise to reject") => p.then(() => { throw new Error(msg) }, () => { })

describe("MikroORM driver basic tests", () =>
{
	afterAll(async () =>
	{
		for (let orm of ORMS)
			await orm.close(true)
	})
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
