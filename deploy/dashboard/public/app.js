/**
 * Gatrix Operations Dashboard - Main Application
 */

let ws = null;
let services = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  refreshAll();
  connectWebSocket();

  // ESC key to exit fullscreen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.logs-section.fullscreen').forEach(section => {
        section.classList.remove('fullscreen');
        const btn = section.querySelector('.btn-fullscreen');
        if (btn) btn.textContent = '⛶';
      });
    }
  });
});

// Toggle fullscreen for logs section
function toggleFullscreen(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const isFullscreen = section.classList.toggle('fullscreen');
  const btn = section.querySelector('.btn-fullscreen');
  if (btn) {
    btn.textContent = isFullscreen ? '✕' : '⛶';
  }
}

// Refresh all data
async function refreshAll() {
  await loadServices();
  document.getElementById('stackName').textContent = 'gatrix';
}

// Load services
async function loadServices(forceRender = false) {
  const grid = document.getElementById('servicesGrid');

  // Show loading only on first load
  if (!services.length || forceRender) {
    grid.innerHTML = `<div class="loading">${t('loading')}</div>`;
  }

  try {
    const response = await fetch('/api/services');
    const data = await response.json();

    if (!data.success || !data.services.length) {
      grid.innerHTML = `<div class="loading">${t('noServices')}</div>`;
      return;
    }

    const newServices = data.services;

    // First load or force render - full render
    if (!services.length || forceRender) {
      services = newServices;
      grid.innerHTML = services.map(svc => renderServiceCard(svc)).join('');
      updateLogServiceSelect();
      return;
    }

    // Incremental update - only update changed parts
    newServices.forEach(svc => {
      const name = svc.Name.replace('gatrix_', '');
      const card = grid.querySelector(`[data-service="${name}"]`);

      if (card) {
        // Update existing card in place
        updateServiceCard(card, svc);
      } else {
        // New service - append
        grid.insertAdjacentHTML('beforeend', renderServiceCard(svc));
      }
    });

    // Remove cards for services that no longer exist
    const currentNames = newServices.map(s => s.Name.replace('gatrix_', ''));
    grid.querySelectorAll('.service-card').forEach(card => {
      if (!currentNames.includes(card.dataset.service)) {
        card.remove();
      }
    });

    services = newServices;
    updateLogServiceSelect();
  } catch (error) {
    if (!services.length) {
      grid.innerHTML = `<div class="loading">${t('error')}: ${error.message}</div>`;
    }
  }
}

// Update service card in place (no flicker)
function updateServiceCard(card, svc) {
  const name = svc.Name.replace('gatrix_', '');
  const [running, desired] = svc.Replicas.split('/');
  const isHealthy = running === desired;
  const isPartial = parseInt(running) > 0 && parseInt(running) < parseInt(desired);
  const statusClass = isHealthy ? 'healthy' : (isPartial ? 'partial' : 'unhealthy');
  const statusText = isHealthy ? t('healthy') : (isPartial ? t('partial') : t('unhealthy'));

  // Extract version from image (remove @sha256:... hash)
  const imageTag = svc.Image.split('@')[0].split(':').pop() || 'latest';

  // Check if service is updating from server status
  const isUpdating = svc.UpdateStatus && svc.UpdateStatus.State === 'updating';

  // Update status dot
  const statusDot = card.querySelector('.status-dot');
  if (statusDot) {
    statusDot.className = `status-dot status-${statusClass}`;
    statusDot.nextSibling.textContent = statusText;
  }

  // Update replicas and tag
  const infoSpans = card.querySelectorAll('.service-info span');
  if (infoSpans[0]) infoSpans[0].textContent = `📊 ${t('replicas')}: ${svc.Replicas}`;
  if (infoSpans[1]) {
    infoSpans[1].innerHTML = `<span class="tag-chip">${imageTag}</span>`;
    infoSpans[1].title = svc.Image;
  }

  // Update updating state based on server status
  if (isUpdating) {
    if (!card.classList.contains('updating')) {
      card.classList.add('updating');
      // Add updating indicator if not present
      let indicator = card.querySelector('.updating-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'updating-indicator';
        indicator.innerHTML = `<span class="updating-spinner"></span> ${t('updating')}`;
        card.appendChild(indicator);
      }
      // Disable buttons
      card.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
    }
  } else {
    // Remove updating state if no longer updating
    if (card.classList.contains('updating')) {
      card.classList.remove('updating');
      const indicator = card.querySelector('.updating-indicator');
      if (indicator) indicator.remove();
      // Enable buttons
      card.querySelectorAll('.btn').forEach(btn => btn.disabled = false);
    }
  }
}

