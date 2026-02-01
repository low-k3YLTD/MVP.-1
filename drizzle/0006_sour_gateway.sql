CREATE TABLE `automation_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`raceId` varchar(128) NOT NULL,
	`raceName` varchar(256),
	`trackName` varchar(100),
	`raceTime` timestamp NOT NULL,
	`predictions` text,
	`topPick` varchar(256),
	`topPickScore` int,
	`exoticPicks` text,
	`ensembleScore` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `race_results_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`raceId` varchar(128) NOT NULL,
	`raceName` varchar(256),
	`raceTime` timestamp NOT NULL,
	`winner` varchar(256),
	`placings` text,
	`winningOdds` int,
	`resultStatus` varchar(50),
	`resultFetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `race_results_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `race_results_log_raceId_unique` UNIQUE(`raceId`)
);
--> statement-breakpoint
DROP TABLE `automated_predictions`;--> statement-breakpoint
DROP TABLE `automation_logs`;--> statement-breakpoint
DROP TABLE `prediction_accuracy`;--> statement-breakpoint
DROP TABLE `race_results`;