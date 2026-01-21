-- Database Schema for Sales Tracking System

CREATE DATABASE IF NOT EXISTS sales_db;
USE sales_db;

-- Users (Admin and Sellers)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  password VARCHAR(255) NOT NULL, -- Hashed password
  role ENUM('admin', 'seller') NOT NULL DEFAULT 'seller',
  active TINYINT(1) DEFAULT 1,
  shop_id INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_email (email)
);

-- Shops
CREATE TABLE IF NOT EXISTS shops (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit VARCHAR(50), -- e.g., 'kg', 'pcs'
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  sell_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) DEFAULT 0.00,
  total_stock INT DEFAULT 0, -- Main warehouse stock
  active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Stock (Inventory per Shop)
CREATE TABLE IF NOT EXISTS stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL,
  product_id INT NOT NULL,
  on_hand INT DEFAULT 0,
  sold_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_shop_product (shop_id, product_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Sales Headers
CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL,
  seller_id INT, -- Can be NULL if user deleted
  client_id VARCHAR(100), -- For offline sync deduplication
  subtotal DECIMAL(10, 2) DEFAULT 0.00,
  tax_total DECIMAL(10, 2) DEFAULT 0.00,
  discount_total DECIMAL(10, 2) DEFAULT 0.00,
  grand_total DECIMAL(10, 2) DEFAULT 0.00,
  payment_status VARCHAR(50) DEFAULT 'paid',
  client_created_at DATETIME, -- When the sale happened on the device
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_client_sale (client_id)
);

-- Sale Items (Line Items)
CREATE TABLE IF NOT EXISTS sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT,
  quantity INT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  tax_amount DECIMAL(10, 2) DEFAULT 0.00,
  line_total DECIMAL(10, 2) NOT NULL,
  profit_amount DECIMAL(10, 2) DEFAULT 0.00,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Initial Admin User (You must change the password hash!)
-- Default password is 'admin123' (hash: $2a$10$YourHashedPasswordHere...)
-- REPLACE THIS HASH with a real one generated via bcrypt
INSERT INTO users (name, email, password, role) 
VALUES ('Super Admin', 'admin@example.com', '$2b$10$EpWa/w.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0', 'admin')
ON DUPLICATE KEY UPDATE id=id;
