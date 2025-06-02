-- Migration number: 0004    2025-06-02T00:00:00.000Z
DROP TABLE IF EXISTS admins;

CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_admins_updated_at 
    AFTER UPDATE ON admins
    BEGIN
        UPDATE admins 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
    END;

-- Insert default admin (password: admin123 - you should change this)
INSERT INTO admins (username, email, password_hash) 
VALUES ('admin', 'admin@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');
