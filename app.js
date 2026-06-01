const statusEl = document.getElementById('sensor-status');
const gyroX = document.getElementById('gyro-x');
const gyroY = document.getElementById('gyro-y');
const gyroZ = document.getElementById('gyro-z');
const roadQualityEl = document.getElementById('road-quality');
const permissionButton = document.getElementById('sensor-permission-button');
const chartCanvas = document.getElementById('orientation-chart');
const chartCtx = chartCanvas.getContext('2d');

const samples = [];
const HISTORY_MS = 30000;
const MAX_SAMPLES = 120;
const LINE_COLOR = '#a855f7';

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#dc2626' : '#111827';
}

function formatAngle(value) {
  return value === null || value === undefined ? 'n/a' : value.toFixed(2);
}

function normalizeAngleDelta(current, previous) {
  if (current === null || previous === null || current === undefined || previous === undefined) {
    return 0;
  }
  let delta = current - previous;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function computeRoadQuality(current, previous) {
  if (!previous) return 0;
  const dx = normalizeAngleDelta(current.x, previous.x);
  const dy = normalizeAngleDelta(current.y, previous.y);
  const dz = normalizeAngleDelta(current.z, previous.z);
  const motion = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Number(Math.min(100, motion * 3.5).toFixed(2));
}

function resizeChartCanvas() {
  const rect = chartCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  chartCanvas.width = Math.floor(rect.width * dpr);
  chartCanvas.height = Math.floor(260 * dpr);
  chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function pushSample(alpha, beta, gamma) {
  const timestamp = Date.now();
  const quality = computeRoadQuality({ x: alpha, y: beta, z: gamma }, samples[samples.length - 1]);
  samples.push({ timestamp, x: alpha, y: beta, z: gamma, quality });
  while (samples.length > MAX_SAMPLES) samples.shift();

  const cutoff = timestamp - HISTORY_MS;
  while (samples.length > 0 && samples[0].timestamp < cutoff) {
    samples.shift();
  }

  return quality;
}

function drawChart() {
  resizeChartCanvas();
  const width = chartCanvas.clientWidth;
  const height = 260;
  const padding = 40;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  chartCtx.clearRect(0, 0, width, height);
  chartCtx.fillStyle = '#ffffff';
  chartCtx.fillRect(0, 0, width, height);

  chartCtx.strokeStyle = '#e5e7eb';
  chartCtx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + (innerHeight / 4) * i;
    chartCtx.beginPath();
    chartCtx.moveTo(padding, y);
    chartCtx.lineTo(width - padding, y);
    chartCtx.stroke();
  }

  chartCtx.fillStyle = '#374151';
  chartCtx.font = '12px Inter, system-ui, sans-serif';
  chartCtx.fillText('Recent road quality', padding, padding - 12);

  if (!samples.length) {
    chartCtx.fillStyle = '#6b7280';
    chartCtx.fillText('Waiting for orientation data…', padding + 10, height / 2);
    return;
  }

  const minTime = samples[0].timestamp;
  const maxTime = samples[samples.length - 1].timestamp;
  const range = Math.max(maxTime - minTime, 1000);

  chartCtx.strokeStyle = LINE_COLOR;
  chartCtx.lineWidth = 2;
  chartCtx.beginPath();

  samples.forEach((sample, index) => {
    const x = padding + ((sample.timestamp - minTime) / range) * innerWidth;
    const y = padding + innerHeight - (sample.quality / 100) * innerHeight;

    if (index === 0) {
      chartCtx.moveTo(x, y);
    } else {
      chartCtx.lineTo(x, y);
    }
  });

  chartCtx.stroke();

  chartCtx.fillStyle = '#374151';
  chartCtx.font = '11px Inter, system-ui, sans-serif';
  chartCtx.fillText(`${Math.round(HISTORY_MS / 1000)}s window`, width - padding - 70, height - 12);
}

function handleOrientation(event) {
  const alpha = event.alpha;
  const beta = event.beta;
  const gamma = event.gamma;

  gyroX.textContent = formatAngle(alpha);
  gyroY.textContent = formatAngle(beta);
  gyroZ.textContent = formatAngle(gamma);

  const quality = pushSample(alpha, beta, gamma);
  roadQualityEl.textContent = quality.toFixed(2);
  setStatus('Device orientation running.');
  drawChart();
}

function startOrientationTracking() {
  window.addEventListener('deviceorientation', handleOrientation);
  setStatus('Tracking device orientation...');
  drawChart();
}

async function initOrientation() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    permissionButton.classList.remove('hidden');
    permissionButton.addEventListener('click', async () => {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          permissionButton.classList.add('hidden');
          startOrientationTracking();
        } else {
          setStatus('Permission denied for device orientation.', true);
        }
      } catch (error) {
        setStatus(`Permission request failed: ${error.message}`, true);
      }
    });
    setStatus('Tap the button to enable device orientation access.');
  } else if ('ondeviceorientation' in window || typeof DeviceOrientationEvent !== 'undefined') {
    startOrientationTracking();
  } else {
    setStatus('Device orientation is not supported in this browser.', true);
  }
}

window.addEventListener('resize', drawChart);
initOrientation();
