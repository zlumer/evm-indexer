import Web3 from "web3"
import type { Log } from "web3-core"

const splitBlocksToChunks = (blocks: { from: number, to: number }, limit = 1999) =>
{
	let amount = blocks.to - blocks.from
	if (amount <= limit)
		return [blocks]

	let result = []
	for (let from = blocks.from; from < blocks.to; from += limit)
	{
		let to = from + limit - 1
		if (blocks.to < to)
			to = blocks.to
		result.push({ from, to })
	}
	return result
}

function groupBy<T>(arr: T[], by: (x: T) => string | number): T[][]
{
	let result: T[][] = []
	let idxMap: Record<string | number, number> = {}
	for (let i = 0; i < arr.length; i++)
	{
		let val = arr[i]
		let key = by(val)
		if (!(key in idxMap))
		{
			idxMap[key] = result.length
			result.push([])
		}
		let idx = idxMap[key]
		result[idx].push(val)
	}
	return result
}

export async function loadLogsForContract(
	web3: Web3,
	address: string | string[],
	topics: string[],
	startingBlock: number,
	startingBatchSize: number,
	onLogFound: (blockNumber: number, logs: Log[]) => Promise<void>
)
{
	let blockHeight = await web3.eth.getBlockNumber()

	console.log(`block height: ${blockHeight}`)
	console.log(`block count: ${blockHeight - startingBlock}`)

	let blocks = splitBlocksToChunks({ from: startingBlock, to: blockHeight }, startingBatchSize)
	let startTime = Date.now()
	let total = {
		blocksScanned: blockHeight - startingBlock,
		logsFound: 0,
		blocksWithLogs: 0,
	}
	for (let b of blocks)
	{
		// console.log(`checking ${b.from}->${b.to} / ${blockHeight}`)
		let p = await web3.eth.getPastLogs({
			address: address,
			fromBlock: b.from,
			toBlock: b.to,
			topics: [topics]
		})
		// console.log(p)
		let groupedLogs = groupBy(p, x => x.blockHash)
		for (let group of groupedLogs)
		{
			await onLogFound(group[0].blockNumber, group)
		}
		total.logsFound += p.length
		total.blocksWithLogs += groupedLogs.length
	}
	return {
		...total,
		duration: (Date.now() - startTime) / 1000
	}
}