// Render service card
function renderServiceCard(svc) {
  const name = svc.Name.replace('gatrix_', '');
  const [running, desired] = svc.Replicas.split('/');
  const isHealthy = running === desired;
  const isPartial = parseInt(running) > 0 && parseInt(running) < parseInt(desired);
  const statusClass = isHealthy ? 'healthy' : (isPartial ? 'partial' : 'unhealthy');
  const statusText = isHealthy ? t('healthy') : (isPartial ? t('partial') : t('unhealthy'));

  // Extract version from image (remove @sha256:... hash)
  const imageTag = svc.Image.split('@')[0].split(':').pop() || 'latest';

  // Check if service is updating
  const isUpdating = svc.UpdateStatus && svc.UpdateStatus.State === 'updating';
  const updatingClass = isUpdating ? 'updating' : '';
  const buttonsDisabled = isUpdating ? 'disabled' : '';

  // Get target version from UpdateStatus message if available
  let updatingIndicator = '';
  if (isUpdating) {
    updatingIndicator = `
      <div class="updating-indicator">
        <span class="updating-spinner"></span> ${t('updating')}
      </div>
    `;
  }

  return `
    <div class="service-card ${updatingClass}" data-service="${name}">
      <div class="service-header">
        <span class="service-name">${name}</span>
        <span class="service-status">
          <span class="status-dot status-${statusClass}"></span>
          ${statusText}
        </span>
      </div>
      <div class="service-info">
        <span>📊 ${t('replicas')}: ${svc.Replicas}</span>
        <span class="service-version" title="${svc.Image}"><span class="tag-chip">${imageTag}</span></span>
      </div>
      <div class="service-actions">
        <button class="btn btn-small" onclick="scaleService('${name}')" title="${t('scale')}" ${buttonsDisabled}>
          📈 ${t('scale')}
        </button>
        <button class="btn btn-small btn-primary" onclick="updateService('${name}')" title="${t('update')}" ${buttonsDisabled}>
          ⬆️ ${t('update')}
        </button>
        <button class="btn btn-small btn-warning" onclick="rollbackService('${name}')" title="${t('rollback')}" ${buttonsDisabled}>
          ↩️ ${t('rollback')}
        </button>
        <button class="btn btn-small" onclick="viewTasks('${name}')" title="${t('tasks')}" ${buttonsDisabled}>
          📋 ${t('tasks')}
        </button>
      </div>
      ${updatingIndicator}
    </div>
  `;
}

// Dialog helper
let dialogResolve = null;

function showDialog(title, message, defaultValue = null) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    document.getElementById('dialogTitle').textContent = title;
    // Support line breaks in message
    const messageEl = document.getElementById('dialogMessage');
    messageEl.innerHTML = message.replace(/\n/g, '<br>');

    const inputWrapper = document.getElementById('dialogInputWrapper');
    const input = document.getElementById('dialogInput');

    if (defaultValue !== null) {
      inputWrapper.style.display = 'block';
      input.value = defaultValue;
      setTimeout(() => input.focus(), 100);
    } else {
      inputWrapper.style.display = 'none';
    }

    document.getElementById('dialogModal').classList.add('active');
  });
}

function closeDialog(confirmed) {
  document.getElementById('dialogModal').classList.remove('active');

  if (dialogResolve) {
    const input = document.getElementById('dialogInput');
    const inputWrapper = document.getElementById('dialogInputWrapper');

    if (confirmed) {
      if (inputWrapper.style.display !== 'none') {
        dialogResolve(input.value);
      } else {
        dialogResolve(true);
      }
    } else {
      dialogResolve(null);
    }
    dialogResolve = null;
  }
}

