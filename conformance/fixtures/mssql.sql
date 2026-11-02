IF OBJECT_ID('demo.assets_tagged') IS NOT NULL DROP FUNCTION demo.assets_tagged;
IF OBJECT_ID('demo.incidents') IS NOT NULL DROP TABLE demo.incidents;
IF OBJECT_ID('demo.asset_tags') IS NOT NULL DROP TABLE demo.asset_tags;
IF OBJECT_ID('demo.tags') IS NOT NULL DROP TABLE demo.tags;
IF OBJECT_ID('demo.assets') IS NOT NULL DROP TABLE demo.assets;
IF OBJECT_ID('demo.users') IS NOT NULL DROP TABLE demo.users;
IF SCHEMA_ID('demo') IS NOT NULL DROP SCHEMA demo;
GO
CREATE SCHEMA demo;
GO
CREATE TABLE demo.users (
    id INT PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    email NVARCHAR(200),
    password_hash NVARCHAR(200),
    [limit] INT,
    manager_id INT REFERENCES demo.users (id)
);

CREATE TABLE demo.assets (
    id INT PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    status NVARCHAR(20) NOT NULL,
    owner_id INT REFERENCES demo.users (id),
    cost DECIMAL(10, 2),
    active BIT NOT NULL DEFAULT 1,
    created_at DATETIMEOFFSET(0) NOT NULL
);

CREATE TABLE demo.tags (
    id INT PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE demo.asset_tags (
    asset_id INT NOT NULL REFERENCES demo.assets (id),
    tag_id INT NOT NULL REFERENCES demo.tags (id),
    PRIMARY KEY (asset_id, tag_id)
);

CREATE TABLE demo.incidents (
    id INT PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    asset_id INT NOT NULL REFERENCES demo.assets (id),
    severity INT NOT NULL,
    opened_on DATE NOT NULL
);

INSERT INTO demo.users (id, name, email, password_hash, [limit], manager_id) VALUES
    (1, 'Ada', 'ada@example.com', 'x', 5, NULL),
    (2, 'Grace', 'grace@example.com', 'x', NULL, 1),
    (3, 'Linus', NULL, 'x', 2, 1);

INSERT INTO demo.assets (id, name, status, owner_id, cost, active, created_at) VALUES
    (1, 'vpn gateway', 'open', 1, 1200.50, 1, '2026-01-02T10:00:00+00:00'),
    (2, 'mail relay', 'open', 2, 300.00, 1, '2026-01-05T09:30:00+00:00'),
    (3, 'old wiki', 'retired', NULL, NULL, 0, '2025-06-01T00:00:00+00:00'),
    (4, 'payroll db', 'open', 3, 4000.00, 1, '2026-02-11T16:45:00+00:00');

INSERT INTO demo.tags (id, name) VALUES (1, 'pci'), (2, 'gdpr'), (3, 'internal');

INSERT INTO demo.asset_tags (asset_id, tag_id) VALUES (1, 1), (1, 3), (2, 2), (4, 1), (4, 2);

INSERT INTO demo.incidents (id, title, asset_id, severity, opened_on) VALUES
    (1, 'VPN outage', 1, 3, '2026-01-10'),
    (2, 'Spoofed mail', 2, 2, '2026-02-01'),
    (3, 'Brute force', 1, 4, '2026-03-05');
GO
CREATE FUNCTION demo.assets_tagged(@tag NVARCHAR(100)) RETURNS TABLE AS RETURN (
    SELECT a.* FROM demo.assets a
      JOIN demo.asset_tags t ON t.asset_id = a.id
      JOIN demo.tags g ON g.id = t.tag_id
     WHERE g.name = @tag
);
