import { Embedded, Entity, ManyToMany, PrimaryKey, Property } from "@mikro-orm/core"
import { Event } from "./Event"
import { MarsbaseBestbid__BBOffer } from "./MarsbaseBestbid__BBOffer"

@Entity()
export class MarsbaseBestbid_OfferClosed_Args
{
	@PrimaryKey({ autoincrement: true })
	__evm__id!: number

	@Property()
	id!: string

	@Property()
	aliceAddress!: string

	@Property()
	reason!: string

	@Embedded()
	offer!: MarsbaseBestbid__BBOffer
}

@Entity({
	discriminatorValue: "OfferClosed(uint256,address,uint8,(bool,uint256,address,(address,uint256,address[],uint256,uint256),uint256,uint256))"
})
export class MarsbaseBestbid_OfferClosed extends Event
{
	@ManyToMany({ pivotTable: "__evm__pivot_MarsbaseBestbid_OfferClosed_Event_Args" })
	args!: MarsbaseBestbid_OfferClosed_Args
}
