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
import { Address } from "./Address"
import { ExBid } from "./ExBid"

@Entity({ schema: "*" })
export class ExOffer {
	@PrimaryKey()
	offerId!: string

	@Property()
	blockNumber!: number

	@ManyToOne(() => Address, {
		fieldName: "aliceAddress",
		cascade: [Cascade.PERSIST],
	})
	alice?: Address

	@Property()
	aliceAddress!: string

	@Property()
	amountAlice!: string

	@Property()
	amountAliceSold!: string

	@OneToMany(() => ExBid, (eb) => eb.offer, { cascade: [Cascade.PERSIST] })
	bids = new Collection<ExBid>(this)

	@Property()
	createdAt!: number

	@Property()
	deadline!: number

	@Property()
	feeAlice!: string

	@Property()
	feeBob!: string

	@Property()
	minimumSize!: string

	@Property()
	status!: string

	@Property()
	tokenAlice!: string

	@Property()
	tokensBob!: string

	@Property()
	tokensSent!: boolean

	@Property()
	totalBids!: number
}

@Entity({ schema: "*" })
export class __evm__history__ExOffer {
	@PrimaryKey()
	offerId!: string

	@PrimaryKey()
	blockNumber!: number

	@Property()
	aliceAddress!: string

	@Property()
	amountAlice!: string

	@Property()
	amountAliceSold!: string

	@Property()
	createdAt!: number

	@Property()
	deadline!: number

	@Property()
	feeAlice!: string

	@Property()
	feeBob!: string

	@Property()
	minimumSize!: string

	@Property()
	status!: string

	@Property()
	tokenAlice!: string

	@Property()
	tokensBob!: string

	@Property()
	tokensSent!: boolean

	@Property()
	totalBids!: number
}
