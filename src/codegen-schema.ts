import yaml from "yaml"
import prettier from "prettier"
import { removeDuplicates } from "./collection-utils"

let prettierConfig: prettier.Config = {
	parser: "typescript",
	semi: false,
	useTabs: true,
	tabWidth: 4,
}

// TODO:
// - check for invalid type names
// - check for duplicate field names

export function generate(schemaStr: string, pathToEntities = "./entities")
{
	let schema = yaml.parse(schemaStr)
	console.log(schema)
	let entityNames = Object.keys(schema)
	let entities = entityNames.map(name => ({
		name,
		code: prettier.format(generateEntity(name, schema[name]), prettierConfig)
	}))

	return {
		entities,
		storageFile: prettier.format(generateStorageFile(schema, pathToEntities), prettierConfig),
	}
}
function parseFields(fields: Record<string, string>)
{
	return Object.entries(fields).map(([key, value]) => parseStringToField(key, value))
}
function getIdFieldName(fields: Record<string, string>)
{
	return parseFields(fields).find(x => x._kind == "pkey")?.name
}
function assertNotNull<T>(t: T, msg: string = ""): NonNullable<T>
{
	if ((t === null) || (typeof t == "undefined"))
		throw new Error(`Assertion failed: ${msg}`)

	return t
}
function generateStorageFile(schema: Record<string, Record<string, string>>, pathToEntities: string)
{
	let entityNames = Object.keys(schema)
	let entities = entityNames.map(name => ({
		name,
		id: assertNotNull(getIdFieldName(schema[name]), `Entity ${name} has no id field`),
	}))
	return templatesAggregate.fullStorageFileTemplate(entities, pathToEntities)
}
function generateEntity(name: string, fields: Record<string, string>)
{
	let parsedFields = parseFields(fields)
	let entity = templates.fullEntity(name, parsedFields, false)
	let history = templates.fullEntity(name, parsedFields, true)
	return linebreaks(
		templates.imports.mikroOrm,
		getAllReferencedTypes(parsedFields).map(templates.imports.type).join('\n'),
		"\n",
		entity,
		"\n",
		history,
	)
}

function linebreaks(...lines: string[])
{
	return lines.join('\n')
}

