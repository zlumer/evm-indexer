-- CreateTable
CREATE TABLE "index_blocks_processed" (
    "id" INT4 NOT NULL DEFAULT unique_rowid(),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_block_processed" INT4 NOT NULL,

    CONSTRAINT "index_blocks_processed_pkey" PRIMARY KEY ("id")
);
