#!/usr/bin/env python3
"""
Create default admin user for HopeOS.
Run this after first startup to ensure admin user exists.
"""

import sqlite3
import bcrypt
from pathlib import Path
import sys

def get_db_path():
    """Get the database path based on environment."""
    if sys.platform == 'linux':
        db_path = Path.home() / '.local' / 'share' / 'hopeos' / 'hopeos.db'
    elif sys.platform == 'darwin':
        db_path = Path.home() / 'Library' / 'Application Support' / 'HopeOS' / 'hopeos.db'
    else:
        db_path = Path.home() / 'HopeOS' / 'hopeos.db'
    return db_path

def create_admin_user():
    db_path = get_db_path()

    if not db_path.exists():
        print(f"Database not found at {db_path}")
        print("Please start the backend first to initialize the database.")
        return False

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Check if admin exists
    cursor.execute("SELECT id FROM users WHERE username = 'admin'")
    existing = cursor.fetchone()

    if existing:
        print("Admin user already exists. Updating password...")
        password_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode('utf-8')
        cursor.execute(
            "UPDATE users SET password_hash = ? WHERE username = 'admin'",
            (password_hash,)
        )
    else:
        print("Creating admin user...")
        password_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode('utf-8')
        cursor.execute("""
            INSERT INTO users (username, password_hash, email, full_name, role, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ('admin', password_hash, 'admin@hopeos.local', 'System Administrator', 'admin', 1))

    conn.commit()
    conn.close()

    print("Done! Login with: admin / admin123")
    return True

if __name__ == "__main__":
    create_admin_user()
