IF OBJECT_ID('demo.todos_tagged') IS NOT NULL DROP FUNCTION demo.todos_tagged;
IF OBJECT_ID('demo.steps') IS NOT NULL DROP TABLE demo.steps;
IF OBJECT_ID('demo.todo_tags') IS NOT NULL DROP TABLE demo.todo_tags;
IF OBJECT_ID('demo.tags') IS NOT NULL DROP TABLE demo.tags;
IF OBJECT_ID('demo.todos') IS NOT NULL DROP TABLE demo.todos;
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

CREATE TABLE demo.todos (
    id INT PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    status NVARCHAR(20) NOT NULL,
    owner_id INT REFERENCES demo.users (id),
    estimate DECIMAL(10, 2),
    pinned BIT NOT NULL DEFAULT 1,
    created_at DATETIMEOFFSET(0) NOT NULL
);

CREATE TABLE demo.tags (
    id INT PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE demo.todo_tags (
    todo_id INT NOT NULL REFERENCES demo.todos (id),
    tag_id INT NOT NULL REFERENCES demo.tags (id),
    PRIMARY KEY (todo_id, tag_id)
);

CREATE TABLE demo.steps (
    id INT PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    todo_id INT NOT NULL REFERENCES demo.todos (id),
    priority INT NOT NULL,
    due_on DATE NOT NULL
);

INSERT INTO demo.users (id, name, email, password_hash, [limit], manager_id) VALUES
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
GO
CREATE FUNCTION demo.todos_tagged(@tag NVARCHAR(100)) RETURNS TABLE AS RETURN (
    SELECT a.* FROM demo.todos a
      JOIN demo.todo_tags t ON t.todo_id = a.id
      JOIN demo.tags g ON g.id = t.tag_id
     WHERE g.name = @tag
);