// Scale service
async function scaleService(name) {
  // Get current replicas for this service
  const currentService = services.find(s => s.Name === `gatrix_${name}`);
  const currentReplicas = currentService ? currentService.Replicas.split('/')[1] : '1';

  const replicas = await showDialog(
    t('scale'),
    t('confirmScale', { service: name }),
    currentReplicas
  );
  if (!replicas || isNaN(parseInt(replicas))) return;

  // Minimum 1 replica
  const replicaCount = Math.max(1, parseInt(replicas));

  try {
    // Set scaling state
    setServiceScaling(name, true, replicaCount);

    const response = await fetch(`/api/services/${name}/scale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replicas: replicaCount })
    });
    const data = await response.json();
    if (data.success) {
      showToast('info', t('scalingStarted', { service: name, replicas: replicaCount }));
      startProgressPolling(name, replicaCount);
    } else {
      showToast('error', data.error);
      setServiceScaling(name, false);
    }
  } catch (error) {
    showToast('error', error.message);
    setServiceScaling(name, false);
  }
}

// Polling for scaling progress
let pollingInterval = null;

function startProgressPolling(targetService, targetReplicas) {
  // Clear any existing polling
  if (pollingInterval) clearInterval(pollingInterval);

  let pollCount = 0;
  const maxPolls = 60; // Max 2 minutes (2s interval)

  pollingInterval = setInterval(async () => {
    pollCount++;

    try {
      const response = await fetch('/api/services');
      const data = await response.json();

      if (data.success && data.services) {
        const svc = data.services.find(s => s.Name === `gatrix_${targetService}`);
        if (svc) {
          const [running, desired] = svc.Replicas.split('/');

          // Update UI
          loadServices();

          // Check if scaling complete
          if (parseInt(running) === targetReplicas && parseInt(desired) === targetReplicas) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            setServiceScaling(targetService, false);
            showToast('success', t('scalingComplete', { service: targetService, replicas: targetReplicas }));
          }
        }
      }
    } catch (e) {
      // Continue polling
    }

    // Stop after max polls
    if (pollCount >= maxPolls) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      setServiceScaling(targetService, false);
    }
  }, 2000);
}

// Set service scaling state
function setServiceScaling(name, isScaling, targetReplicas = null) {
  const card = document.querySelector(`.service-card[data-service="${name}"]`);
  if (!card) return;

  if (isScaling) {
    card.classList.add('updating');
    // Show scaling indicator at bottom of card
    let indicator = card.querySelector('.updating-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'updating-indicator';
      card.appendChild(indicator);
    }
    indicator.innerHTML = `<span class="updating-spinner"></span> ${t('scalingTo', { replicas: targetReplicas })}`;
    // Disable buttons
    card.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
  } else {
    card.classList.remove('updating');
    const indicator = card.querySelector('.updating-indicator');
    if (indicator) indicator.remove();
    // Enable buttons
    card.querySelectorAll('.btn').forEach(btn => btn.disabled = false);
  }
}

// Set service updating state
function setServiceUpdating(name, isUpdating, targetVersion = null, isRollback = false) {
  const card = document.querySelector(`.service-card[data-service="${name}"]`);
  if (!card) return;

  if (isUpdating) {
    card.classList.add('updating');
    // Show updating indicator at bottom of card
    let indicator = card.querySelector('.updating-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'updating-indicator';
      card.appendChild(indicator);
    }
    const message = isRollback
      ? t('rollingBackTo', { version: targetVersion })
      : t('updatingTo', { version: targetVersion });
    indicator.innerHTML = `<span class="updating-spinner"></span> ${message}`;
    // Disable buttons
    card.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
  } else {
    card.classList.remove('updating');
    const indicator = card.querySelector('.updating-indicator');
    if (indicator) indicator.remove();
    // Enable buttons
    card.querySelectorAll('.btn').forEach(btn => btn.disabled = false);
  }
}

// Update service
async function updateService(name) {
  try {
    // Get version history
    const versionsResponse = await fetch(`/api/services/${name}/versions`);
    const versionsData = await versionsResponse.json();

    // Show version selection dialog
    const selectedVersion = await showVersionSelectDialog(
      t('update'),
      t('selectVersionToUpdate', { service: name }),
      versionsData.success ? versionsData.versions : [],
      versionsData.currentVersion,
      true // allowInput for new version
    );
    if (!selectedVersion) return;

    // Set updating state with target version
    setServiceUpdating(name, true, selectedVersion, false);

    const response = await fetch(`/api/services/${name}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: selectedVersion, force: false })
    });
    const data = await response.json();
    showToast(data.success ? 'success' : 'error', data.success ? t('operationSuccess') : data.error);
    if (data.success) {
      // Keep updating state and poll for completion
      pollServiceUpdate(name);
    } else {
      setServiceUpdating(name, false);
    }
  } catch (error) {
    showToast('error', error.message);
    setServiceUpdating(name, false);
  }
}

