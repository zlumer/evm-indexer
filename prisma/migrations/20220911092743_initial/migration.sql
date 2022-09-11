-- CreateTable
CREATE TABLE `index_blocks_processed` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` int unsigned NOT NULL,
    `last_block_processed` int unsigned NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
