#!/bin/bash

echo "====================================================="
echo "Starting MySQL with Docker"
echo "====================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed or not in PATH"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "ERROR: Docker is not running"
    echo "Please start Docker first"
    exit 1
fi

# MySQL container configuration
CONTAINER_NAME="gate-mysql"
MYSQL_ROOT_PASSWORD="root123"
MYSQL_DATABASE="uwo_gate"
MYSQL_USER="motif_dev"
MYSQL_PASSWORD="dev123$"
MYSQL_PORT="3306"

# Check if container already exists
if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "MySQL container '${CONTAINER_NAME}' already exists."
    
    # Check if it's running
    if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "Container is already running."
    else
        echo "Starting existing container..."
        docker start ${CONTAINER_NAME}
    fi
else
    echo "Creating and starting new MySQL container..."
    docker run -d \
        --name ${CONTAINER_NAME} \
        -e MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD} \
        -e MYSQL_DATABASE=${MYSQL_DATABASE} \
        -e MYSQL_USER=${MYSQL_USER} \
        -e MYSQL_PASSWORD=${MYSQL_PASSWORD} \
        -p ${MYSQL_PORT}:3306 \
        mysql:8.0 \
        --character-set-server=utf8mb4 \
        --collation-server=utf8mb4_unicode_ci
fi

echo ""
echo "Waiting for MySQL to be ready..."
sleep 10

# Wait for MySQL to be ready
for i in {1..30}; do
    if docker exec ${CONTAINER_NAME} mysqladmin ping -h localhost --silent; then
        echo "MySQL is ready!"
        break
    fi
    echo "Waiting for MySQL... ($i/30)"
    sleep 2
done

echo ""
echo "====================================================="
echo "MySQL Docker Container Started Successfully!"
echo "====================================================="
echo ""
echo "Container Name: ${CONTAINER_NAME}"
echo "MySQL Port: ${MYSQL_PORT}"
echo "Root Password: ${MYSQL_ROOT_PASSWORD}"
echo "Database: ${MYSQL_DATABASE}"
echo "User: ${MYSQL_USER}"
echo "Password: ${MYSQL_PASSWORD}"
echo ""
echo "Connection string:"
echo "mysql -h localhost -P ${MYSQL_PORT} -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DATABASE}"
echo ""
echo "To stop the container:"
echo "docker stop ${CONTAINER_NAME}"
echo ""
echo "To remove the container:"
echo "docker rm ${CONTAINER_NAME}"
echo ""