// Rollback service - show version history and select
async function rollbackService(name) {
  try {
    // Get version history
    const versionsResponse = await fetch(`/api/services/${name}/versions`);
    const versionsData = await versionsResponse.json();

    if (!versionsData.success || versionsData.versions.length <= 1) {
      showToast('error', t('noPreviousVersion'));
      return;
    }

    // Show version selection dialog
    const selectedVersion = await showVersionSelectDialog(
      t('rollback'),
      t('selectVersionToRollback', { service: name }),
      versionsData.versions,
      versionsData.currentVersion
    );
    if (!selectedVersion) return;

    // Set updating state with target version (rollback)
    setServiceUpdating(name, true, selectedVersion, true);

    // Update service to selected version
    const response = await fetch(`/api/services/${name}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: selectedVersion, force: true })
    });
    const data = await response.json();
    showToast(data.success ? 'success' : 'error', data.success ? t('operationSuccess') : data.error);
    if (data.success) {
      // Keep updating state and poll for completion
      pollServiceUpdate(name);
    } else {
      setServiceUpdating(name, false);
    }
  } catch (error) {
    showToast('error', error.message);
    setServiceUpdating(name, false);
  }
}

// Poll for service update completion
function pollServiceUpdate(name) {
  let pollCount = 0;
  const maxPolls = 60; // 2 minutes max

  const pollInterval = setInterval(async () => {
    pollCount++;
    try {
      const response = await fetch('/api/services');
      const data = await response.json();
      if (data.success) {
        const service = data.services.find(s => s.Name === `gatrix_${name}`);
        if (service) {
          const [running, desired] = service.Replicas.split('/');
          // Check if update is complete (all replicas running)
          if (running === desired && parseInt(running) > 0) {
            clearInterval(pollInterval);
            setServiceUpdating(name, false);
            loadServices();
            return;
          }
        }
      }
    } catch (error) {
      console.error('Poll error:', error);
    }

    if (pollCount >= maxPolls) {
      clearInterval(pollInterval);
      setServiceUpdating(name, false);
      loadServices();
    }
  }, 2000);
}

// Version select dialog
let versionDialogResolve = null;
let selectedVersionValue = null;

function showVersionSelectDialog(title, message, versions, currentVersion, allowInput = false) {
  return new Promise((resolve) => {
    versionDialogResolve = resolve;
    selectedVersionValue = null;

    const modal = document.getElementById('versionModal');
    document.getElementById('versionDialogTitle').textContent = title;
    document.getElementById('versionDialogMessage').textContent = message;

    const list = document.getElementById('versionList');

    // Add new version input if allowed
    const inputHtml = allowInput ? `
      <div class="version-input-wrapper">
        <input type="text" id="newVersionInput" class="version-input"
               placeholder="${t('enterNewVersion')}"
               oninput="onNewVersionInput(this)" />
      </div>
    ` : '';

    list.innerHTML = inputHtml + versions.map(v => {
      const isCurrent = v === currentVersion;
      return `
        <div class="version-item ${isCurrent ? 'current disabled' : ''}"
             ${isCurrent ? '' : `onclick="selectVersionItem(this, '${v}')"`}
             data-version="${v}">
          <span class="version-tag">${v}</span>
          ${isCurrent ? `<span class="version-badge">${t('current')}</span>` : ''}
        </div>
      `;
    }).join('');

    // Disable confirm button initially
    document.getElementById('versionConfirmBtn').disabled = true;

    modal.classList.add('active');
  });
}

function selectVersionItem(element, version) {
  // Remove selected class from all items
  document.querySelectorAll('.version-item').forEach(item => {
    item.classList.remove('selected');
  });
  // Clear new version input if exists
  const newVersionInput = document.getElementById('newVersionInput');
  if (newVersionInput) newVersionInput.value = '';

  // Add selected class to clicked item
  element.classList.add('selected');
  selectedVersionValue = version;
  // Enable confirm button
  document.getElementById('versionConfirmBtn').disabled = false;
}

function onNewVersionInput(input) {
  // Deselect version items when typing new version
  document.querySelectorAll('.version-item').forEach(item => {
    item.classList.remove('selected');
  });
  selectedVersionValue = input.value.trim();
  document.getElementById('versionConfirmBtn').disabled = !selectedVersionValue;
}

function confirmVersionSelection() {
  // Check if new version input has value
  const newVersionInput = document.getElementById('newVersionInput');
  if (newVersionInput && newVersionInput.value.trim()) {
    selectedVersionValue = newVersionInput.value.trim();
  }

  document.getElementById('versionModal').classList.remove('active');
  if (versionDialogResolve) {
    versionDialogResolve(selectedVersionValue);
    versionDialogResolve = null;
    selectedVersionValue = null;
  }
}

function closeVersionDialog() {
  document.getElementById('versionModal').classList.remove('active');
  if (versionDialogResolve) {
    versionDialogResolve(null);
    versionDialogResolve = null;
    selectedVersionValue = null;
  }
}

// View tasks
async function viewTasks(name) {
  try {
    const response = await fetch(`/api/services/${name}/tasks`);
    const data = await response.json();

    if (!data.success) {
      showToast('error', data.error);
      return;
    }

    const tasksHtml = data.tasks.map(task => `
      <div style="padding: 10px; margin: 8px 0; background: var(--bg-tertiary); border-radius: 6px;">
        <strong>${task.Name || task.ID}</strong><br>
        <span style="color: var(--text-secondary);">
          ${t('currentState')}: ${task.CurrentState}<br>
          ${t('node')}: ${task.Node || 'N/A'}
        </span>
      </div>
    `).join('');

    showModal(t('serviceDetails') + ': ' + name, tasksHtml || '<p>No tasks</p>');
  } catch (error) {
    showToast('error', error.message);
  }
}

// Preset configurations
const PRESETS = {
  minimal: { backend: 1, frontend: 1, 'event-lens': 1, 'chat-server': 1, edge: 1 },
  standard: { backend: 2, frontend: 2, 'event-lens': 1, 'chat-server': 1, edge: 2 },
  high: { backend: 4, frontend: 4, 'event-lens': 2, 'chat-server': 1, edge: 8 }
};

// Apply preset
async function applyPreset(preset) {
  const presetConfig = PRESETS[preset];
  if (!presetConfig) return;

  // Build details message
  const details = Object.entries(presetConfig)
    .map(([service, replicas]) => `  • ${service}: ${replicas}`)
    .join('\n');

  const confirmed = await showDialog(
    t('scalingPresets'),
    t('confirmPreset', { preset: t(preset) }) + '\n\n' + details
  );
  if (!confirmed) return;

  try {
    // Set scaling state for each service in preset
    Object.entries(presetConfig).forEach(([service, replicas]) => {
      setServiceScaling(service, true, replicas);
    });

    const response = await fetch(`/api/presets/${preset}`, { method: 'POST' });
    const data = await response.json();
    showToast(data.success ? 'success' : 'error',
      data.success ? t('presetApplied', { preset: t(preset) }) : data.error);
    if (data.success) {
      // Start polling for each service
      Object.entries(presetConfig).forEach(([service, replicas]) => {
        startPresetPolling(service, replicas);
      });
    } else {
      // Clear scaling state on error
      Object.keys(presetConfig).forEach(service => {
        setServiceScaling(service, false);
      });
    }
  } catch (error) {
    showToast('error', error.message);
    // Clear scaling state on error
    Object.keys(presetConfig).forEach(service => {
      setServiceScaling(service, false);
    });
  }
}

// Polling for preset scaling (individual service)
function startPresetPolling(targetService, targetReplicas) {
  let pollCount = 0;
  const maxPolls = 60;

  const intervalId = setInterval(async () => {
    pollCount++;

    try {
      const response = await fetch('/api/services');
      const data = await response.json();

      if (data.success && data.services) {
        const svc = data.services.find(s => s.Name === `gatrix_${targetService}`);
        if (svc) {
          const [running, desired] = svc.Replicas.split('/');

          // Check if scaling complete
          if (parseInt(running) === targetReplicas && parseInt(desired) === targetReplicas) {
            clearInterval(intervalId);
            setServiceScaling(targetService, false);
            loadServices();
          }
        }
      }
    } catch (e) {
      // Continue polling
    }

    if (pollCount >= maxPolls) {
      clearInterval(intervalId);
      setServiceScaling(targetService, false);
    }
  }, 2000);
}

// Update all services
async function updateAllServices() {
  const version = document.getElementById('versionInput').value.trim();
  if (!version) {
    showToast('error', t('enterVersion'));
    return;
  }

  const appServices = ['backend', 'frontend', 'event-lens', 'event-lens-worker', 'chat-server', 'edge'];

  for (const svcName of appServices) {
    try {
      await fetch(`/api/services/${svcName}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, force: false })
      });
    } catch (e) { /* continue */ }
  }

  showToast('success', t('allServicesUpdated'));
  refreshAll();
}

