import { Cascade, Entity, ManyToOne, PrimaryKey, Property, Collection, OneToOne, OneToMany } from "@mikro-orm/core"
import { Address } from "./Address"
import { Bid } from "./Bid"

// model Offer {
@Entity()
export class Offer
{
	//     offerId     String
	@PrimaryKey()
	offerId!: string

	//     blockNumber BigInt
	@Property()
	blockNumber!: number

	//     status       String
	@Property()
	status!: string

	//     aliceAddress String
	@Property()
	aliceAddress!: string

	@ManyToOne(() => Address, { fieldName: "aliceAddress", cascade: [Cascade.PERSIST] },)
	alice?: Address

	//     tokenAlice   String
	@Property()
	tokenAlice!: string

	//     tokensBob    String[]
	@Property()
	tokensBob!: string[]

	//     totalBids Int
	@Property()
	totalBids!: number

	//     acceptedBidId String?
	@Property()
	acceptedBidId?: string

	@ManyToOne(() => Bid, { fieldName: "acceptedBidId", cascade: [Cascade.PERSIST] })
	acceptedBid?: Bid

	@OneToMany(() => Bid, bid => bid.offer, { cascade: [Cascade.PERSIST] })
	bids? = new Collection<Bid>(this)
}

@Entity()
export class __evm__history__Offer
{
	//     offerId     String
	@PrimaryKey()
	offerId!: string

	//     blockNumber BigInt
	@PrimaryKey()
	blockNumber!: number

	//     status       String
	@Property()
	status!: string

	//     aliceAddress String
	@Property()
	aliceAddress!: string

	// @ManyToOne(() => Address, { fieldName: "aliceAddress", cascade: [Cascade.PERSIST] },)
	// alice?: Address

	//     tokenAlice   String
	@Property()
	tokenAlice!: string

	//     tokensBob    String[]
	@Property()
	tokensBob!: string[]

	//     totalBids Int
	@Property()
	totalBids!: number

	//     acceptedBidId String?
	@Property()
	acceptedBidId?: string
}
