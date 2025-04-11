-- schema.sql
-- This script creates the necessary tables for the QR Ordering System.
-- It drops existing tables (if any) and then creates fresh ones.
-- Default data is inserted into the Role, settings, sections, and MenuItems tables.

-- Disable foreign key checks to allow dropping tables in any order
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `settings`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `MenuItems`;
DROP TABLE IF EXISTS `menu`;
DROP TABLE IF EXISTS `Login`;
DROP TABLE IF EXISTS `Role`;
DROP TABLE IF EXISTS `tables`;
DROP TABLE IF EXISTS `sections`;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- Create the Role table (must be created first)
-- =====================================================
CREATE TABLE `Role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_type` varchar(100) NOT NULL,
  `created_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert default role data (admin)
INSERT INTO `Role` (`id`, `role_type`, `created_on`, `modified_on`, `is_deleted`)
VALUES (1, 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

-- =====================================================
-- Create the Login table
-- =====================================================
CREATE TABLE `Login` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role_id` int DEFAULT NULL,
  `created_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `Login_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `Role` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- Create the sections table
-- =====================================================
CREATE TABLE `sections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert default section data
INSERT INTO `sections` (`name`, `created_at`, `updated_at`)
VALUES 
('Dining Area', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Outdoor Seating', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- =====================================================
-- Create the tables table
-- =====================================================
CREATE TABLE `tables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_number` varchar(20) NOT NULL,
  `status` enum('empty','occupied','reserved') DEFAULT 'empty',
  `section_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `section_id` (`section_id`),
  KEY `table_number` (`table_number`),
  CONSTRAINT `tables_ibfk_1` FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert default table data
