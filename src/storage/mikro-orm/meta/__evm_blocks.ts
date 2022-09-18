import { Entity, PrimaryKey, Property } from "@mikro-orm/core"

@Entity()
export class __evm_blocks
{
	@PrimaryKey()
	blockHash!: string

	@Property()
	blockNumber!: number
}
