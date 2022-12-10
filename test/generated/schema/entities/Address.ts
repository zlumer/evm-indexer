import {
	Cascade,
	Entity,
	ManyToOne,
	PrimaryKey,
	Property,
	Collection,
	OneToOne,
	OneToMany,
} from "@mikro-orm/core"
import { ExOffer } from "./ExOffer"
import { ExBid } from "./ExBid"

@Entity({ schema: "*" })
export class Address {
	@PrimaryKey()
	address!: string

	@Property()
	blockNumber!: number

	@OneToMany(() => ExBid, (eb) => eb.bob, { cascade: [Cascade.PERSIST] })
	exBids = new Collection<ExBid>(this)

	@OneToMany(() => ExOffer, (eo) => eo.alice, { cascade: [Cascade.PERSIST] })
	exOffers = new Collection<ExOffer>(this)

	@Property()
	tradedWith!: String[]
}

@Entity({ schema: "*" })
export class __evm__history__Address {
	@PrimaryKey()
	address!: string

	@PrimaryKey()
	blockNumber!: number

	@Property()
	tradedWith!: String[]
}
