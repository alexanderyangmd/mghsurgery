import sqlite3
import os

def init_db():
    # Create database directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    # Connect to SQLite database (creates it if it doesn't exist)
    conn = sqlite3.connect('data/phonebook.db')
    cursor = conn.cursor()

    # Create tables
    cursor.executescript('''
        -- Create categories table
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL
        );

        -- Create contacts table
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            pager_number TEXT,
            email TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories (id)
        );

        -- Create trigger to update the updated_at timestamp
        CREATE TRIGGER IF NOT EXISTS update_contacts_timestamp 
        AFTER UPDATE ON contacts
        BEGIN
            UPDATE contacts SET updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.id;
        END;
    ''')

    # Insert default categories
    categories = [
        ('attending', 'Attending Surgeons'),
        ('resident', 'Residents'),
        ('app', 'APPs'),
        ('other', 'Other Important Numbers')
    ]
    
    cursor.executemany(
        'INSERT OR IGNORE INTO categories (name, display_name) VALUES (?, ?)',
        categories
    )

    # Insert sample data
    sample_contacts = [
        # Attendings
        (1, 'Dr. Smith', 'Chief of Surgery', '617-555-0101', '617-555-1101', 'smith@hospital.org'),
        (1, 'Dr. Johnson', 'Trauma Surgery', '617-555-0102', '617-555-1102', 'johnson@hospital.org'),
        
        # Residents
        (2, 'Dr. Brown', 'Chief Resident', '617-555-0201', '617-555-1201', 'brown@hospital.org'),
        (2, 'Dr. Davis', 'PGY-4', '617-555-0202', '617-555-1202', 'davis@hospital.org'),
        
        # APPs
        (3, 'Jane Smith', 'Surgical APP', '617-555-0251', '617-555-1251', 'jsmith@hospital.org'),
        (3, 'John Doe', 'Trauma APP', '617-555-0252', '617-555-1252', 'jdoe@hospital.org'),
        
        # Other
        (4, 'OR Front Desk', 'Main Line', '617-555-0301', None, None),
        (4, 'PACU', 'Nurse Station', '617-555-0302', None, None)
    ]
    
    cursor.executemany('''
        INSERT OR IGNORE INTO contacts 
        (category_id, name, role, phone_number, pager_number, email) 
        VALUES (?, ?, ?, ?, ?, ?)
    ''', sample_contacts)

    # Commit changes and close connection
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully!") 