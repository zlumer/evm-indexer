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

export function getNextChunk(
	blockHeight: number,
	startingBlock: number,
	batchSize: number
)
{
	let from = startingBlock
	let to = Math.min(from + batchSize, blockHeight)
	return { from, to }
}

export async function loadNextChunkLogsForContract(
	web3: Web3,
	address: string | string[],
	topics: string[],
	blockHeight: number,
	startingBlock: number,
	startingBatchSize: number,
)
{
	// let blockHeight = await web3.eth.getBlockNumber()

	// console.log(`block height: ${blockHeight}`)
	// let blockCount = blockHeight - startingBlock
	// console.log(`block count: ${blockCount}`)

	let chunk = getNextChunk(blockHeight, startingBlock, startingBatchSize)

	// console.log(`chunk: `, chunk)

	// console.log(`checking ${b.from}->${b.to} / ${blockHeight}`)
	let lastBlock = await web3.eth.getBlock(chunk.to)

	if (!lastBlock) // this means the chain is in the middle of a reorg
		return undefined

	let p = await web3.eth.getPastLogs({
		address: address,
		fromBlock: chunk.from,
		toBlock: chunk.to,
		topics: [topics]
	})
	// console.log(p)
	let groupedLogs = groupBy(p, x => x.blockHash)
	return {
		logsCount: p.length,
		groupedLogs,
		chunk,
		lastBlock,
	}
}
