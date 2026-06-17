-- Create Lexicon Events and Properties tables

CREATE TABLE IF NOT EXISTS g_argus_lexicon_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NULL,
    description TEXT NULL,
    category VARCHAR(255) NULL,
    status VARCHAR(50) DEFAULT 'active', -- active, deprecated, hidden
    is_reserved BOOLEAN DEFAULT FALSE,
    owner VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_project_event (project_id, event_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS g_argus_lexicon_properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    property_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NULL,
    description TEXT NULL,
    data_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, date
    status VARCHAR(50) DEFAULT 'active', -- active, deprecated, hidden
    is_reserved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_project_property (project_id, property_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
