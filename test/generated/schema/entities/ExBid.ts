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
import { ExOffer } from "./ExOffer"

@Entity({ schema: "*" })
export class ExBid {
	@PrimaryKey()
	bidId!: string

	@Property()
	blockNumber!: number

	@Property()
	amountAliceReceived!: string

	@Property()
	amountBobReceived!: string

	@ManyToOne(() => Address, {
		fieldName: "bobAddress",
		cascade: [Cascade.PERSIST],
	})
	bob?: Address

	@Property()
	bobAddress!: string

	@Property()
	feeAlice!: string

	@Property()
	feeBob!: string

	@ManyToOne(() => ExOffer, {
		fieldName: "offerId",
		cascade: [Cascade.PERSIST],
	})
	offer?: ExOffer

	@Property()
	offerId!: string

	@Property()
	timestamp!: number

	@Property()
	tokenAliceAddress!: string

	@Property()
	tokenBobAddress!: string
}

@Entity({ schema: "*" })
export class __evm__history__ExBid {
	@PrimaryKey()
	bidId!: string

	@PrimaryKey()
	blockNumber!: number

	@Property()
	amountAliceReceived!: string

	@Property()
	amountBobReceived!: string

	@Property()
	bobAddress!: string

	@Property()
	feeAlice!: string

	@Property()
	feeBob!: string

	@Property()
	offerId!: string

	@Property()
	timestamp!: number

	@Property()
	tokenAliceAddress!: string

	@Property()
	tokenBobAddress!: string
}
