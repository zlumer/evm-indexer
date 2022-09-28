import { Embeddable, Property, Embedded } from "@mikro-orm/core"
import { MarsbaseBestbid__BBOfferParams } from "./MarsbaseBestbid__BBOfferParams"

@Embeddable()
export class MarsbaseBestbid__BBOffer
{
	@Property()
	active!: boolean

	@Property()
	id!: string

	@Property()
	aliceAddress!: string

	@Property()
	totalBidsCount!: string

	@Property()
	activeBidsCount!: string

	@Embedded()
	params!: MarsbaseBestbid__BBOfferParams
}
