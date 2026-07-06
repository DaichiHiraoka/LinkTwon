CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  points INT NOT NULL DEFAULT 0,
  age_group VARCHAR(50),
  user_type VARCHAR(50) DEFAULT 'general',
  email_verified_at DATETIME NULL,
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
  status ENUM('active', 'paused') NOT NULL DEFAULT 'active',
  description TEXT NULL,
  activity TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE event_organizers (
  organizer_id VARCHAR(100) PRIMARY KEY,
  login_code VARCHAR(100) NOT NULL UNIQUE,
  login_password VARCHAR(255) NOT NULL,
  organizer_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE event_organizer_events (
  organizer_id VARCHAR(100) NOT NULL,
  event_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organizer_id, event_id),
  CONSTRAINT fk_event_organizer_events_organizer
    FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_event_organizer_events_event
    FOREIGN KEY (event_id) REFERENCES events(event_id)
    ON DELETE CASCADE
);

CREATE TABLE stores (
  store_id INT AUTO_INCREMENT PRIMARY KEY,
  login_code VARCHAR(100) NULL UNIQUE,
  login_password VARCHAR(255) NULL,
  store_name VARCHAR(255) NOT NULL,
  store_address VARCHAR(255) NULL,
  map_query VARCHAR(255) NULL,
  contact_email VARCHAR(255) NULL,
  status ENUM('active', 'paused') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_categories (
  category_id VARCHAR(100) PRIMARY KEY,
  category_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE services (
  service_id INT AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL,
  category_id VARCHAR(100) NULL,
  service_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  required_points INT NOT NULL,
  status ENUM('active', 'paused') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_services_store
    FOREIGN KEY (store_id) REFERENCES stores(store_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_services_category
    FOREIGN KEY (category_id) REFERENCES service_categories(category_id)
    ON DELETE SET NULL
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

CREATE TABLE portal_event_check_ins (
  check_in_id INT AUTO_INCREMENT PRIMARY KEY,
  organizer_id VARCHAR(100) NOT NULL,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  nonce VARCHAR(255) NOT NULL,
  qr_issued_at DATETIME NULL,
  qr_expires_at DATETIME NOT NULL,
  granted_points INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_portal_event_qr (event_id, user_id, nonce),
  CONSTRAINT fk_portal_checkins_organizer
    FOREIGN KEY (organizer_id) REFERENCES event_organizers(organizer_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_portal_checkins_event
    FOREIGN KEY (event_id) REFERENCES events(event_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_portal_checkins_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

CREATE TABLE portal_store_exchanges (
  exchange_id INT AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL,
  service_id INT NOT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  nonce VARCHAR(255) NOT NULL,
  qr_issued_at DATETIME NULL,
  qr_expires_at DATETIME NOT NULL,
  used_points INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_portal_store_qr (service_id, user_id, nonce),
  CONSTRAINT fk_portal_exchanges_store
    FOREIGN KEY (store_id) REFERENCES stores(store_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_portal_exchanges_service
    FOREIGN KEY (service_id) REFERENCES services(service_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_portal_exchanges_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

CREATE TABLE point_purchases (
  purchase_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  payment_method_id INT NULL,
  points INT NOT NULL,
  amount_yen INT NOT NULL DEFAULT 0,
  status ENUM('pending', 'paid', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchases_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

CREATE TABLE event_likes (
  like_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_event_like (user_id, event_id),
  CONSTRAINT fk_event_likes_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_event_likes_event
    FOREIGN KEY (event_id) REFERENCES events(event_id)
    ON DELETE CASCADE
);

CREATE TABLE service_favorites (
  favorite_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_service_favorite (user_id, service_id),
  CONSTRAINT fk_service_favorites_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_service_favorites_service
    FOREIGN KEY (service_id) REFERENCES services(service_id)
    ON DELETE CASCADE
);

CREATE TABLE event_checkin_tokens (
  token_id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  check_in_code VARCHAR(100) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_checkin_tokens_event
    FOREIGN KEY (event_id) REFERENCES events(event_id)
    ON DELETE CASCADE
);

CREATE TABLE password_reset_tokens (
  token_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  reset_token VARCHAR(100) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

CREATE TABLE email_verification_tokens (
  token_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  verification_token VARCHAR(100) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_email_verification_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

CREATE TABLE user_settings (
  user_id INT PRIMARY KEY,
  notification_enabled TINYINT(1) NOT NULL DEFAULT 1,
  language VARCHAR(20) NOT NULL DEFAULT 'ja',
  font_size ENUM('small', 'medium', 'large') NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_settings_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

CREATE TABLE payment_methods (
  payment_method_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(255) NOT NULL,
  brand VARCHAR(50) NOT NULL DEFAULT 'mock',
  last4 VARCHAR(8) NOT NULL DEFAULT '0000',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_methods_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

ALTER TABLE point_purchases
  ADD CONSTRAINT fk_purchases_payment_method
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id)
  ON DELETE SET NULL;

CREATE TABLE notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

CREATE TABLE support_tickets (
  ticket_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  category ENUM('support', 'bug') NOT NULL DEFAULT 'support',
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
  admin_note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_support_tickets_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE SET NULL
);

CREATE TABLE content_translations (
  translation_id INT AUTO_INCREMENT PRIMARY KEY,
  content_type VARCHAR(50) NOT NULL,
  content_id VARCHAR(50) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  source_locale VARCHAR(10) NOT NULL DEFAULT 'ja',
  target_locale VARCHAR(10) NOT NULL,
  source_text_hash CHAR(64) NOT NULL,
  translated_text TEXT NOT NULL,
  translation_provider VARCHAR(50) NOT NULL,
  translation_status ENUM('current', 'failed') NOT NULL DEFAULT 'current',
  error_message VARCHAR(255) NULL,
  translated_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_translation (content_type, content_id, field_name, target_locale)
);
