---
sidebar_position: 1
---

# Job Management System

Gatrix includes a comprehensive job management system that allows you to schedule and execute various types of automated tasks.

## Overview

The job management system provides:

- **Multiple Job Types**: Email, HTTP requests, SSH commands, and logging
- **Flexible Scheduling**: Cron-like syntax for recurring jobs and one-time execution
- **Queue Management**: BullMQ-based reliable job processing
- **Real-time Monitoring**: Bull Board integration for queue monitoring
- **Retry Mechanisms**: Automatic retry with exponential backoff
- **Error Handling**: Comprehensive error logging and recovery

## Job Types

### 1. Mail Send Jobs (`mailsend`)

Send emails with template support and dynamic content.

**Configuration:**
```json
{
  "to": "user@example.com",
  "subject": "Welcome to Gatrix",
  "template": "welcome",
  "variables": {
    "username": "John Doe",
    "activationLink": "https://example.com/activate/123"
  }
}
```

**Features:**
- HTML and plain text templates
- Dynamic variable substitution
- Attachment support
- Multiple recipients (to, cc, bcc)
- SendGrid and SMTP support

### 2. HTTP Request Jobs (`http_request`)

Execute HTTP requests to external APIs or webhooks.

**Configuration:**
```json
{
  "url": "https://api.example.com/webhook",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer token123",
    "Content-Type": "application/json"
  },
  "body": {
    "event": "user_registered",
    "userId": 123,
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "timeout": 30000
}
```

**Features:**
- All HTTP methods (GET, POST, PUT, DELETE, etc.)
- Custom headers and authentication
- Request/response logging
- Timeout configuration
- Retry on failure

### 3. SSH Command Jobs (`ssh_command`)

Execute commands on remote servers via SSH.

**Configuration:**
```json
{
  "host": "server.example.com",
  "port": 22,
  "username": "admin",
  "command": "systemctl restart nginx",
  "timeout": 60000,
  "workingDirectory": "/var/www"
}
```

**Features:**
- Key-based or password authentication
- Command output capture
- Working directory specification
- Environment variable support
- Secure connection handling

### 4. Log Message Jobs (`log_message`)

Create structured log entries for audit trails and monitoring.

**Configuration:**
```json
{
  "level": "info",
  "message": "User login successful",
  "metadata": {
    "userId": 123,
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "timestamp": "2024-01-01T00:00:00Z"
  },
  "category": "authentication"
}
```

**Features:**
- Multiple log levels (debug, info, warn, error)
- Structured metadata
- Category-based organization
- Integration with Winston logger
- Searchable log entries

## Job Execution

Jobs are executed manually or through external scheduling systems. The job management system focuses on:

- **Manual Execution**: Jobs can be triggered manually from the admin interface
- **External Scheduling**: Integration with external schedulers (Cron, Kubernetes CronJobs, etc.)
- **API Execution**: Jobs can be triggered via REST API calls

### Manual Execution

Jobs can be executed immediately through the admin interface:

```javascript
// Execute job by ID
POST /api/jobs/{id}/execute
```

### API Integration

For programmatic execution:

```javascript
// Execute job via API
fetch('/api/jobs/123/execute', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
  }
});
```

## Job Configuration

### Basic Job Properties

```typescript
interface Job {
  id?: number;
  name: string;                    // Job display name
  jobTypeId: number;              // Job type (1=mailsend, 2=http_request, etc.)
  jobDataMap: object;             // Job-specific configuration
  memo?: string;                  // Additional notes
  isEnabled: boolean;             // Enable/disable job
  tags?: Tag[];                   // Associated tags
  createdBy?: number;             // Creator user ID
  updatedBy?: number;             // Last updater user ID
}
```

### Job Execution Properties

```typescript
interface JobExecution {
  id?: number;
  job_id: number;                 // Parent job ID
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: Date;              // Execution start time
  completed_at?: Date;            // Execution completion time
  result?: object;                // Execution result
  error_message?: string;         // Error details if failed
  retry_count: number;            // Retry attempt number
}
```

## Queue Management

### Queue Configuration

The job system uses BullMQ with the following configuration:

```typescript
{
  removeOnComplete: 100,          // Keep 100 completed jobs
  removeOnFail: 50,              // Keep 50 failed jobs
  attempts: 3,                   // Maximum retry attempts
  backoff: {
    type: 'exponential',         // Exponential backoff
    delay: 2000                  // Base delay: 2 seconds
  },
  concurrency: 5                 // Maximum concurrent jobs
}
```

### Queue Monitoring

