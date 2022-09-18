import dotenv from "dotenv"

dotenv.config()

const { DATABASE_URL } = process.env

if (!DATABASE_URL)
	throw new Error(`DATABASE_URL is not provided!`)

export const ENV = {
	DATABASE_URL,
}