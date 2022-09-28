import { Embedded, Entity, ManyToMany, PrimaryKey, Property } from "@mikro-orm/core"
import { Event } from "./Event"
import { MarsbaseBestbid__BBBid } from "./MarsbaseBestbid__BBBid"
import { MarsbaseBestbid__BBOffer } from "./MarsbaseBestbid__BBOffer"

@Entity()
export class MarsbaseBestbid_BidAccepted_Args
{
	@PrimaryKey({ autoincrement: true })
	__evm__id!: number

	@Property()
	id!: string

	@Property()
	aliceAddress!: string

	@Property()
	aliceReceivedTotal!: string

	@Property()
	aliceFeeTotal!: string

	@Property()
	bobReceivedTotal!: string

	@Property()
	bobFeeTotal!: string

	@Embedded()
	offer!: MarsbaseBestbid__BBOffer

	@Embedded()
	bid!: MarsbaseBestbid__BBBid
}

@Entity({
	discriminatorValue: "BidAccepted(indexed uint256,indexed address,uint256,uint256,uint256,uint256,(bool,uint256,address,(address,uint256,address[],uint256,uint256),uint256,uint256),(uint256,uint256,address,address,uint256))"
})
export class MarsbaseBestbid_BidAccepted extends Event
{
	@ManyToMany({ pivotTable: "__evm__pivot_MarsbaseBestbid_BidAccepted_Event_Args" })
	args!: MarsbaseBestbid_BidAccepted_Args
}
