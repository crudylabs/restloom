SET GLOBAL log_bin_trust_function_creators = 1;
DROP DATABASE IF EXISTS demo;
CREATE DATABASE demo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE demo.users (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(200),
    password_hash VARCHAR(200),
    `limit` INT,
    manager_id INT,
    FOREIGN KEY (manager_id) REFERENCES demo.users (id)
);

CREATE TABLE demo.assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    owner_id INT,
    cost DECIMAL(10, 2),
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES demo.users (id)
);

CREATE TABLE demo.tags (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE demo.asset_tags (
    asset_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (asset_id, tag_id),
    FOREIGN KEY (asset_id) REFERENCES demo.assets (id),
    FOREIGN KEY (tag_id) REFERENCES demo.tags (id)
);

CREATE TABLE demo.incidents (
    id INT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    asset_id INT NOT NULL,
    severity INT NOT NULL,
    opened_on DATE NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES demo.assets (id)
);

SET time_zone = '+00:00';

INSERT INTO demo.users (id, name, email, password_hash, `limit`, manager_id) VALUES
    (1, 'Ada', 'ada@example.com', 'x', 5, NULL),
    (2, 'Grace', 'grace@example.com', 'x', NULL, 1),
    (3, 'Linus', NULL, 'x', 2, 1);

INSERT INTO demo.assets (id, name, status, owner_id, cost, active, created_at) VALUES
    (1, 'vpn gateway', 'open', 1, 1200.50, 1, '2026-01-02 10:00:00'),
    (2, 'mail relay', 'open', 2, 300.00, 1, '2026-01-05 09:30:00'),
    (3, 'old wiki', 'retired', NULL, NULL, 0, '2025-06-01 00:00:00'),
    (4, 'payroll db', 'open', 3, 4000.00, 1, '2026-02-11 16:45:00');

INSERT INTO demo.tags (id, name) VALUES (1, 'pci'), (2, 'gdpr'), (3, 'internal');

INSERT INTO demo.asset_tags (asset_id, tag_id) VALUES (1, 1), (1, 3), (2, 2), (4, 1), (4, 2);

INSERT INTO demo.incidents (id, title, asset_id, severity, opened_on) VALUES
    (1, 'VPN outage', 1, 3, '2026-01-10'),
    (2, 'Spoofed mail', 2, 2, '2026-02-01'),
    (3, 'Brute force', 1, 4, '2026-03-05');

CREATE FUNCTION demo.retire_asset(asset INT, reason TEXT) RETURNS INT MODIFIES SQL DATA
BEGIN
    UPDATE demo.assets SET status = 'retired' WHERE id = asset;
    RETURN asset;
END;
