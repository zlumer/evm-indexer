import { EntityCaseNamingStrategy, MikroORM } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import type { ClientConfig } from "pg"
import { TsMorphMetadataProvider } from "@mikro-orm/reflection"
import { EventEntity, mikroOrmStorage, __evm_blocks } from "evm-indexer"

import { Address, __evm__history__Address } from "./entities/Address"
import { ExOffer, __evm__history__ExOffer } from "./entities/ExOffer"
import { ExBid, __evm__history__ExBid } from "./entities/ExBid"
export type StorageRecords = {
	Address: Address
	ExOffer: ExOffer
	ExBid: ExBid
}

export const createOrm = async (
	dbUrl: string,
	schema: string,
	driverOptions?: { connection: ClientConfig }
) =>
	MikroORM.init<PostgreSqlDriver>({
		type: "postgresql",
		schema,
		driverOptions: driverOptions,
		namingStrategy: EntityCaseNamingStrategy,
		metadataProvider: TsMorphMetadataProvider,
		clientUrl: dbUrl,
		entities: [
			__evm_blocks,
			EventEntity,
			Address,
			__evm__history__Address,
			ExOffer,
			__evm__history__ExOffer,
			ExBid,
			__evm__history__ExBid,
		],
	})

export const createStorage = (
	orm: MikroORM<PostgreSqlDriver>,
	timeTravelDepth: number
) =>
	mikroOrmStorage<StorageRecords, any>(
		timeTravelDepth,
		orm,
		{
			Address: {
				entity: Address,
				history: __evm__history__Address,
				byId: (id) => ({ address: id }),
				getId: (x) => x.address,
				version: (x) => x.blockNumber,
				withVersion: (x, blockNumber) => ({ ...x, blockNumber }),
			},

			ExOffer: {
				entity: ExOffer,
				history: __evm__history__ExOffer,
				byId: (id) => ({ offerId: id }),
				getId: (x) => x.offerId,
				version: (x) => x.blockNumber,
				withVersion: (x, blockNumber) => ({ ...x, blockNumber }),
			},

			ExBid: {
				entity: ExBid,
				history: __evm__history__ExBid,
				byId: (id) => ({ bidId: id }),
				getId: (x) => x.bidId,
				version: (x) => x.blockNumber,
				withVersion: (x, blockNumber) => ({ ...x, blockNumber }),
			},
		},
		{}
	)
