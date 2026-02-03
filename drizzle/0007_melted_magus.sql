CREATE TABLE `prediction_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalPredictions` int DEFAULT 0,
	`correctPredictions` int DEFAULT 0,
	`accuracyPercentage` varchar(50) DEFAULT '0',
	`averageConfidence` varchar(50) DEFAULT '0',
	`bestStreak` int DEFAULT 0,
	`currentStreak` int DEFAULT 0,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prediction_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `predictions` ADD `raceName` varchar(256);--> statement-breakpoint
ALTER TABLE `predictions` ADD `raceDate` timestamp;--> statement-breakpoint
ALTER TABLE `predictions` ADD `confidenceScore` varchar(50) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `predictions` ADD `isCorrect` int;--> statement-breakpoint
ALTER TABLE `predictions` ADD `accuracy` varchar(50);--> statement-breakpoint
ALTER TABLE `predictions` ADD `raceOutcome` text;--> statement-breakpoint
ALTER TABLE `predictions` ADD `status` enum('pending','completed','cancelled') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `predictions` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `prediction_stats` ADD CONSTRAINT `prediction_stats_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;