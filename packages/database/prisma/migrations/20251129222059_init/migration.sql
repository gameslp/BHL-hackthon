-- CreateTable
CREATE TABLE `Building` (
    `id` VARCHAR(191) NOT NULL,
    `polygon` JSON NOT NULL,
    `centroidLng` DOUBLE NOT NULL,
    `centroidLat` DOUBLE NOT NULL,
    `isAsbestos` BOOLEAN NOT NULL DEFAULT false,
    `isPotentiallyAsbestos` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Building_centroidLng_centroidLat_idx`(`centroidLng`, `centroidLat`),
    INDEX `Building_isAsbestos_idx`(`isAsbestos`),
    INDEX `Building_isPotentiallyAsbestos_idx`(`isPotentiallyAsbestos`),
    INDEX `Building_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
