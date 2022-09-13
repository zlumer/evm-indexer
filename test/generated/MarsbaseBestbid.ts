export namespace IMarsbaseBestBid {
	export interface BBBid {
		offerId: string
		bidIdx: string
		bobAddress: string
		tokenBob: string
		amountBob: string
	}
	export interface BBOffer {
		active: boolean
		id: string
		aliceAddress: string
		params: {
			tokenAlice: string
			amountAlice: string
			tokensBob: string[]
			feeAlice: string
			feeBob: string
		}
		totalBidsCount: string
		activeBidsCount: string
	}
	export interface BBOfferParams {
		tokenAlice: string
		amountAlice: string
		tokensBob: string[]
		feeAlice: string
		feeBob: string
	}
}
export type MarsbaseBestbid = {
	// BidAccepted(uint256,address,uint256,uint256,uint256,uint256,(bool,uint256,address,(address,uint256,address[],uint256,uint256),uint256,uint256),(uint256,uint256,address,address,uint256))
	"0x07a0c38b538343b8de726f8cd188d2ef18693286f1ebceefda2d8a2b49fe1642": [
		{ name: "id"; value: string },
		{ name: "aliceAddress"; value: string },
		{ name: "aliceReceivedTotal"; value: string },
		{ name: "aliceFeeTotal"; value: string },
		{ name: "bobReceivedTotal"; value: string },
		{ name: "bobFeeTotal"; value: string },
		{ name: "offer"; value: IMarsbaseBestBid.BBOffer },
		{ name: "bid"; value: IMarsbaseBestBid.BBBid }
	]

	// BidCancelled(uint256,address,address,uint8,uint256,bytes32,(uint256,uint256,address,address,uint256))
	"0x394db9698a101ce2339695d33ddff66e399a792ac64e529d270297bf637d459c": [
		{ name: "offerId"; value: string },
		{ name: "bobAddress"; value: string },
		{ name: "tokenBob"; value: string },
		{ name: "reason"; value: string },
		{ name: "bidIdx"; value: string },
		{ name: "bidId"; value: string },
		{ name: "bid"; value: IMarsbaseBestBid.BBBid }
	]

	// BidCreated(uint256,address,address,uint256,bytes32,(uint256,uint256,address,address,uint256))
	"0x251eb44a58e51aaca9c6fd37e7ea841675bde0aa89166bbe7f53ced3bce0830e": [
		{ name: "offerId"; value: string },
		{ name: "bobAddress"; value: string },
		{ name: "tokenBob"; value: string },
		{ name: "bidIdx"; value: string },
		{ name: "bidId"; value: string },
		{ name: "bid"; value: IMarsbaseBestBid.BBBid }
	]

	// OfferClosed(uint256,address,uint8,(bool,uint256,address,(address,uint256,address[],uint256,uint256),uint256,uint256))
	"0x4e3b99cbdb847d983244b1224fc11819f8aa93c57eef1dd5910368bff74115d7": [
		{ name: "id"; value: string },
		{ name: "aliceAddress"; value: string },
		{ name: "reason"; value: string },
		{ name: "offer"; value: IMarsbaseBestBid.BBOffer }
	]

	// OfferCreated(uint256,address,address,(address,uint256,address[],uint256,uint256))
	"0x19d1f9dc6c04d1d8eb9182a087f0ff2a22f6e744ae25151016543e0e44e5732a": [
		{ name: "id"; value: string },
		{ name: "aliceAddress"; value: string },
		{ name: "tokenAlice"; value: string },
		{ name: "params"; value: IMarsbaseBestBid.BBOfferParams }
	]
}

export const MarsbaseBestbidParser = {
	"0x19d1f9dc6c04d1d8eb9182a087f0ff2a22f6e744ae25151016543e0e44e5732a": [

	]
}
