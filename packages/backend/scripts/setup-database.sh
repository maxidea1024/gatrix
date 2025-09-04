#!/bin/bash

echo "====================================================="
echo "Gatrix Project Database Setup"
echo "====================================================="
echo ""
echo "This script will create the 'uwo_gate' database and 'motif_dev' user."
echo "Please make sure MySQL server is running."
echo ""

# Check if MySQL is accessible
if ! command -v mysql &> /dev/null; then
    echo "ERROR: MySQL command not found. Please ensure MySQL is installed and added to PATH."
    echo ""
    echo "You can also run the SQL script manually:"
    echo "mysql -u root -p < scripts/setup-database.sql"
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Enter MySQL root password when prompted..."
echo ""

# Execute the SQL script
if mysql -u root -p < "$SCRIPT_DIR/setup-database.sql"; then
    echo ""
    echo "====================================================="
    echo "Database setup completed successfully!"
    echo "====================================================="
    echo ""
    echo "Database: uwo_gate"
    echo "User: motif_dev"
    echo "Password: dev123$"
    echo ""
    echo "You can now run the application with:"
    echo "  yarn dev"
    echo ""
else
    echo ""
    echo "====================================================="
    echo "Database setup failed!"
    echo "====================================================="
    echo ""
    echo "Please check the error messages above and try again."
    echo ""
    exit 1
fi
