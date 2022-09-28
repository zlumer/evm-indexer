import { Cascade, Entity, ManyToMany, ManyToOne, PrimaryKey, Property, OneToOne, OneToMany } from "@mikro-orm/core"
import { Address } from "./Address"
import { Offer } from "./Offer"

// model Bid {
@Entity()
export class Bid
{
    // bidId       String
	@PrimaryKey()
	bidId!: string

    // blockNumber BigInt
	@Property()
	blockNumber!: number

    // offerId String
	@Property()
	offerId!: string

    // bidIdx     String
	@Property()
	bidIdx!: string

    // bobAddress String
	@Property()
	bobAddress!: string

    // tokenBob   String
	@Property()
	tokenBobAddress!: string

    // amountBob  String
	@Property()
	amountBob!: string

	//     status       String
	@Property()
	status!: string

	@ManyToOne(() => Address, { fieldName: "bobAddress", cascade: [Cascade.PERSIST] },)
	bob?: Address

	@ManyToOne(() => Offer, { fieldName: "offerId", cascade: [Cascade.PERSIST] },)
	offer?: Offer

	// @ManyToOne(() => Address, { fieldName: "tokenBobAddress", cascade: [Cascade.PERSIST] },)
	// tokenBob?: Address
}

@Entity()
export class __evm__history__Bid
{
	
    // bidId       String
	@PrimaryKey()
	bidId!: string

    // blockNumber BigInt
	@Property()
	blockNumber!: number

    // offerId String
	@Property()
	offerId!: string

    // bidIdx     String
	@Property()
	bidIdx!: string

    // bobAddress String
	@Property()
	bobAddress!: string

    // tokenBob   String
	@Property()
	tokenBobAddress!: string

    // amountBob  String
	@Property()
	amountBob!: string

	//     status       String
	@Property()
	status!: string
}