// Toggle Update All button based on version input
function toggleUpdateAllBtn() {
  const version = document.getElementById('versionInput').value.trim();
  const btn = document.getElementById('updateAllBtn');
  btn.disabled = !version;
}

// Update log service select
function updateLogServiceSelect() {
  const select = document.getElementById('logServiceSelect');
  const current = select.value;
  select.innerHTML = `<option value="">-- ${t('selectService')} --</option>`;
  services.forEach(svc => {
    const svcName = svc.Name.replace('gatrix_', '');
    select.innerHTML += `<option value="${svcName}" ${current === svcName ? 'selected' : ''}>${svcName}</option>`;
  });
}

// WebSocket connection for logs
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    // Auto-subscribe to events if checkbox is checked
    if (document.getElementById('opsLogCheckbox')?.checked) {
      ws.send(JSON.stringify({ action: 'subscribe-events' }));
    }
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'log') {
      appendLog(msg.data);
    } else if (msg.type === 'event') {
      appendOpsLog(msg.data);
    }
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

// Handle log service change
function handleLogServiceChange() {
  const service = document.getElementById('logServiceSelect').value;
  const isTail = document.getElementById('tailCheckbox').checked;
  if (service) {
    subscribeToLogs(service, isTail);
  }
}

// Handle tail checkbox change
function handleTailChange() {
  const service = document.getElementById('logServiceSelect').value;
  const isTail = document.getElementById('tailCheckbox').checked;
  if (service) {
    subscribeToLogs(service, isTail);
  }
}

