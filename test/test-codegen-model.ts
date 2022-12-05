import fs from "fs"

import { generate } from "../src/codegen-schema"

let schemaStr = fs.readFileSync("./test/schema.yaml", "utf-8")

let output = generate(schemaStr)

fs.mkdirSync("test/generated/schema/entities", { recursive: true })

for (let entity of output.entities)
	fs.writeFileSync(`./test/generated/schema/entities/${entity.name}.ts`, entity.code)

fs.writeFileSync('./test/generated/schema/storage.ts', output.storageFile)
