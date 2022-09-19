import express from "express"
import postgraphile from "postgraphile"
import { ENV } from "./env"

export async function startGraphqlServer(port: string | number)
{
	let app = express()

	app.use(express.json())

	app.use(postgraphile(ENV.DATABASE_URL, "public", {
		// watchPg: true, // not really needed -- we will restart the server on schema changes
		simpleCollections: "both",
		dynamicJson: true,
		enableCors: true,
		disableDefaultMutations: true,
		disableQueryLog: true,
		graphiql: true,
		enhanceGraphiql: true,
	}))

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