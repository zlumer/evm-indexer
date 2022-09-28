import { Cascade, Collection, Entity, OneToMany, PrimaryKey, Property } from "@mikro-orm/core"
import { Offer } from "./Offer"

@Entity()
export class Address
{
	@PrimaryKey()
	@Property()
	address!: string

	@Property()
	blockNumber!: number
	
	@OneToMany(() => Offer, offer => offer.alice, { cascade: [Cascade.PERSIST] })
	offers = new Collection<Offer>(this)

	@Property()
	tradedWith!: string[]
}

@Entity()
export class __evm__history__Address
{
	@PrimaryKey()
	@Property()
	address!: string

	@PrimaryKey()
	@Property()
	blockNumber!: number

	@Property()
	tradedWith!: string[]
}