Access the Bull Board dashboard at:
```
http://localhost:5001/admin/queues
```

Monitor:
- Active, waiting, completed, and failed jobs
- Job execution history and logs
- Queue performance metrics
- Real-time job status updates

## API Endpoints

### Job Management

```bash
# Get all jobs
GET /api/v1/jobs

# Get specific job
GET /api/v1/jobs/:id

# Create new job
POST /api/v1/jobs

# Update job
PUT /api/v1/jobs/:id

# Delete job
DELETE /api/v1/jobs/:id

# Execute job immediately
POST /api/v1/jobs/:id/execute
```

### Job Types

```bash
# Get all job types
GET /api/v1/job-types

# Get specific job type
GET /api/v1/job-types/:id
```

### Job Executions

```bash
# Get job execution history
GET /api/v1/jobs/:id/executions

# Get specific execution
GET /api/v1/job-executions/:id

# Retry failed execution
POST /api/v1/job-executions/:id/retry
```

## Usage Examples

### Creating an Email Job

```javascript
const emailJob = {
  name: "Welcome Email",
  job_type_id: 1, // mailsend
  job_data_map: {
    to: "{{user.email}}",
    subject: "Welcome to Gatrix",
    template: "welcome",
    variables: {
      username: "{{user.name}}",
      activationLink: "{{activation.url}}"
    }
  },
  description: "Send welcome email to new users",
  is_enabled: true,
  max_retry_count: 3,
  timeout_seconds: 60,
  schedule: null // One-time execution
};

// Create job
const response = await fetch('/api/v1/jobs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify(emailJob)
});
```

### Creating a Scheduled Backup Job

```javascript
const backupJob = {
  name: "Daily Database Backup",
  job_type_id: 3, // ssh_command
  job_data_map: {
    host: "backup.example.com",
    username: "backup",
    command: "/scripts/backup-database.sh",
    timeout: 1800000 // 30 minutes
  },
  description: "Daily backup of main database",
  is_enabled: true,
  max_retry_count: 2,
  timeout_seconds: 1800,
  schedule: "0 2 * * *" // Every day at 2 AM
};
```

### Creating a Webhook Job

```javascript
const webhookJob = {
  name: "User Registration Webhook",
  job_type_id: 2, // http_request
  job_data_map: {
    url: "https://analytics.example.com/events",
    method: "POST",
    headers: {
      "Authorization": "Bearer analytics-token",
      "Content-Type": "application/json"
    },
    body: {
      event: "user_registered",
      userId: "{{user.id}}",
      timestamp: "{{timestamp}}"
    }
  },
  description: "Send user registration event to analytics",
  is_enabled: true,
  max_retry_count: 5,
  timeout_seconds: 30
};
```

## Error Handling

### Retry Logic

Jobs automatically retry on failure with exponential backoff:

1. **First retry**: After 2 seconds
2. **Second retry**: After 4 seconds  
3. **Third retry**: After 8 seconds
4. **Final failure**: Job marked as failed

### Error Logging

All job errors are logged with:
- Error message and stack trace
- Job configuration and input data
- Execution context and timing
- Retry attempt information

### Monitoring and Alerts

Set up monitoring for:
- High failure rates
- Queue backlog growth
- Long-running jobs
- Resource usage spikes

## Best Practices

### Job Design

1. **Idempotent Operations**: Design jobs to be safely retryable
2. **Timeout Configuration**: Set appropriate timeouts for each job type
3. **Error Handling**: Include proper error handling in job logic
4. **Resource Management**: Avoid resource-intensive operations in jobs

### Scheduling

1. **Avoid Peak Hours**: Schedule heavy jobs during off-peak times
2. **Stagger Jobs**: Distribute job execution to avoid resource conflicts
3. **Monitor Performance**: Track job execution times and adjust schedules

### Security

1. **Credential Management**: Store sensitive data in environment variables
2. **Access Control**: Restrict job management to authorized users
3. **Audit Logging**: Log all job creation and modification activities
4. **Input Validation**: Validate all job configuration data

## Troubleshooting

### Common Issues

1. **Jobs Not Executing**: Check Redis connection and queue status
2. **High Failure Rate**: Review job configuration and external dependencies
3. **Memory Issues**: Monitor queue size and job complexity
4. **Performance Problems**: Check concurrency settings and resource usage

### Debugging

1. **Check Logs**: Review application and job execution logs
2. **Monitor Queues**: Use Bull Board to inspect queue status
3. **Test Jobs**: Execute jobs manually to isolate issues
4. **Validate Configuration**: Ensure job data is properly formatted
