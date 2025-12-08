/**
 * Gatrix Operations Dashboard Server
 * 
 * A simple web server for Docker Swarm management operations.
 * This is an internal tool - no authentication required.
 */

const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.DASHBOARD_PORT || 9999;
const STACK_NAME = process.env.STACK_NAME || 'gatrix';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Execute shell command
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message, stderr, stdout });
      } else {
        resolve({ success: true, stdout, stderr });
      }
    });
  });
}

// API Routes

// Get stack services
app.get('/api/services', async (req, res) => {
  const result = await execCommand(
    `docker stack services ${STACK_NAME} --format "{{json .}}"`
  );
  if (result.success) {
    const services = result.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));

    // Get update status for each service
    const servicesWithStatus = await Promise.all(services.map(async (svc) => {
      const inspectResult = await execCommand(
        `docker service inspect ${svc.Name} --format "{{json .UpdateStatus}}"`
      );
      if (inspectResult.success && inspectResult.stdout.trim()) {
        try {
          const updateStatus = JSON.parse(inspectResult.stdout.trim());
          svc.UpdateStatus = updateStatus;
        } catch (e) {
          svc.UpdateStatus = null;
        }
      }
      return svc;
    }));

    res.json({ success: true, services: servicesWithStatus });
  } else {
    res.json({ success: false, error: result.error });
  }
});

// Get service tasks
app.get('/api/services/:name/tasks', async (req, res) => {
  const serviceName = `${STACK_NAME}_${req.params.name}`;
  const result = await execCommand(
    `docker service ps ${serviceName} --format "{{json .}}" --no-trunc`
  );
  if (result.success) {
    const tasks = result.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
    res.json({ success: true, tasks });
  } else {
    res.json({ success: false, error: result.error });
  }
});

// Get version history from task history
app.get('/api/services/:name/versions', async (req, res) => {
  const serviceName = `${STACK_NAME}_${req.params.name}`;
  const result = await execCommand(
    `docker service ps ${serviceName} --format "{{.Image}}" --no-trunc`
  );
  if (result.success) {
    const images = result.stdout.trim().split('\n').filter(Boolean);
    // Extract unique full images (without hash) for accurate version tracking
    const uniqueImages = [...new Set(images.map(img => img.split('@')[0]))];
    // Extract tags from images
    const versions = uniqueImages.map(img => img.split(':').pop() || 'latest');
    // Get current image and tag
    const inspectResult = await execCommand(
      `docker service inspect ${serviceName} --format "{{.Spec.TaskTemplate.ContainerSpec.Image}}"`
    );
    let currentVersion = null;
    let currentImage = null;
    if (inspectResult.success) {
      currentImage = inspectResult.stdout.trim().split('@')[0];
      currentVersion = currentImage.split(':').pop() || 'latest';
    }
    res.json({ success: true, versions, currentVersion, currentImage });
  } else {
    res.json({ success: false, error: result.error });
  }
});

// Scale service (detached for immediate response)
app.post('/api/services/:name/scale', async (req, res) => {
  const serviceName = `${STACK_NAME}_${req.params.name}`;
  const { replicas } = req.body;
  // Use --detach to return immediately
  const result = await execCommand(`docker service scale ${serviceName}=${replicas} --detach`);
  res.json(result);
});

// Update service image
app.post('/api/services/:name/update', async (req, res) => {
  const serviceName = `${STACK_NAME}_${req.params.name}`;
  const { version, force } = req.body;

  // Get current image to determine base registry
  const inspectResult = await execCommand(
    `docker service inspect ${serviceName} --format "{{.Spec.TaskTemplate.ContainerSpec.Image}}"`
  );

  let image;
  if (inspectResult.success) {
    const currentImage = inspectResult.stdout.trim().split('@')[0]; // Remove hash
    const baseImage = currentImage.substring(0, currentImage.lastIndexOf(':')) || currentImage;
    // Use the base image path with new version tag
    image = `${baseImage}:${version}`;
  } else {
    // Fallback to production registry format
    let imageService = req.params.name;
    if (imageService === 'event-lens-worker') imageService = 'event-lens';
    image = `uwocn.tencentcloudcr.com/uwocn/uwocn:${imageService}-${version}`;
  }

  const forceFlag = force ? '--force' : '';

  const result = await execCommand(
    `docker service update --image ${image} ${forceFlag} ${serviceName}`
  );
  res.json(result);
});

// Get previous version info for rollback
app.get('/api/services/:name/previous', async (req, res) => {
  const serviceName = `${STACK_NAME}_${req.params.name}`;
  const result = await execCommand(
    `docker service inspect ${serviceName} --format "{{json .PreviousSpec}}"`
  );
  if (result.success && result.stdout.trim() !== 'null' && result.stdout.trim() !== '') {
    try {
      const prevSpec = JSON.parse(result.stdout.trim());
      const prevImage = prevSpec?.TaskTemplate?.ContainerSpec?.Image || null;
      // Extract version tag from image (e.g., "registry/image:backend-1.0.0@sha256:..." -> "backend-1.0.0")
      let prevVersion = null;
      if (prevImage) {
        // Remove @sha256:... hash if present
        const imageWithoutHash = prevImage.split('@')[0];
        // Get the tag part after ':'
        const tagPart = imageWithoutHash.split(':').pop();
        prevVersion = tagPart || null;
      }
      res.json({ success: true, hasPrevious: true, previousImage: prevImage, previousVersion: prevVersion });
    } catch (e) {
      res.json({ success: true, hasPrevious: false });
    }
  } else {
    res.json({ success: true, hasPrevious: false });
  }
});

