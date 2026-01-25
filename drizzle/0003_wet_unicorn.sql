CREATE TABLE `payment_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeInvoiceId` varchar(100) NOT NULL,
	`stripePaymentIntentId` varchar(100),
	`amountInCents` int NOT NULL,
	`currency` varchar(3) DEFAULT 'usd',
	`status` varchar(20) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_history_stripeInvoiceId_unique` UNIQUE(`stripeInvoiceId`)
);
--> statement-breakpoint
CREATE TABLE `prediction_usage_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`predictionsUsed` int DEFAULT 1,
	`month` varchar(7) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prediction_usage_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`stripeProductId` varchar(100) NOT NULL,
	`stripePriceId` varchar(100) NOT NULL,
	`priceInCents` int NOT NULL,
	`billingPeriod` varchar(20) NOT NULL,
	`predictionsPerMonth` int NOT NULL,
	`hasApiAccess` int NOT NULL DEFAULT 0,
	`description` text,
	`features` text,
	`displayOrder` int DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plans_stripeProductId_unique` UNIQUE(`stripeProductId`),
	CONSTRAINT `subscription_plans_stripePriceId_unique` UNIQUE(`stripePriceId`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` int NOT NULL,
	`stripeSubscriptionId` varchar(100) NOT NULL,
	`stripeCustomerId` varchar(100) NOT NULL,
	`status` varchar(20) NOT NULL,
	`currentPeriodStart` timestamp NOT NULL,
	`currentPeriodEnd` timestamp NOT NULL,
	`canceledAt` timestamp,
	`cancelAtPeriodEnd` int DEFAULT 0,
	`predictionsUsedThisMonth` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_subscriptions_stripeSubscriptionId_unique` UNIQUE(`stripeSubscriptionId`)
);
--> statement-breakpoint
ALTER TABLE `payment_history` ADD CONSTRAINT `payment_history_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prediction_usage_log` ADD CONSTRAINT `prediction_usage_log_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_planId_subscription_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE no action ON UPDATE no action;