CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  points INT NOT NULL DEFAULT 0,
  age_group VARCHAR(50),
  user_type VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admins (
  admin_id VARCHAR(100) PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  event_id INT AUTO_INCREMENT PRIMARY KEY,
  event_name VARCHAR(255) NOT NULL,
  event_datetime DATETIME NOT NULL,
  location VARCHAR(255),
  grant_points INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stores (
  store_id INT AUTO_INCREMENT PRIMARY KEY,
  store_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
  service_id INT AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  required_points INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_services_store
    FOREIGN KEY (store_id) REFERENCES stores(store_id)
    ON DELETE CASCADE
);

CREATE TABLE participations (
  participation_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  granted_points INT NOT NULL,
  participated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_event (user_id, event_id),
  CONSTRAINT fk_participations_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_participations_event
    FOREIGN KEY (event_id) REFERENCES events(event_id)
    ON DELETE CASCADE
);

CREATE TABLE point_transactions (
  transaction_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_id INT NULL,
  type ENUM('grant', 'exchange') NOT NULL,
  points INT NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_transactions_service
    FOREIGN KEY (service_id) REFERENCES services(service_id)
    ON DELETE SET NULL
);
