import express from "express"
import postgraphile from "postgraphile"
import type { ClientConfig } from "pg"

export function getGraphqlRoute(dbUrl: string | ClientConfig, schemaName: string = "public")
{
	return postgraphile(dbUrl, schemaName, {
		// watchPg: true, // not really needed -- we will restart the server on schema changes
		simpleCollections: "both",
		dynamicJson: true,
		enableCors: true,
		disableDefaultMutations: true,
		disableQueryLog: true,
	})
}

export async function startGraphqlServer(dbUrl: string | ClientConfig, port: string | number)
{
	let app = express()

	app.use(express.json())

	app.use(getGraphqlRoute(dbUrl))

	console.log(`starting GraphQL server on port ${port}...`)
	return new Promise<express.Express>(res =>
	{
		app.listen(port, () =>
		{
			console.log(`GraphQL server started!`)
			return res(app)
		})
	})
}