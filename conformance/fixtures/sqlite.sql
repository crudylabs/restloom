CREATE TABLE demo.users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT,
    "limit" INTEGER,
    manager_id INTEGER REFERENCES users (id)
);

CREATE TABLE demo.todos (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    owner_id INTEGER REFERENCES users (id),
    estimate NUMERIC,
    pinned BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE demo.tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE demo.todo_tags (
    todo_id INTEGER NOT NULL REFERENCES todos (id),
    tag_id INTEGER NOT NULL REFERENCES tags (id),
    PRIMARY KEY (todo_id, tag_id)
);

CREATE TABLE demo.steps (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    todo_id INTEGER NOT NULL REFERENCES todos (id),
    priority INTEGER NOT NULL,
    due_on DATE NOT NULL
);

INSERT INTO demo.users (id, name, email, password_hash, "limit", manager_id) VALUES
    (1, 'Ada', 'ada@example.com', 'x', 5, NULL),
    (2, 'Grace', 'grace@example.com', 'x', NULL, 1),
    (3, 'Linus', NULL, 'x', 2, 1);

INSERT INTO demo.todos (id, name, status, owner_id, estimate, pinned, created_at) VALUES
    (1, 'water plants', 'open', 1, 2.50, 1, '2026-01-02T10:00:00+00:00'),
    (2, 'file taxes', 'open', 2, 1.00, 1, '2026-01-05T09:30:00+00:00'),
    (3, 'fix bike', 'done', NULL, NULL, 0, '2025-06-01T00:00:00+00:00'),
    (4, 'pay rent', 'open', 3, 4.00, 1, '2026-02-11T16:45:00+00:00');

INSERT INTO demo.tags (id, name) VALUES (1, 'work'), (2, 'home'), (3, 'urgent');

INSERT INTO demo.todo_tags (todo_id, tag_id) VALUES (1, 1), (1, 3), (2, 2), (4, 1), (4, 2);

INSERT INTO demo.steps (id, title, todo_id, priority, due_on) VALUES
    (1, 'Water the ferns', 1, 3, '2026-01-10'),
    (2, 'Find the receipts', 2, 2, '2026-02-01'),
    (3, 'Buy a watering can', 1, 4, '2026-03-05');
