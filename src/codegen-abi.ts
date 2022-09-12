import { AbiItem, AbiInput } from "web3-utils"
import Web3 from "web3"
import prettier from "prettier"

let web3 = new Web3()

let prettierConfig: prettier.Config = {
	parser: "typescript",
	semi: false,
	useTabs: true,
	tabWidth: 4,
}

export function generate(contractName: string, abi: AbiItem[]): string
{
	let str = new CodegenAbiRough().generateEventsDescriptions(contractName, abi)
	return prettier.format(str, prettierConfig)
}

export class CodegenAbiRough
{
	STRUCTS = {} as Record<string, string>

	generateEventsDescriptions = (contractName: string, abi: AbiItem[]) =>
	{
		let events = abi.filter(x => x.type == "event") as (AbiItem & { type: "event" })[]
		let mainType = `export type ${contractName} = {${events.map(this.generateOneEvent).join('\n')}}`
		let structExport = stringifyGroups(groupStructsByNamespace(this.STRUCTS))
		return `${structExport}\n${mainType}`
	}
	getValue = (abi: AbiInput) =>
	{
		if (abi.internalType?.startsWith("struct "))
		{
			console.log(abi.internalType)
			let name = abi.internalType.replace("struct ", "")
			if (this.STRUCTS[name])
				return name

			this.STRUCTS[name] = solTypeToTsType(abi.type, abi.components)
			return name
		}
		// return `"${abi.type}/${abi.internalType}"`
		let types = solTypeToTsType(abi.type, abi.components)
		return types
	}
	generateOneEvent = (abi: AbiItem) =>
	{
		let topic = web3.eth.abi.encodeEventSignature(abi)
		let fullName = (web3.utils as any)._jsonInterfaceMethodToString(abi)
		let inputs = abi.inputs?.map(x => `{ name: "${x.name}", value: ${this.getValue(x)} },`)
		return (`
	// ${fullName}
	"${topic}": [
		${inputs?.join('\n\t\t')}
	],`
		)
	}
}

function groupStructsByNamespace<T>(structs: Record<string, T>)
{
	let groups = {} as Record<string, Record<string, T>>
	for (let fullName in structs)
	{
		let [ns, shortName] = fullName.includes(".") ? fullName.split(".") : ["", fullName]
		groups[ns] ||= {}
		groups[ns][shortName] = structs[fullName]
	}
	return groups
}
function stringifyGroups(groups: Record<string, Record<string, string>>)
{
	let result: string[] = []
	let nsKeys = Object.keys(groups).sort()
	for (let ns of nsKeys)
	{
		let structKeys = Object.keys(groups[ns]).sort()

		let interfaces = structKeys.map(x => `export interface ${x} ${groups[ns][x]}`)
		if (!ns)
			result.push(interfaces.join('\n'))
		else
			result.push(`export namespace ${ns} {
				${interfaces.join('\n')}
			}`)
	}
	return result
}

// adapted code from 0x abi-gen
// 0x = ❤️
// https://github.com/0xProject/tools/blob/d5c52f0ae55f41ec502c7e93211e34944dd2a589/abi-gen/src/utils.ts#L49
export function solTypeToTsType(solType: string, components?: AbiInput[]): string
{
	const trailingArrayRegex = /\[\d*\]$/
	if (solType.match(trailingArrayRegex))
	{
		const arrayItemSolType = solType.replace(trailingArrayRegex, '')
		const arrayItemTsType = solTypeToTsType(arrayItemSolType, components)
		const arrayTsType =
			isUnionType(arrayItemTsType) || isObjectType(arrayItemTsType)
				? `Array<${arrayItemTsType}>`
				: `${arrayItemTsType}[]`
		return arrayTsType
	} else
	{
		const solTypeRegexToTsType = [
			{ regex: '^string$', tsType: 'string' },
			{ regex: '^address$', tsType: 'string' },
			{ regex: '^bool$', tsType: 'boolean' },
			{ regex: '^u?int\\d*$', tsType: 'string' },
			{ regex: '^bytes\\d*$', tsType: 'string' },
		]

		// // web3 and ethers allow to pass those as numbers instead of bignumbers
		// solTypeRegexToTsType.unshift({
		// 	regex: '^u?int(8|16|32)?$',
		// 	tsType: 'number|BigNumber',
		// })
		for (const regexAndTxType of solTypeRegexToTsType)
		{
			const { regex, tsType } = regexAndTxType
			if (solType.match(regex))
			{
				return tsType
			}
		}
		const TUPLE_TYPE_REGEX = '^tuple$'
		if (solType.match(TUPLE_TYPE_REGEX))
		{
			const componentsType = components?.map(component =>
			{
				const componentValueType = solTypeToTsType(
					component.type,
					component.components,
				)
				const componentType = `${component.name}: ${componentValueType}`
				return componentType
			})
			const tsType = `{ ${componentsType?.join(', ')} }`
			return tsType
		}
		throw new Error(`Unknown Solidity type found: ${solType}`)
	}
}
export function isUnionType(tsType: string): boolean
{
	return tsType.includes("|")
}
export function isObjectType(tsType: string): boolean
{
	return /^{.*}$/.test(tsType)
}
