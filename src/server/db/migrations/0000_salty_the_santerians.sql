CREATE TABLE `mic_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` integer NOT NULL,
	`show_id` integer NOT NULL,
	`mic_id` text NOT NULL,
	`performer` text DEFAULT '' NOT NULL,
	`pronouns` text DEFAULT '' NOT NULL,
	`mic_color` text DEFAULT '' NOT NULL,
	`placement` text DEFAULT '' NOT NULL,
	`sensitivity` text DEFAULT '' NOT NULL,
	`allergy` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `show_mic_unique` ON `mic_entries` (`show_id`,`mic_id`);--> statement-breakpoint
CREATE TABLE `mic_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mic_entry_id` integer NOT NULL,
	`filename` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`mic_entry_id`) REFERENCES `mic_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action
);
