import express from "express"
import postgraphile from "postgraphile"

export async function startGraphqlServer(dbUrl: string, port: string | number)
{
	let app = express()

	app.use(express.json())

	app.use(postgraphile(dbUrl, "public", {
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