INSERT INTO `tables` (`table_number`, `status`, `section_id`, `created_at`, `updated_at`)
VALUES 
('T1', 'empty', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('T2', 'empty', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('O1', 'empty', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- =====================================================
-- Create the menu table
-- =====================================================
CREATE TABLE `menu` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `create_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) DEFAULT '0',
  `image` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- Create the MenuItems table
-- =====================================================
CREATE TABLE `MenuItems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `create_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) DEFAULT '0',
  `image` varchar(512) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert default data into MenuItems table (keeping your original data)
INSERT INTO `MenuItems` (`id`, `name`, `category`, `create_on`, `modified_on`, `is_deleted`, `image`) VALUES
(11, 'Full Dry Manchurian', 'Chinese', '2025-02-24 05:41:35', '2025-02-24 05:41:35', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1740375694026-p7p3ahjd1z.jpg'),
(15, 'Paneer Tikka Masala', 'Punjabi', '2025-03-11 16:06:11', '2025-03-11 16:06:11', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741709170075-6qnapdswcw8.jpg'),
(16, 'Hakka Noodles', 'Chinese', '2025-03-11 16:08:06', '2025-03-11 16:08:06', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741709285578-29fxbsrayto.jpg'),
(17, 'Hot and Sour Soup', 'Soup', '2025-03-11 16:10:53', '2025-03-11 16:10:53', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741709452722-ct19dz1pojf.jpg'),
(18, 'Tomato Soup', 'Soup', '2025-03-11 16:11:28', '2025-03-11 16:11:28', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741709488423-4ob4ss694qu.jpg'),
(19, 'Paneer Chilli', 'Chinese', '2025-03-11 16:12:12', '2025-03-11 16:12:12', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741709531957-0dxwvgmthhrk.jpg'),
(20, 'Paneer Angara', 'Punjabi', '2025-03-11 16:13:17', '2025-03-11 16:13:17', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741709596783-3gttb7d9hl4.jpg'),
(21, 'Shahi Paneer', 'Punjabi', '2025-03-11 16:14:16', '2025-03-11 16:14:16', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741709656546-kycq66xnv4.jpg'),
(22, 'Paneer Toofani', 'Punjabi', '2025-03-11 16:16:26', '2025-03-11 16:16:26', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741709785343-hotr1zdhp79.jpg'),
(24, 'Paneer Handi', 'Punjabi', '2025-03-11 16:21:00', '2025-03-11 16:21:00', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741710059415-op53be7rdvb.jpg'),
(25, 'Tandoori Roti', 'Roti', '2025-03-11 16:35:11', '2025-03-11 16:35:11', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741710910869-888xpxf7o5v.jpg'),
(26, 'Chapati Roti', 'Roti', '2025-03-11 16:36:50', '2025-03-11 16:36:50', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741711009664-l0ntu1frlcl.jpg'),
(27, 'Tawa Roti', 'Roti', '2025-03-11 16:38:41', '2025-03-11 16:38:41', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741711120962-q77cxbnv28f.jpg'),
(28, 'Naan', 'Roti', '2025-03-11 16:39:20', '2025-03-11 16:39:20', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741711160060-nm536kpdu8a.jpg'),
(29, 'Garlic Naan', 'Roti', '2025-03-11 16:39:40', '2025-03-11 16:39:40', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741711179935-q7ntiaidfkf.jpg'),
(31, 'Masala Dosa', 'South Indian', '2025-03-11 16:47:25', '2025-03-11 16:47:25', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741711645052-mazqkil7sra.jpg'),
(32, 'Mysore Masala Dosa', 'South Indian', '2025-03-11 16:50:47', '2025-03-11 16:50:47', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741711846414-ooq7om14pti.jpg'),
(33, 'Rava Dosa', 'South Indian', '2025-03-11 16:51:47', '2025-03-11 16:51:47', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741711906902-2berck47xre.jpg'),
(34, 'Chaas', 'Drink', '2025-03-11 16:52:30', '2025-03-11 16:52:30', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741711949655-q236u3gv7dc.jpg'),
(35, 'Lassi', 'Drink', '2025-03-11 16:53:16', '2025-03-11 16:53:16', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741711996067-ufim1bquxzh.jpg'),
(36, 'Dal Fry', 'Dal', '2025-03-11 16:56:49', '2025-03-11 16:56:49', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741712208852-t5n98evtab.jpg'),
(37, 'Dal Tadka', 'Dal', '2025-03-11 16:57:16', '2025-03-11 16:57:16', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741712236002-9ny59ru70kv.jpg'),
(38, 'Jeera Rice', 'Rice', '2025-03-11 16:58:13', '2025-03-11 16:58:13', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741712292938-pdty81wdrn.jpg'),
(39, 'Plain Rice', 'Rice', '2025-03-11 16:59:29', '2025-03-11 16:59:29', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741712368704-wmkyc76l25r.jpg'),
(40, 'Panner Lababdar', 'Punjabi', '2025-03-11 17:09:27', '2025-03-11 17:09:27', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741712967542-ilhg69ngc9c.jpg'),
(41, 'Sada Dosa', 'South Indian', '2025-03-11 17:10:47', '2025-03-11 17:10:47', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1741713047169-97sl88b9cgb.jpg'),
(42, 'Half Dry Manchurian', 'Chinese', '2025-03-15 07:06:39', '2025-03-15 07:06:39', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1742022398916-j4gv6fvx2xl.jpg'),
(43, 'Manchow Soup', 'Soup', '2025-03-15 07:22:59', '2025-03-15 07:22:59', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1742023378807-9oqqyun9lf6.jpg'),
(44, 'Punjabi Thali', 'Punjabi', '2025-03-15 07:23:26', '2025-03-15 07:23:26', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1742023405528-p2k3vdrs6h.jpg'),
(45, 'Noodles', 'Chinese', '2025-03-15 09:43:11', '2025-03-15 09:43:11', 0, 'https://zyvlaqormkqnkhsomkil.supabase.co/storage/v1/object/public/menu_items/1742031790905-ybdz5e6iy6o.jpg');

-- =====================================================
-- Create the orders table (updated with section_id)
-- =====================================================
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `customer_name` varchar(255) NULL,
  `phone` varchar(255) NULL,
  `table_number` varchar(50) NULL,
  `items` json NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` enum('Cash','Online') NOT NULL,
  `status` enum('Pending','Completed') DEFAULT 'Pending',
  `created_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_on` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) DEFAULT '0',
  `is_paid` tinyint(1) DEFAULT '0',
  `section_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `section_id` (`section_id`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- Create the settings table
-- =====================================================
CREATE TABLE `settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `restaurantName` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `operatingHours` varchar(100) DEFAULT NULL,
  `upiId` varchar(255) DEFAULT NULL,
  `isOpen` tinyint(1) DEFAULT '0',
  `profile_photo_data` mediumblob DEFAULT NULL,
  `profile_photo_mime` varchar(255) DEFAULT NULL,
  `profile_photo` varchar(255) DEFAULT NULL,
  `price` decimal(10,1) DEFAULT 2.00,
  `gst` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert default settings data
INSERT INTO `settings` (`id`, `restaurantName`, `address`, `phone`, `email`, `operatingHours`, `upiId`, `isOpen`, `created_at`, `updated_at`)
VALUES (1, 'My Restaurant', '123 Main Street', '123-456-7890', 'example@example.com', '9 AM - 9 PM', '12345678@ybl', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- =====================================================
-- End of schema
-- =====================================================