CREATE TABLE `predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`raceId` varchar(128) NOT NULL,
	`horseName` varchar(256) NOT NULL,
	`predictedRank` int NOT NULL,
	`predictedScore` varchar(50) NOT NULL,
	`actualRank` int,
	`features` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `predictions` ADD CONSTRAINT `predictions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;