function parseStringToField(key: string, value: string): Field
{
	const extractFromBrackets = (str: string) => annotation.match(/\((.*)\)/)?.[1] ?? ""
	const removeQuotes = (x: string) => x.replace(/"/g, '')

	let match = value.match(/^(\S+)\s?(.*)$/)
	if (!match)
		throw new Error(`Invalid field "${key}" type: ${value}`)

	// console.log(match)

	let [, type, annotation] = match
	// console.log(type, annotation)
	let nullable = type.endsWith('?')
	type = type.replace('?', '')
	if (!annotation)
		return {
			_kind: "basic",
			name: key,
			type,
			nullable,
		}

	if (annotation.startsWith('@id'))
		return {
			_kind: "pkey",
			name: key,
			type,
		}

	let args = extractFromBrackets(annotation).trim()
	if (annotation.startsWith('@link'))
		return {
			_kind: "link",
			name: key,
			type,
			field: removeQuotes(args),
		}
	if (annotation.startsWith('@many'))
		return {
			_kind: "many",
			name: key,
			type: templates.removeArrayPostfix(type),
			on: removeQuotes(args),
		}

	throw new Error(`Invalid annotation: ${annotation}\n${key}\n${value}`)
}
function getAllReferencedTypes(fields: Field[])
{
	let types = fields
		.filter(x => (x._kind != "basic") && (x._kind != "pkey"))
		.map(x => x.type)
		.map(templates.removeArrayPostfix)
		.filter(x => !(templates.types as any)[x])

	return removeDuplicates(types)
}

type Field = {
	_kind: "pkey"
	name: string
	type: string
} | {
	_kind: "basic"
	name: string
	type: string
	nullable?: boolean
} | {
	_kind: "link"
	name: string
	type: string
	field: string
} | {
	_kind: "many"
	name: string
	type: string
	on: string
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)

const templates = {
	fullEntity: (name: string, fields: Field[], history: boolean) =>
	{
		let pkeys = fields.filter(x => x._kind == "pkey").sort(byName)
		let rest = fields.filter(x => x._kind != "pkey").sort(byName)
		let bn = {
			_kind: history ? "pkey" : "basic",
			name: "blockNumber",
			type: "Int",
		} as const

		if (history)
			pkeys.push(bn)
		else
			rest.unshift(bn)

		if (history)
			rest = rest.filter(x => (x._kind != "many") && (x._kind != "link"))

		let sortedFields = [...pkeys, ...rest]

		let code = sortedFields.map(templates.fieldToCode).join('\n\n')
		if (history)
			name = templates.entityHistory(name)

		return templates.entity(name, code)
	},

	entity: (name: string, content: string) => `
		@Entity({ schema: "*" })
		export class ${name}
		{
			${content}
		}
	`,

	entityHistory: (name: string) => `__evm__history__${name}`,

	fields: {
		pkey: (name: string, type: string) =>
			`@PrimaryKey()\n${name}!: ${type}`,

		prop: (name: string, type: string, nullable: boolean) =>
			`@Property()\n${name}${nullable ? "?" : "!"}: ${type}`,

		link: (name: string, type: string, field: string) =>
			`@ManyToOne(() => ${type}, { fieldName: "${field}", cascade: [Cascade.PERSIST] })`
			+ `\n${name}?: ${type}`,

		many: (name: string, type: string, on: string) =>
			`@OneToMany(() => ${type}, ${templates.argNameFromType(type)} => ${templates.argNameFromType(type)}.${on}, { cascade: [Cascade.PERSIST] })`
			+ `\n${name} = new Collection<${type}>(this)`,
	},

	/** returns an abbreviated variable name for the given type (e.g. `Offer` -> `o`, `Bid` -> `b`, `ERC20` => `erc20`, `camelCaseVar` -> `ccv`) */
	argNameFromType: (type: string) =>
		type[0].toLowerCase() + type.slice(1).replace(/[a-z]/g, "").replace(/([A-Z])/g, x => x.toLowerCase()),

	substituteArrayWithPrimitive: (type: string) =>
	{
		// remove brackets from the type
		let elementType = templates.removeArrayPostfix(type)
		let primitiveType = templates.substitutePrimitive(elementType)
		return templates.substituteArray(type, primitiveType)
	},
	substituteArray: (type: string, withType: string) =>
	{
		let bracketsAmount = countBracketPairs(type)
		if (bracketsAmount == 0)
			return withType

		return `${withType}${"[]".repeat(bracketsAmount)}`
	},
	substitutePrimitive: (type: string) => (templates.types as any)[type] || type,
	removeArrayPostfix: (type: string) => `${type}`.replace(/(\[\])+$/, ""),

	types: {
		Int: "number",
		Float: "number",
		String: "string",
		Boolean: "boolean",
	},

	fieldToCode: (field: Field) =>
	{
		let type = templates.substituteArrayWithPrimitive(field.type)
		switch (field._kind)
		{
			case "pkey":
				return templates.fields.pkey(field.name, type)
			case "basic":
				return templates.fields.prop(field.name, type, field.nullable ?? false)
			case "link":
				return templates.fields.link(field.name, type, field.field)
			case "many":
				return templates.fields.many(field.name, type, field.on)
		}
	},

	imports: {
		mikroOrm: `import { Cascade, Entity, ManyToOne, PrimaryKey, Property, Collection, OneToOne, OneToMany } from "@mikro-orm/core"`,
		type: (type: string) => `import { ${type} } from "./${type}"`,
	}
}
function countBracketPairs(typeName: string)
{
	// Create a regular expression that matches one or more square brackets at the end of the type name
	const bracketPairsRegex = /\[\]*$/

	// Use the regular expression to extract the bracket pairs from the type name
	const bracketPairs = typeName.match(bracketPairsRegex)

	// If there are no bracket pairs, return 0
	if (!bracketPairs)
		return 0

	// Otherwise, return the number of bracket pairs (which is the length of the bracket pairs string divided by 2)
	return bracketPairs[0].length / 2
}


const templatesAggregate = {

	fullStorageFileTemplate: (entities: { name: string, id: string }[], pathToEntities: string) =>
	{
		let entityNames = entities.map(x => x.name)
		return linebreaks(
			templatesAggregate.imports.deps,
			...entities.map(x => templatesAggregate.imports.entity(x.name, pathToEntities)),
			templatesAggregate.storageRecords(entityNames),
			templatesAggregate.createOrm(entityNames),
			templatesAggregate.createStorage.wrapper(linebreaks(
				...entities.map(x => templatesAggregate.createStorage.entityDescriptor(x.name, x.id)),
			))
		)
	},

	imports: {
		deps: `
			import { EntityCaseNamingStrategy, MikroORM } from "@mikro-orm/core"
			import { PostgreSqlDriver } from "@mikro-orm/postgresql"
			import type { ClientConfig } from "pg"
			import { TsMorphMetadataProvider } from "@mikro-orm/reflection"
			import { EventEntity, mikroOrmStorage, __evm_blocks } from "evm-indexer"
		`,
		entity: (name: string, path: string) => `import { ${name}, ${templates.entityHistory(name)} } from "${path}/${name}"`,
	},

	storageRecords: (entityNames: string[]) => `export type StorageRecords = {
		${entityNames.map(x => `${x}: ${x},`).join("\n")}
	}`,

	createOrm: (entityNames: string[]) => `
		export const createOrm = async (dbUrl: string, schema: string, driverOptions?: { connection: ClientConfig }) => MikroORM.init<PostgreSqlDriver>({
			type: "postgresql",
			schema,
			driverOptions: driverOptions,
			namingStrategy: EntityCaseNamingStrategy,
			metadataProvider: TsMorphMetadataProvider,
			clientUrl: dbUrl,
			entities: [
				__evm_blocks,
				EventEntity,
				${entityNames.map(x => `${x}, ${templates.entityHistory(x)},`).join("\n")}
			],
		})
	`,
	createStorage: {
		wrapper: (content: string) => `
			export const createStorage = (orm: MikroORM<PostgreSqlDriver>, timeTravelDepth: number) => mikroOrmStorage<StorageRecords, any>(
				timeTravelDepth,
				orm,
				{
					${content}
				},
				{}
			)
		`,
		entityDescriptor: (name: string, id: string) => `
			${name}: {
				entity: ${name},
				history: ${templates.entityHistory(name)},
				byId: id => ({ ${id}: id }),
				getId: x => x.${id},
				version: x => x.blockNumber,
				withVersion: (x, blockNumber) => ({ ...x, blockNumber }),
			},
		`,
	},
}
