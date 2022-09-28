import { Embeddable, Property } from "@mikro-orm/core"

@Embeddable()
export class MarsbaseBestbid__BBBid
{
	@Property()
	offerId!: string

	@Property()
	bidIdx!: string

	@Property()
	bobAddress!: string

	@Property()
	tokenBob!: string

	@Property()
	amountBob!: string
}