// Subscribe to logs
function subscribeToLogs(service, tail = true) {
  if (!service || !ws) return;
  ws.send(JSON.stringify({ action: 'subscribe', service, tail }));
  document.getElementById('logsContainer').innerHTML = '';
}

// Append log line
function appendLog(text) {
  const container = document.getElementById('logsContainer');
  const lines = text.split('\n').filter(Boolean);
  lines.forEach(line => {
    const div = document.createElement('div');
    div.className = 'log-line';
    div.textContent = line;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

// Clear logs
function clearLogs() {
  document.getElementById('logsContainer').innerHTML = '';
}

// Toggle operations log subscription
function toggleOpsLog() {
  const isEnabled = document.getElementById('opsLogCheckbox').checked;
  if (ws && ws.readyState === WebSocket.OPEN) {
    if (isEnabled) {
      ws.send(JSON.stringify({ action: 'subscribe-events' }));
    } else {
      ws.send(JSON.stringify({ action: 'unsubscribe-events' }));
    }
  }
}

// Append to operations log
function appendOpsLog(data) {
  const container = document.getElementById('opsLogsContainer');
  const placeholder = container.querySelector('.log-placeholder');
  if (placeholder) placeholder.remove();

  const lines = data.split('\n').filter(line => line.trim());
  lines.forEach(line => {
    const div = document.createElement('div');
    div.className = 'log-line ops-log-line';

    // Color code based on action type
    if (line.includes('create') || line.includes('start')) {
      div.classList.add('ops-create');
    } else if (line.includes('kill') || line.includes('die') || line.includes('remove')) {
      div.classList.add('ops-remove');
    } else if (line.includes('update')) {
      div.classList.add('ops-update');
    }

    div.textContent = line;
    container.appendChild(div);
  });

  // Keep only last 200 lines
  while (container.children.length > 200) {
    container.removeChild(container.firstChild);
  }

  container.scrollTop = container.scrollHeight;
}

// Clear operations logs
function clearOpsLogs() {
  const container = document.getElementById('opsLogsContainer');
  container.innerHTML = `<div class="log-placeholder">${t('waitingForOps')}</div>`;
}

// Show modal
function showModal(title, content) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = content;
  document.getElementById('modal').classList.add('active');
}

// Close modal
function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

// Show toast notification
function showToast(type, message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.id === 'modal') {
    closeModal();
  }
  if (e.target.id === 'dialogModal') {
    closeDialog(false);
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDialog(false);
  }
  if (e.key === 'Enter' && document.getElementById('dialogModal').classList.contains('active')) {
    e.preventDefault();
    closeDialog(true);
  }
  if (e.key === 'r' && e.ctrlKey) {
    e.preventDefault();
    refreshAll();
  }
});
