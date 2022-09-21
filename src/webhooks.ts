import type { BlockTransactionString } from "web3-eth"
import type { Transaction } from "web3-core"
import type { Event, EventParam } from "./storage"
import { Config } from "./indexer"

type WHContext = {
	block: BlockTransactionString
	tx: Transaction
}
type Webhook<
	Events extends Record<string, EventParam<string, unknown>[]>,
	Key extends keyof Events,
> =
	(e: Event<Events[Key]>, context: WHContext) => Promise<void>

export type Webhooks<Events extends Record<string, EventParam<string, unknown>[]>> = {
	[K in keyof Events]?: Webhook<Events, K>
}

export class WebhookQueue<Events extends Record<string, EventParam<string, unknown>[]>>
{
	queue: (() => Promise<unknown>)[] = []
	constructor(private config: Config<Events, any, any, any>, private onError: (e: unknown) => void)
	{
	}
	enqueue(contract: string, eventName: keyof Events, e: Event<Events[keyof Events]>, context: WHContext)
	{
		let wh = this.config.contracts[contract].webhooks[eventName]
		if (!wh)
			return
		
		let f = wh
		this.queue.push(() => f(e, context))
	}
	async fireAllWebhooks()
	{
		for (let f = this.queue.shift(); f; f = this.queue.shift())
		{
			try
			{
				await f()
			}
			catch (e)
			{
				console.error(`error while firing webhook: ${e}`)
				this.onError(e)
			}
		}
	}
}