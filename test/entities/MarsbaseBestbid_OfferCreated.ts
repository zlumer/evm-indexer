import { Embeddable, Embedded, Entity, ManyToMany, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core"
import { Event } from "./Event"
import { MarsbaseBestbid__BBOfferParams } from "./MarsbaseBestbid__BBOfferParams"

@Entity()
export class MarsbaseBestbid_OfferCreated_Args
{
	@PrimaryKey({ autoincrement: true })
	__evm__id!: number

	@Property()
	id!: string

	@Property()
	aliceAddress!: string

	@Property()
	tokenAlice!: string

	@Embedded()
	params!: MarsbaseBestbid__BBOfferParams
}

@Entity({
	discriminatorValue: "OfferCreated(uint256,address,address,(address,uint256,address[],uint256,uint256))"
})
export class MarsbaseBestbid_OfferCreated extends Event
{
	@ManyToMany({ pivotTable: "__evm__pivot_MarsbaseBestbid_OfferCreated_Event_Args" })
	args!: MarsbaseBestbid_OfferCreated_Args
}
