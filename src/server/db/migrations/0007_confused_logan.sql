CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_password` text,
	`admin_pin` text,
	`api_token_hash` text,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
