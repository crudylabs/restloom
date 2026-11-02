CREATE TABLE demo.users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT,
    "limit" INTEGER,
    manager_id INTEGER REFERENCES users (id)
);

CREATE TABLE demo.assets (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    owner_id INTEGER REFERENCES users (id),
    cost NUMERIC,
    active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE demo.tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE demo.asset_tags (
    asset_id INTEGER NOT NULL REFERENCES assets (id),
    tag_id INTEGER NOT NULL REFERENCES tags (id),
    PRIMARY KEY (asset_id, tag_id)
);

CREATE TABLE demo.incidents (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    asset_id INTEGER NOT NULL REFERENCES assets (id),
    severity INTEGER NOT NULL,
    opened_on DATE NOT NULL
);

INSERT INTO demo.users (id, name, email, password_hash, "limit", manager_id) VALUES
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
