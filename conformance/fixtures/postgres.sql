DROP SCHEMA IF EXISTS demo CASCADE;
CREATE SCHEMA demo;

CREATE TABLE demo.users (
    id integer PRIMARY KEY,
    name text NOT NULL,
    email text,
    password_hash text,
    "limit" integer,
    manager_id integer REFERENCES demo.users (id)
);

CREATE TABLE demo.assets (
    id integer PRIMARY KEY,
    name text NOT NULL,
    status text NOT NULL,
    owner_id integer REFERENCES demo.users (id),
    cost numeric(10, 2),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL
);

CREATE TABLE demo.tags (
    id integer PRIMARY KEY,
    name text NOT NULL UNIQUE
);

CREATE TABLE demo.asset_tags (
    asset_id integer NOT NULL REFERENCES demo.assets (id),
    tag_id integer NOT NULL REFERENCES demo.tags (id),
    PRIMARY KEY (asset_id, tag_id)
);

CREATE TABLE demo.incidents (
    id integer PRIMARY KEY,
    title text NOT NULL,
    asset_id integer NOT NULL REFERENCES demo.assets (id),
    severity integer NOT NULL,
    opened_on date NOT NULL
);

INSERT INTO demo.users (id, name, email, password_hash, "limit", manager_id) VALUES
    (1, 'Ada', 'ada@example.com', 'x', 5, NULL),
    (2, 'Grace', 'grace@example.com', 'x', NULL, 1),
    (3, 'Linus', NULL, 'x', 2, 1);

INSERT INTO demo.assets (id, name, status, owner_id, cost, active, created_at) VALUES
    (1, 'vpn gateway', 'open', 1, 1200.50, true, '2026-01-02T10:00:00Z'),
    (2, 'mail relay', 'open', 2, 300.00, true, '2026-01-05T09:30:00Z'),
    (3, 'old wiki', 'retired', NULL, NULL, false, '2025-06-01T00:00:00Z'),
    (4, 'payroll db', 'open', 3, 4000.00, true, '2026-02-11T16:45:00Z');

INSERT INTO demo.tags (id, name) VALUES (1, 'pci'), (2, 'gdpr'), (3, 'internal');

INSERT INTO demo.asset_tags (asset_id, tag_id) VALUES (1, 1), (1, 3), (2, 2), (4, 1), (4, 2);

INSERT INTO demo.incidents (id, title, asset_id, severity, opened_on) VALUES
    (1, 'VPN outage', 1, 3, '2026-01-10'),
    (2, 'Spoofed mail', 2, 2, '2026-02-01'),
    (3, 'Brute force', 1, 4, '2026-03-05');

CREATE FUNCTION demo.retire_asset(asset integer, reason text DEFAULT NULL) RETURNS integer
    LANGUAGE sql AS $$ UPDATE demo.assets SET status = 'retired' WHERE id = asset RETURNING id $$;

CREATE FUNCTION demo.assets_tagged(tag text) RETURNS SETOF demo.assets
    LANGUAGE sql STABLE AS $$
        SELECT a.* FROM demo.assets a JOIN demo.asset_tags t ON t.asset_id = a.id JOIN demo.tags g ON g.id = t.tag_id
        WHERE g.name = tag ORDER BY a.id $$;
