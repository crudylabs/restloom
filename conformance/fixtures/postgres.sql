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

CREATE TABLE demo.todos (
    id integer PRIMARY KEY,
    name text NOT NULL,
    status text NOT NULL,
    owner_id integer REFERENCES demo.users (id),
    estimate numeric(10, 2),
    pinned boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL
);

CREATE TABLE demo.tags (
    id integer PRIMARY KEY,
    name text NOT NULL UNIQUE
);

CREATE TABLE demo.todo_tags (
    todo_id integer NOT NULL REFERENCES demo.todos (id),
    tag_id integer NOT NULL REFERENCES demo.tags (id),
    PRIMARY KEY (todo_id, tag_id)
);

CREATE TABLE demo.steps (
    id integer PRIMARY KEY,
    title text NOT NULL,
    todo_id integer NOT NULL REFERENCES demo.todos (id),
    priority integer NOT NULL,
    due_on date NOT NULL
);

INSERT INTO demo.users (id, name, email, password_hash, "limit", manager_id) VALUES
    (1, 'Ada', 'ada@example.com', 'x', 5, NULL),
    (2, 'Grace', 'grace@example.com', 'x', NULL, 1),
    (3, 'Linus', NULL, 'x', 2, 1);

INSERT INTO demo.todos (id, name, status, owner_id, estimate, pinned, created_at) VALUES
    (1, 'water plants', 'open', 1, 2.50, true, '2026-01-02T10:00:00Z'),
    (2, 'file taxes', 'open', 2, 1.00, true, '2026-01-05T09:30:00Z'),
    (3, 'fix bike', 'done', NULL, NULL, false, '2025-06-01T00:00:00Z'),
    (4, 'pay rent', 'open', 3, 4.00, true, '2026-02-11T16:45:00Z');

INSERT INTO demo.tags (id, name) VALUES (1, 'work'), (2, 'home'), (3, 'urgent');

INSERT INTO demo.todo_tags (todo_id, tag_id) VALUES (1, 1), (1, 3), (2, 2), (4, 1), (4, 2);

INSERT INTO demo.steps (id, title, todo_id, priority, due_on) VALUES
    (1, 'Water the ferns', 1, 3, '2026-01-10'),
    (2, 'Find the receipts', 2, 2, '2026-02-01'),
    (3, 'Buy a watering can', 1, 4, '2026-03-05');

CREATE FUNCTION demo.complete_todo(todo integer, note text DEFAULT NULL) RETURNS integer
    LANGUAGE sql AS $$ UPDATE demo.todos SET status = 'done' WHERE id = todo RETURNING id $$;

CREATE FUNCTION demo.todos_tagged(tag text) RETURNS SETOF demo.todos
    LANGUAGE sql STABLE AS $$
        SELECT a.* FROM demo.todos a JOIN demo.todo_tags t ON t.todo_id = a.id JOIN demo.tags g ON g.id = t.tag_id
        WHERE g.name = tag ORDER BY a.id $$;

CREATE TABLE demo.notes (
    id integer PRIMARY KEY,
    labels text[] NOT NULL
);

INSERT INTO demo.notes (id, labels) VALUES (1, '{a,b}'), (2, '{b,c}'), (3, '{z}');
