import { Entity, PrimaryKey, Property } from "@mikro-orm/core"

@Entity({ schema: "*" })
export class __evm_blocks
{
	@PrimaryKey()
	blockHash!: string

	@Property()
	blockNumber!: number
}
