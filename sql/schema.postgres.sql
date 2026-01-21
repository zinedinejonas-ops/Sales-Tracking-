-- Database Schema for Sales Tracking System (PostgreSQL)

-- Users (Admin and Sellers)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  contact VARCHAR(255),
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
  active BOOLEAN DEFAULT TRUE,
  shop_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (email)
);

-- Shops
CREATE TABLE IF NOT EXISTS shops (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit VARCHAR(50),
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  sell_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) DEFAULT 0.00,
  total_stock INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock (Inventory per Shop)
CREATE TABLE IF NOT EXISTS stock (
  id SERIAL PRIMARY KEY,
  shop_id INT NOT NULL,
  product_id INT NOT NULL,
  on_hand INT DEFAULT 0,
  sold_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (shop_id, product_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Sales Headers
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  shop_id INT NOT NULL,
  seller_id INT,
  client_id VARCHAR(100),
  subtotal DECIMAL(10, 2) DEFAULT 0.00,
  tax_total DECIMAL(10, 2) DEFAULT 0.00,
  discount_total DECIMAL(10, 2) DEFAULT 0.00,
  grand_total DECIMAL(10, 2) DEFAULT 0.00,
  payment_status VARCHAR(50) DEFAULT 'paid',
  client_created_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (client_id)
);

-- Sale Items (Line Items)
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
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

-- Initial Admin User
INSERT INTO users (name, email, password, role) 
VALUES ('Super Admin', 'admin@example.com', '$2b$10$EpWa/w.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_modtime ON users;
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_shops_modtime ON shops;
CREATE TRIGGER update_shops_modtime BEFORE UPDATE ON shops FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_products_modtime ON products;
CREATE TRIGGER update_products_modtime BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_stock_modtime ON stock;
CREATE TRIGGER update_stock_modtime BEFORE UPDATE ON stock FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
