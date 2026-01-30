CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Note: Run this separately after deploying to create admin user
-- The password should be hashed using bcrypt before inserting
-- Example: bcrypt.hash('admin123', 10) generates a hash like:
-- $2a$10$... (60 character bcrypt hash)

-- To create admin user, use the /auth/register endpoint or run:
-- INSERT INTO users (name, email, password, role) VALUES 
-- ('Admin User', 'crownzcom@gmail.com', '<bcrypt-hash-here>', 'admin');