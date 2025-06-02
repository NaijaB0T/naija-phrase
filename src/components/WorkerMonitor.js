// Real-time worker monitoring component for admin panel
// Add this to your admin videos page

class WorkerMonitor {
  constructor(videoId, containerElement) {
    this.videoId = videoId;
    this.container = containerElement;
    this.isPolling = false;
    this.pollInterval = null;
    this.lastUpdate = null;
    
    this.init();
  }

  init() {
    this.container.innerHTML = this.getInitialHTML();
    this.startPolling();
  }

  getInitialHTML() {
    return `
      <div class="worker-monitor" data-video-id="${this.videoId}">
        <div class="monitor-header">
          <h4>🔄 Worker Status</h4>
          <button class="refresh-btn" onclick="this.forceRefresh()">Refresh</button>
        </div>
        <div class="status-content">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <div class="status-text">Checking status...</div>
          <div class="details"></div>
        </div>
      </div>
    `;
  }

  async startPolling() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    await this.updateStatus();
    
    // Poll every 5 seconds for active processing, every 30 seconds for completed
    this.pollInterval = setInterval(() => {
      this.updateStatus();
    }, 5000);
  }

  stopPolling() {
    this.isPolling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async updateStatus() {
    try {
      const response = await fetch(`/api/admin/worker-status?videoId=${this.videoId}`);
      const data = await response.json();
      
      if (response.ok) {
        this.renderStatus(data);
        
        // Stop polling if completed or error
        if (data.monitoring.stage === 'completed' || data.monitoring.stage.includes('error')) {
          this.stopPolling();
        }
      } else {
        this.renderError(data.error || 'Failed to get status');
      }
    } catch (error) {
      console.error('Worker monitor error:', error);
      this.renderError('Connection error');
    }
  }

  renderStatus(data) {
    const { video, monitoring } = data;
    
    // Update progress bar
    const progressFill = this.container.querySelector('.progress-fill');
    const statusText = this.container.querySelector('.status-text');
    const details = this.container.querySelector('.details');
    
    if (progressFill) {
      progressFill.style.width = `${monitoring.progress}%`;
      progressFill.className = `progress-fill ${this.getStatusColor(monitoring.stage)}`;
    }
    
    if (statusText) {
      statusText.textContent = this.getStatusMessage(monitoring);
    }
    
    if (details) {
      details.innerHTML = this.getDetailsHTML(video, monitoring);
    }
    
    this.lastUpdate = new Date();
  }

  getStatusColor(stage) {
    switch (stage) {
      case 'completed': return 'success';
      case 'stuck_fetching':
      case 'stuck_indexing':
      case 'error':
      case 'error_no_subtitles': return 'error';
      case 'waiting': return 'pending';
      default: return 'processing';
    }
  }

  getStatusMessage(monitoring) {
    switch (monitoring.stage) {
      case 'waiting': return '⏳ Waiting to start processing...';
      case 'fetching_subtitles': return '📥 Fetching subtitles from YouTube...';
      case 'indexing_phrases': return `📝 Indexing phrases (${monitoring.phraseCount} so far)...`;
      case 'completed': return `✅ Completed! Indexed ${monitoring.phraseCount} phrases`;
      case 'stuck_fetching': return `⚠️ Stuck fetching subtitles (${monitoring.timeSinceLastUpdate}m)`;
      case 'stuck_indexing': return `⚠️ Stuck indexing phrases (${monitoring.timeSinceLastUpdate}m)`;
      case 'error_no_subtitles': return '❌ No subtitles available';
      case 'error': return '❌ Processing error occurred';
      default: return '🔄 Processing...';
    }
  }

  getDetailsHTML(video, monitoring) {
    let html = `<div class="status-details">`;
    
    if (monitoring.isStuck) {
      html += `
        <div class="alert alert-warning">
          <strong>⚠️ Worker appears stuck!</strong><br>
          No progress for ${monitoring.timeSinceLastUpdate} minutes.<br>
          <button onclick="location.reload()" class="btn-retry">Refresh Page</button>
        </div>
      `;
    }
    
    if (video.error_message) {
      html += `
        <div class="alert alert-error">
          <strong>Error:</strong> ${video.error_message}
        </div>
      `;
    }
    
    html += `
      <div class="status-info">
        <small>
          📊 Phrases indexed: ${monitoring.phraseCount}<br>
          🕒 Last update: ${monitoring.timeSinceLastUpdate}m ago<br>
          📺 Video: ${video.youtube_video_id}
        </small>
      </div>
    `;
    
    html += `</div>`;
    return html;
  }

  renderError(error) {
    const statusText = this.container.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = `❌ ${error}`;
    }
  }

  forceRefresh() {
    this.updateStatus();
  }
}

// CSS for the monitor (add to your admin styles)
const monitorCSS = `
.worker-monitor {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  background: #f9f9f9;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.monitor-header h4 {
  margin: 0;
  color: #333;
}

.refresh-btn {
  padding: 4px 8px;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-fill.success { background: #4caf50; }
.progress-fill.error { background: #f44336; }
.progress-fill.processing { background: #2196f3; }
.progress-fill.pending { background: #ff9800; }

.status-text {
  font-weight: bold;
  margin-bottom: 8px;
}

.alert {
  padding: 8px;
  border-radius: 4px;
  margin: 8px 0;
}

.alert-warning {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
}

.alert-error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.btn-retry {
  padding: 4px 8px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 4px;
}

.status-info {
  font-size: 0.9em;
  color: #666;
  margin-top: 8px;
}
`;

// Auto-initialize monitors for videos in processing status
document.addEventListener('DOMContentLoaded', function() {
  // Add CSS
  const style = document.createElement('style');
  style.textContent = monitorCSS;
  document.head.appendChild(style);
  
  // Initialize monitors for processing videos
  const processingVideos = document.querySelectorAll('[data-video-status="Processing Subtitles"]');
  processingVideos.forEach(videoElement => {
    const videoId = videoElement.dataset.videoId;
    if (videoId) {
      const monitorContainer = document.createElement('div');
      videoElement.appendChild(monitorContainer);
      new WorkerMonitor(videoId, monitorContainer);
    }
  });
});

// Export for manual use
window.WorkerMonitor = WorkerMonitor;
