CREATE DATABASE IF NOT EXISTS lehrermaps CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lehrermaps;

CREATE TABLE IF NOT EXISTS folders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  subject     VARCHAR(50)  NOT NULL,
  group_name  VARCHAR(100) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  created_at  DATETIME DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS files (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  folder_id     INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100),
  size_bytes    INT,
  uploaded_at   DATETIME DEFAULT NOW(),
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);