// Rollback service
app.post('/api/services/:name/rollback', async (req, res) => {
  const serviceName = `${STACK_NAME}_${req.params.name}`;
  const result = await execCommand(`docker service rollback ${serviceName}`);
  res.json(result);
});

// Get service logs
app.get('/api/services/:name/logs', async (req, res) => {
  const serviceName = `${STACK_NAME}_${req.params.name}`;
  const tail = req.query.tail || 100;
  const result = await execCommand(
    `docker service logs ${serviceName} --tail ${tail} --no-task-ids`
  );
  res.json(result);
});

// Apply scaling preset
app.post('/api/presets/:preset', async (req, res) => {
  const presets = {
    minimal: { backend: 1, frontend: 1, 'event-lens': 1, 'event-lens-worker': 1, 'chat-server': 1, edge: 1 },
    standard: { backend: 2, frontend: 2, 'event-lens': 1, 'event-lens-worker': 2, 'chat-server': 1, edge: 2 },
    high: { backend: 4, frontend: 4, 'event-lens': 2, 'event-lens-worker': 4, 'chat-server': 1, edge: 8 }
  };
  
  const preset = presets[req.params.preset];
  if (!preset) {
    return res.json({ success: false, error: 'Unknown preset' });
  }
  
  const results = [];
  for (const [service, replicas] of Object.entries(preset)) {
    const serviceName = `${STACK_NAME}_${service}`;
    const result = await execCommand(`docker service scale ${serviceName}=${replicas} --detach`);
    results.push({ service, replicas, ...result });
  }

  res.json({ success: true, results });
});

// Get system info
app.get('/api/system', async (req, res) => {
  const [nodes, info] = await Promise.all([
    execCommand('docker node ls --format "{{json .}}"'),
    execCommand('docker system info --format "{{json .}}"')
  ]);
  res.json({ nodes: nodes.stdout, info: info.stdout });
});

// Get Docker images
app.get('/api/images', async (req, res) => {
  const result = await execCommand(
    'docker images uwocn.tencentcloudcr.com/uwocn/uwocn --format "{{json .}}"'
  );
  if (result.success) {
    const images = result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    res.json({ success: true, images });
  } else {
    res.json(result);
  }
});

// WebSocket for log streaming
wss.on('connection', (ws) => {
  let logProcess = null;
  let eventsProcess = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    // Service logs subscription
    if (data.action === 'subscribe' && data.service) {
      // Kill existing log process if any
      if (logProcess) {
        logProcess.kill();
        logProcess = null;
      }

      const serviceName = `${STACK_NAME}_${data.service}`;
      const tail = data.tail !== false; // Default to true

      if (tail) {
        // Realtime streaming with --follow
        logProcess = exec(`docker service logs ${serviceName} --follow --tail 50`);
        logProcess.stdout.on('data', (chunk) => ws.send(JSON.stringify({ type: 'log', data: chunk })));
        logProcess.stderr.on('data', (chunk) => ws.send(JSON.stringify({ type: 'log', data: chunk })));
      } else {
        // Static logs (last 100 lines, no follow)
        exec(`docker service logs ${serviceName} --tail 100`, (error, stdout, stderr) => {
          if (stdout) ws.send(JSON.stringify({ type: 'log', data: stdout }));
          if (stderr) ws.send(JSON.stringify({ type: 'log', data: stderr }));
        });
      }
    }

    // Docker events subscription (operations log)
    if (data.action === 'subscribe-events') {
      if (eventsProcess) {
        eventsProcess.kill();
        eventsProcess = null;
      }

      // Filter events for service operations
      const filter = `--filter type=service --filter type=container`;
      const format = `--format "{{.Time}} [{{.Type}}] {{.Action}}: {{.Actor.Attributes.name}}"`;
      eventsProcess = exec(`docker events ${filter} ${format}`);

      eventsProcess.stdout.on('data', (chunk) => {
        ws.send(JSON.stringify({ type: 'event', data: chunk }));
      });
      eventsProcess.stderr.on('data', (chunk) => {
        ws.send(JSON.stringify({ type: 'event', data: chunk }));
      });
    }

    // Unsubscribe from events
    if (data.action === 'unsubscribe-events') {
      if (eventsProcess) {
        eventsProcess.kill();
        eventsProcess = null;
      }
    }
  });

  ws.on('close', () => {
    if (logProcess) logProcess.kill();
    if (eventsProcess) eventsProcess.kill();
  });
});

// Start server
server.listen(PORT, () => {
  console.log('========================================');
  console.log('   Gatrix Operations Dashboard');
  console.log('========================================');
  console.log('');
  console.log(`  Dashboard running at: http://localhost:${PORT}`);
  console.log(`  Stack name: ${STACK_NAME}`);
  console.log('');
  console.log('  This is an internal operations tool.');
  console.log('  Do not expose to public internet.');
  console.log('');
});

