import { Embeddable, Property, DecimalType, ArrayType } from "@mikro-orm/core"

@Embeddable()
export class MarsbaseBestbid__BBOfferParams
{
	@Property()
	tokenAlice!: string

	@Property({ type: DecimalType, precision: 78 })
	amountAlice!: string

	@Property({ type: ArrayType })
	tokensBob!: string[]

	@Property({ type: DecimalType, precision: 78 })
	feeAlice!: string

	@Property({ type: DecimalType, precision: 78 })
	feeBob!: string
}
