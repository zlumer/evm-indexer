import { generate } from "../src/codegen-abi"
import fs from "fs"
import bestbidJson from "./MarsbaseBestbid.json"

let output = generate("MarsbaseBestbid", bestbidJson as any)

fs.mkdirSync("test/generated", { recursive: true })

fs.writeFileSync('./test/generated/MarsbaseBestbid.ts', output)
