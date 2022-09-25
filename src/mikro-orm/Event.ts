import { Entity, PrimaryKey, PrimaryKeyType, Property } from "@mikro-orm/core"

@Entity({ schema: "*" })
export class Event
{
	@PrimaryKey()
	blockHash!: string

	@PrimaryKey()
	txHash!: string

	@PrimaryKey()
	logIndex!: number

	[PrimaryKeyType]?: [string, string, number]

	@Property()
	address!: string

	@Property()
	name!: string

	@Property()
	fullName!: string

	@Property()
	topic!: string

	@Property()
	blockNumber!: number

	@Property({ type: "text" })
	data!: string

	@Property({ type: "json" })
	args!: any
}