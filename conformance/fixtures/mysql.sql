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

CREATE TABLE demo.todos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    owner_id INT,
    estimate DECIMAL(10, 2),
    pinned TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES demo.users (id)
);

CREATE TABLE demo.tags (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE demo.todo_tags (
    todo_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (todo_id, tag_id),
    FOREIGN KEY (todo_id) REFERENCES demo.todos (id),
    FOREIGN KEY (tag_id) REFERENCES demo.tags (id)
);

CREATE TABLE demo.steps (
    id INT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    todo_id INT NOT NULL,
    priority INT NOT NULL,
    due_on DATE NOT NULL,
    FOREIGN KEY (todo_id) REFERENCES demo.todos (id)
);

SET time_zone = '+00:00';

INSERT INTO demo.users (id, name, email, password_hash, `limit`, manager_id) VALUES
    (1, 'Ada', 'ada@example.com', 'x', 5, NULL),
    (2, 'Grace', 'grace@example.com', 'x', NULL, 1),
    (3, 'Linus', NULL, 'x', 2, 1);

INSERT INTO demo.todos (id, name, status, owner_id, estimate, pinned, created_at) VALUES
    (1, 'water plants', 'open', 1, 2.50, 1, '2026-01-02 10:00:00'),
    (2, 'file taxes', 'open', 2, 1.00, 1, '2026-01-05 09:30:00'),
    (3, 'fix bike', 'done', NULL, NULL, 0, '2025-06-01 00:00:00'),
    (4, 'pay rent', 'open', 3, 4.00, 1, '2026-02-11 16:45:00');

INSERT INTO demo.tags (id, name) VALUES (1, 'work'), (2, 'home'), (3, 'urgent');

INSERT INTO demo.todo_tags (todo_id, tag_id) VALUES (1, 1), (1, 3), (2, 2), (4, 1), (4, 2);

INSERT INTO demo.steps (id, title, todo_id, priority, due_on) VALUES
    (1, 'Water the ferns', 1, 3, '2026-01-10'),
    (2, 'Find the receipts', 2, 2, '2026-02-01'),
    (3, 'Buy a watering can', 1, 4, '2026-03-05');

CREATE FUNCTION demo.complete_todo(todo INT, note TEXT) RETURNS INT MODIFIES SQL DATA
BEGIN
    UPDATE demo.todos SET status = 'done' WHERE id = todo;
    RETURN todo;
END;
