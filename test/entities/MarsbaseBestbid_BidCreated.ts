import { Embeddable, Embedded, Entity, ManyToMany, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core"
import { Event } from "./Event"
import { MarsbaseBestbid__BBBid } from "./MarsbaseBestbid__BBBid"

@Entity()
export class MarsbaseBestbid_BidCreated_Args
{
	@PrimaryKey({ autoincrement: true })
	__evm__id!: number

	@Property()
	offerId!: string

	@Property()
	bobAddress!: string

	@Property()
	tokenBob!: string

	@Property()
	bidIdx!: string

	@Property()
	bidId!: string

	@Embedded()
	bid!: MarsbaseBestbid__BBBid
}

@Entity({
	discriminatorValue: "BidCreated(uint256,address,address,uint256,bytes32,(uint256,uint256,address,address,uint256))"
})
export class MarsbaseBestbid_BidCreated extends Event
{
	@ManyToMany({ pivotTable: "__evm__pivot_MarsbaseBestbid_BidCreated_Event_Args" })
	args!: MarsbaseBestbid_BidCreated_Args
}
