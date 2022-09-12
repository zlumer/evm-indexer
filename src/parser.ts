import type { AbiInput } from "web3-utils"

export const splitWeb3Result = <
	NamedArgs extends Record<string, unknown>,
>(result: any, abi: AbiInput[]):
		{
			obj: NamedArgs,
			arr: unknown[],
		} =>
{
	// console.log(result, abi)
	let obj = {} as any
	let arr = []
	for (let i = 0; i < abi.length; i++)
	{
		let val = result[i]
		let input = abi[i]
		// console.log(`${i}.${input.name}: ${input.type}`)
		if (input.type == "tuple")
		{
			let res = splitWeb3Result(val, input.components!)
			arr[i] = res.arr
			obj[input.name] = res.obj
		}
		else
		{
			arr[i] = val
			obj[input.name] = val
		}
	}
	return { obj, arr } as any
}
