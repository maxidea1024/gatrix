-- Seed script for generating 10000 crash events for testing
-- This creates ~100 crash groups with ~100 events each

-- First, create crash groups
SET @platforms = 'windows,ios,android,mac';
SET @branches = 'main,develop,qa_2025,release_1.0,hotfix_1.1';
SET @environments = 'development,staging,production,qa';
SET @firstLines = 'NullReferenceException: Object reference not set,IndexOutOfRangeException: Array index out of range,InvalidOperationException: Sequence contains no elements,ArgumentNullException: Value cannot be null,OutOfMemoryException: Insufficient memory,StackOverflowException: Stack overflow,IOException: File not found,TimeoutException: Connection timed out,AccessViolationException: Memory access violation,DivideByZeroException: Attempted to divide by zero';

-- Create procedure to generate crashes and events
DELIMITER //

DROP PROCEDURE IF EXISTS generate_crash_data//

CREATE PROCEDURE generate_crash_data()
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE j INT DEFAULT 0;
    DECLARE crash_id VARCHAR(26);
    DECLARE event_id VARCHAR(26);
    DECLARE first_event_id VARCHAR(26);
    DECLARE last_event_id VARCHAR(26);
    DECLARE crash_platform VARCHAR(50);
    DECLARE crash_branch VARCHAR(50);
    DECLARE crash_env VARCHAR(50);
    DECLARE crash_firstline VARCHAR(200);
    DECLARE crash_hash VARCHAR(32);
    DECLARE events_per_crash INT;
    DECLARE crash_count INT DEFAULT 0;
    DECLARE event_count INT DEFAULT 0;
    DECLARE random_days INT;
    DECLARE event_timestamp TIMESTAMP;
    DECLARE first_crash_time TIMESTAMP;
    DECLARE last_crash_time TIMESTAMP;
    
    -- Platform, branch, environment arrays
    DECLARE platforms_arr VARCHAR(200) DEFAULT 'windows,ios,android,mac';
    DECLARE branches_arr VARCHAR(200) DEFAULT 'main,develop,qa_2025,release_1.0,hotfix_1.1';
    DECLARE envs_arr VARCHAR(200) DEFAULT 'development,staging,production,qa';
    
    -- First lines for crashes
    DECLARE firstlines_arr VARCHAR(2000) DEFAULT 'NullReferenceException: Object reference not set|IndexOutOfRangeException: Array index out of range|InvalidOperationException: Sequence contains no elements|ArgumentNullException: Value cannot be null|OutOfMemoryException: Insufficient memory|StackOverflowException: Stack overflow|IOException: File not found|TimeoutException: Connection timed out|AccessViolationException: Memory access violation|DivideByZeroException: Attempted to divide by zero';
    
    -- Generate 100 crash groups
    WHILE i < 100 DO
        -- Generate ULID-like ID (26 chars)
        SET crash_id = CONCAT(
            LPAD(CONV(FLOOR(RAND() * POW(16, 8)), 10, 16), 8, '0'),
            LPAD(CONV(FLOOR(RAND() * POW(16, 8)), 10, 16), 8, '0'),
            LPAD(CONV(FLOOR(RAND() * POW(16, 10)), 10, 16), 10, '0')
        );
        
        -- Random platform
        SET crash_platform = ELT(FLOOR(1 + RAND() * 4), 'windows', 'ios', 'android', 'mac');
        
        -- Random branch
        SET crash_branch = ELT(FLOOR(1 + RAND() * 5), 'main', 'develop', 'qa_2025', 'release_1.0', 'hotfix_1.1');
        
        -- Random environment
        SET crash_env = ELT(FLOOR(1 + RAND() * 4), 'development', 'staging', 'production', 'qa');
        
        -- Random first line
        SET crash_firstline = ELT(FLOOR(1 + RAND() * 10),
            'NullReferenceException: Object reference not set',
            'IndexOutOfRangeException: Array index out of range',
            'InvalidOperationException: Sequence contains no elements',
            'ArgumentNullException: Value cannot be null',
            'OutOfMemoryException: Insufficient memory',
            'StackOverflowException: Stack overflow',
            'IOException: File not found',
            'TimeoutException: Connection timed out',
            'AccessViolationException: Memory access violation',
            'DivideByZeroException: Attempted to divide by zero'
        );
        
        -- Generate hash
        SET crash_hash = MD5(CONCAT(crash_firstline, crash_branch, i));
        
        -- Random number of events per crash (50-150)
        SET events_per_crash = FLOOR(50 + RAND() * 100);
        
        -- First crash time (random in last 30 days)
        SET first_crash_time = DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 30) DAY);
        SET last_crash_time = first_crash_time;
        
        -- Insert crash group
        INSERT INTO crashes (id, chash, branch, environment, platform, isEditor, firstLine, crashesCount, firstCrashAt, lastCrashAt, crashesState, maxAppVersion, createdAt, updatedAt)
        VALUES (crash_id, crash_hash, crash_branch, crash_env, crash_platform, FALSE, crash_firstline, events_per_crash, first_crash_time, first_crash_time, 0, CONCAT('1.', FLOOR(RAND()*10), '.', FLOOR(RAND()*100)), first_crash_time, NOW());
        
        SET crash_count = crash_count + 1;
        
        -- Generate events for this crash
        SET j = 0;
        WHILE j < events_per_crash DO
            -- Generate event ULID
            SET event_id = CONCAT(
                LPAD(CONV(FLOOR(RAND() * POW(16, 8)), 10, 16), 8, '0'),
                LPAD(CONV(FLOOR(RAND() * POW(16, 8)), 10, 16), 8, '0'),
                LPAD(CONV(FLOOR(RAND() * POW(16, 10)), 10, 16), 10, '0')
            );
            
            -- Random time within crash window
            SET event_timestamp = DATE_ADD(first_crash_time, INTERVAL FLOOR(RAND() * 30 * 24 * 60) MINUTE);
            
            IF j = 0 THEN
                SET first_event_id = event_id;
            END IF;
            SET last_event_id = event_id;
            
            IF event_timestamp > last_crash_time THEN
                SET last_crash_time = event_timestamp;
            END IF;
            
            -- Insert event
            INSERT INTO crash_events (id, crashId, platform, branch, environment, isEditor, appVersion, resVersion, accountId, gameUserId, userName, crashEventIp, createdAt)
            VALUES (
                event_id,
                crash_id,
                crash_platform,
                crash_branch,
                crash_env,
                FALSE,
                CONCAT('1.', FLOOR(RAND()*10), '.', FLOOR(RAND()*100)),
                CONCAT('r', FLOOR(RAND()*1000)),
                CONCAT('acc_', FLOOR(RAND()*100000)),
                CONCAT('user_', FLOOR(RAND()*100000)),
                ELT(FLOOR(1 + RAND() * 10), 'Player1', 'GameMaster', 'TestUser', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Phoenix', 'Dragon'),
                CONCAT(FLOOR(RAND()*256), '.', FLOOR(RAND()*256), '.', FLOOR(RAND()*256), '.', FLOOR(RAND()*256)),
                event_timestamp
            );
            
            SET event_count = event_count + 1;
            SET j = j + 1;
        END WHILE;
        
        -- Update crash with first/last event IDs and times
        UPDATE crashes SET firstCrashEventId = first_event_id, lastCrashEventId = last_event_id, lastCrashAt = last_crash_time WHERE id = crash_id;
        
        SET i = i + 1;
    END WHILE;
    
    SELECT CONCAT('Created ', crash_count, ' crashes with ', event_count, ' total events') AS result;
END//

DELIMITER ;

-- Run the procedure
CALL generate_crash_data();

-- Clean up
DROP PROCEDURE IF EXISTS generate_crash_data;

