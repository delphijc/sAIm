/**
 * Memory Dashboard UI
 * Single-page application HTML for the memory management interface.
 * Dark-themed, professional dashboard for the AI assistant's cognitive memory system.
 */

export function getUIHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Memory Dashboard</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="shortcut icon" href="/favicon.ico">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-base: #0d1117;
      --bg-card: #161b22;
      --bg-card-hover: #1c2128;
      --bg-input: #0d1117;
      --bg-modal: #161b22;
      --border: #30363d;
      --border-focus: #58a6ff;
      --accent: #58a6ff;
      --accent-hover: #79b8ff;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --green: #3fb950;
      --yellow: #d29922;
      --red: #f85149;
      --red-hover: #da3633;
      --purple: #bc8cff;
      --orange: #f0883e;
      --badge-user-bg: #1f3358;
      --badge-user-text: #58a6ff;
      --badge-assistant-bg: #1a3625;
      --badge-assistant-text: #3fb950;
      --radius: 6px;
      --radius-lg: 10px;
      --shadow: 0 8px 24px rgba(0,0,0,0.4);
      --transition: 0.2s ease;
    }

    html, body {
      height: 100%;
      background: var(--bg-base);
      color: var(--text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }

    /* ─── Layout ─── */
    .app {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .header {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      height: 56px;
      flex-shrink: 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-title .brain { font-size: 20px; }

    .header-subtitle {
      color: var(--text-muted);
      font-size: 12px;
      margin-left: 4px;
    }

    .header-right {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 6px var(--green);
    }

    .status-label {
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* ─── Tabs ─── */
    .tab-nav {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      padding: 0 24px;
      display: flex;
      gap: 0;
      flex-shrink: 0;
    }

    .tab-btn {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      padding: 12px 16px;
      transition: color var(--transition), border-color var(--transition);
      white-space: nowrap;
    }

    .tab-btn:hover { color: var(--text-primary); }
    .tab-btn.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    .tab-content {
      flex: 1;
      overflow: auto;
    }

    .tab-panel {
      display: none;
      padding: 24px;
      animation: fadeIn 0.15s ease;
    }

    .tab-panel.active { display: block; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

    /* ─── Toolbar ─── */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .search-wrap {
      position: relative;
      flex: 1;
      min-width: 200px;
      max-width: 400px;
    }

    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
      font-size: 13px;
    }

    input[type="text"],
    input[type="number"],
    select,
    textarea {
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-primary);
      font-family: inherit;
      font-size: 14px;
      padding: 7px 12px;
      transition: border-color var(--transition);
      outline: none;
      width: 100%;
    }

    input[type="text"]:focus,
    input[type="number"]:focus,
    select:focus,
    textarea:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px rgba(88,166,255,0.1);
    }

    .search-wrap input { padding-left: 32px; }

    select { cursor: pointer; }

    /* ─── Buttons ─── */
    .btn {
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      padding: 7px 16px;
      transition: background var(--transition), opacity var(--transition), transform var(--transition);
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-primary { background: var(--accent); color: #0d1117; }
    .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }

    .btn-danger { background: var(--red); color: #fff; }
    .btn-danger:hover:not(:disabled) { background: var(--red-hover); }

    .btn-secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-secondary);
    }
    .btn-secondary:hover:not(:disabled) {
      border-color: var(--text-secondary);
      color: var(--text-primary);
    }

    .btn-ghost { background: transparent; color: var(--text-secondary); padding: 4px 8px; }
    .btn-ghost:hover:not(:disabled) { color: var(--text-primary); background: rgba(255,255,255,0.05); }

    .btn-sm { padding: 4px 10px; font-size: 12px; }

    /* ─── Table ─── */
    .table-wrap {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid var(--border);
    }

    th {
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      padding: 10px 16px;
      text-align: left;
      text-transform: uppercase;
      white-space: nowrap;
    }

    th.sortable { cursor: pointer; user-select: none; }
    th.sortable:hover { color: var(--text-primary); }
    th.sortable .sort-arrow { display: inline-block; margin-left: 4px; opacity: 0.4; transition: opacity var(--transition); }
    th.sortable:hover .sort-arrow,
    th.sort-active .sort-arrow { opacity: 1; color: var(--accent); }

    tbody tr {
      border-bottom: 1px solid var(--border);
      transition: background var(--transition);
      cursor: pointer;
    }

    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: var(--bg-card-hover); }

    td {
      color: var(--text-primary);
      padding: 10px 16px;
      vertical-align: middle;
    }

    .td-truncate {
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .td-mono {
      font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace;
      font-size: 12px;
      color: var(--text-secondary);
    }

    /* ─── Badges ─── */
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      white-space: nowrap;
    }

    .badge-green { background: rgba(63,185,80,0.15); color: var(--green); }
    .badge-yellow { background: rgba(210,153,34,0.15); color: var(--yellow); }
    .badge-red { background: rgba(248,81,73,0.15); color: var(--red); }
    .badge-user { background: var(--badge-user-bg); color: var(--badge-user-text); }
    .badge-assistant { background: var(--badge-assistant-bg); color: var(--badge-assistant-text); }

    .tag-pill {
      background: rgba(88,166,255,0.12);
      border: 1px solid rgba(88,166,255,0.2);
      border-radius: 20px;
      color: var(--accent);
      display: inline-flex;
      font-size: 11px;
      margin: 2px 2px 2px 0;
      padding: 1px 7px;
    }

    /* ─── Pagination ─── */
    .pagination {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      justify-content: center;
    }

    .pagination-info {
      color: var(--text-muted);
      font-size: 12px;
    }

    /* ─── Modal ─── */
    .modal-backdrop {
      background: rgba(0,0,0,0.7);
      bottom: 0;
      display: none;
      left: 0;
      position: fixed;
      right: 0;
      top: 0;
      z-index: 200;
      align-items: center;
      justify-content: center;
      padding: 24px;
      backdrop-filter: blur(4px);
    }

    .modal-backdrop.open { display: flex; }

    .modal {
      background: var(--bg-modal);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      max-width: 640px;
      overflow: hidden;
      width: 100%;
      animation: modalIn 0.2s ease;
    }

    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to { opacity: 1; transform: none; }
    }

    .modal-header {
      align-items: center;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-shrink: 0;
      gap: 12px;
      padding: 16px 20px;
    }

    .modal-title {
      flex: 1;
      font-size: 16px;
      font-weight: 600;
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .modal-footer {
      border-top: 1px solid var(--border);
      display: flex;
      flex-shrink: 0;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 20px;
    }

    /* ─── Form fields ─── */
    .field { margin-bottom: 16px; }

    .field:last-child { margin-bottom: 0; }

    .field label {
      color: var(--text-secondary);
      display: block;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-bottom: 6px;
      text-transform: uppercase;
    }

    textarea { min-height: 100px; resize: vertical; line-height: 1.6; }

    .slider-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    input[type="range"] {
      flex: 1;
      height: 4px;
      cursor: pointer;
      accent-color: var(--accent);
      background: var(--border);
      border: none;
      border-radius: 2px;
      outline: none;
      padding: 0;
    }

    .slider-value {
      color: var(--accent);
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 13px;
      min-width: 32px;
      text-align: right;
    }

    /* ─── Toast ─── */
    .toast-container {
      bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      position: fixed;
      right: 24px;
      z-index: 400;
    }

    .toast {
      align-items: center;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      color: var(--text-primary);
      display: flex;
      font-size: 13px;
      gap: 8px;
      max-width: 320px;
      min-width: 200px;
      padding: 10px 14px;
      pointer-events: all;
      animation: toastIn 0.3s ease;
    }

    .toast.toast-success { border-left-color: var(--green); }
    .toast.toast-error { border-left-color: var(--red); }

    .toast-icon { flex-shrink: 0; font-size: 14px; }
    .toast-msg { flex: 1; }

    @keyframes toastIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: none; }
    }

    @keyframes toastOut {
      from { opacity: 1; transform: none; }
      to { opacity: 0; transform: translateX(20px); }
    }

    /* ─── Loading Spinner ─── */
    .spinner {
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      display: inline-block;
      height: 16px;
      width: 16px;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .loading-row td {
      padding: 32px;
      text-align: center;
      color: var(--text-muted);
    }

    .empty-state {
      padding: 48px 24px;
      text-align: center;
      color: var(--text-muted);
    }

    .empty-state .empty-icon { font-size: 32px; margin-bottom: 8px; }

    /* ─── Stats Tab ─── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      transition: border-color var(--transition);
    }

    .stat-card:hover { border-color: var(--accent); }

    .stat-label {
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .stat-value {
      color: var(--text-primary);
      font-size: 28px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .stat-delta {
      color: var(--text-muted);
      font-size: 12px;
      margin-top: 4px;
    }

    .section-title {
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.06em;
      margin-bottom: 12px;
      text-transform: uppercase;
    }

    /* ─── Bar Chart ─── */
    .bar-chart {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      margin-bottom: 24px;
    }

    .bar-row {
      align-items: center;
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }

    .bar-row:last-child { margin-bottom: 0; }

    .bar-label {
      color: var(--text-secondary);
      font-size: 12px;
      min-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bar-track {
      background: rgba(255,255,255,0.05);
      border-radius: 3px;
      flex: 1;
      height: 8px;
      overflow: hidden;
    }

    .bar-fill {
      background: linear-gradient(90deg, var(--accent), var(--purple));
      border-radius: 3px;
      height: 100%;
      transition: width 0.5s ease;
    }

    .bar-count {
      color: var(--text-muted);
      font-size: 12px;
      min-width: 28px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* ─── Activity Timeline ─── */
    .activity-list {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .activity-item {
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      transition: background var(--transition);
    }

    .activity-item:last-child { border-bottom: none; }
    .activity-item:hover { background: var(--bg-card-hover); }

    .activity-dot {
      background: var(--accent);
      border-radius: 50%;
      flex-shrink: 0;
      height: 8px;
      margin-top: 6px;
      width: 8px;
    }

    .activity-content { flex: 1; min-width: 0; }
    .activity-topic { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .activity-meta { color: var(--text-muted); font-size: 12px; margin-top: 2px; }

    /* ─── Files Tab ─── */
    .files-layout {
      display: flex;
      gap: 16px;
      height: calc(100vh - 180px);
      min-height: 400px;
    }

    .files-sidebar {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      min-width: 220px;
      overflow: hidden;
      width: 260px;
      flex-shrink: 0;
    }

    .files-sidebar-header {
      border-bottom: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      padding: 10px 14px;
      text-transform: uppercase;
    }

    .files-list { flex: 1; overflow-y: auto; }

    .file-item {
      align-items: center;
      border-bottom: 1px solid transparent;
      cursor: pointer;
      display: flex;
      gap: 8px;
      padding: 10px 14px;
      transition: background var(--transition);
    }

    .file-item:hover { background: var(--bg-card-hover); }
    .file-item.active { background: rgba(88,166,255,0.1); border-left: 2px solid var(--accent); padding-left: 12px; }

    .file-icon { color: var(--text-muted); flex-shrink: 0; }
    .file-name { color: var(--text-primary); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-size { color: var(--text-muted); font-size: 11px; margin-left: auto; flex-shrink: 0; }

    .files-editor {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    .editor-toolbar {
      align-items: center;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-shrink: 0;
      gap: 8px;
      padding: 10px 14px;
    }

    .editor-filename {
      color: var(--accent);
      flex: 1;
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 13px;
    }

    .editor-area {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .editor-area textarea {
      border: none;
      border-radius: 0;
      box-sizing: border-box;
      flex: 1;
      font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace;
      font-size: 13px;
      line-height: 1.7;
      min-height: 0;
      padding: 16px;
      resize: none;
      width: 100%;
    }

    .editor-preview {
      box-sizing: border-box;
      display: none;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 16px 24px;
      width: 100%;
    }

    .editor-preview.active { display: block; }
    .editor-area textarea.hidden { display: none; }

    /* Basic Markdown Rendering */
    .md-preview h1, .md-preview h2, .md-preview h3 {
      color: var(--text-primary);
      margin: 16px 0 8px;
      line-height: 1.3;
    }
    .md-preview h1 { font-size: 22px; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    .md-preview h2 { font-size: 18px; }
    .md-preview h3 { font-size: 15px; color: var(--text-secondary); }
    .md-preview p { margin: 0 0 12px; color: var(--text-secondary); }
    .md-preview code {
      background: rgba(255,255,255,0.07);
      border-radius: 4px;
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 12px;
      padding: 2px 5px;
    }
    .md-preview pre {
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      margin: 12px 0;
      overflow-x: auto;
      padding: 12px;
    }
    .md-preview pre code { background: none; padding: 0; }
    .md-preview ul, .md-preview ol { padding-left: 20px; margin: 0 0 12px; color: var(--text-secondary); }
    .md-preview li { margin-bottom: 4px; }
    .md-preview blockquote {
      border-left: 3px solid var(--accent);
      color: var(--text-muted);
      margin: 12px 0;
      padding: 4px 12px;
    }
    .md-preview hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
    .md-preview a { color: var(--accent); text-decoration: none; }
    .md-preview a:hover { text-decoration: underline; }
    .md-preview strong { color: var(--text-primary); font-weight: 600; }

    .editor-placeholder {
      align-items: center;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 12px;
      justify-content: center;
    }

    .editor-placeholder-icon { font-size: 40px; opacity: 0.4; }

    /* ─── Scrollbars ─── */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

    /* ─── Responsive ─── */
    @media (max-width: 768px) {
      .tab-nav { overflow-x: auto; }
      .tab-panel { padding: 16px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .files-layout { flex-direction: column; height: auto; }
      .files-sidebar { width: 100%; height: 200px; }
      .files-editor { min-height: 400px; }
      .td-truncate { max-width: 150px; }
    }

    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr 1fr; }
      .header { padding: 0 16px; }
      .tab-panel { padding: 12px; }
    }

    /* ─── Graph Explorer ─── */
    .graph-layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 0;
      height: calc(100vh - 120px);
      min-height: 500px;
    }
    .graph-sidebar {
      background: var(--bg-card);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      padding: 0;
    }
    .graph-sidebar-section {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .graph-sidebar-section .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 10px;
    }
    .graph-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .graph-stat-item {
      background: var(--bg-base);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 10px;
      text-align: center;
    }
    .graph-stat-item .gs-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--accent);
      font-variant-numeric: tabular-nums;
    }
    .graph-stat-item .gs-label {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .graph-controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .graph-control-label {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-secondary);
      cursor: pointer;
    }
    .graph-control-label input[type="range"] {
      flex: 1;
      min-width: 80px;
      accent-color: var(--accent);
    }
    .graph-control-label input[type="checkbox"] {
      accent-color: var(--accent);
    }
    .graph-control-label span {
      font-variant-numeric: tabular-nums;
      min-width: 30px;
      text-align: right;
      color: var(--accent);
      font-weight: 600;
      font-size: 11px;
    }
    .graph-centrality-list, .graph-community-list {
      max-height: 200px;
      overflow-y: auto;
    }
    .graph-centrality-item, .graph-community-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 0;
      font-size: 12px;
      border-bottom: 1px solid rgba(48,54,61,0.5);
      cursor: pointer;
      transition: background var(--transition);
      padding: 5px 4px;
      border-radius: 3px;
    }
    .graph-centrality-item:hover, .graph-community-item:hover {
      background: var(--bg-card-hover);
    }
    .graph-centrality-item .gc-rank {
      color: var(--text-muted);
      font-size: 10px;
      min-width: 16px;
    }
    .graph-centrality-item .gc-topic {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-primary);
    }
    .graph-centrality-item .gc-score {
      color: var(--accent);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      font-size: 11px;
    }
    .graph-community-item .gc-color {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .graph-community-item .gc-info {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .graph-community-item .gc-size {
      color: var(--text-muted);
      font-size: 11px;
    }
    .graph-canvas-wrap {
      position: relative;
      background: var(--bg-base);
      overflow: hidden;
    }
    #graphCanvas {
      width: 100%;
      height: 100%;
      display: block;
      cursor: grab;
    }
    #graphCanvas:active { cursor: grabbing; }
    .graph-tooltip {
      display: none;
      position: absolute;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 14px;
      font-size: 12px;
      color: var(--text-primary);
      box-shadow: var(--shadow);
      pointer-events: none;
      max-width: 300px;
      z-index: 50;
      line-height: 1.6;
    }
    .graph-tooltip .gt-topic {
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 4px;
    }
    .graph-tooltip .gt-summary {
      color: var(--text-secondary);
      font-size: 11px;
      margin-bottom: 6px;
    }
    .graph-tooltip .gt-meta {
      display: flex;
      gap: 10px;
      font-size: 10px;
      color: var(--text-muted);
    }
    .graph-legend {
      position: absolute;
      bottom: 12px;
      right: 12px;
      background: rgba(22,27,34,0.9);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 12px;
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      gap: 14px;
    }
    .graph-legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .graph-legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .graph-detail-panel {
      background: var(--bg-card);
      border-top: 1px solid var(--border);
      padding: 12px 20px;
      max-height: 200px;
      overflow-y: auto;
    }
    .graph-detail-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .graph-detail-body {
      font-size: 13px;
      line-height: 1.6;
    }
    .graph-detail-body .gd-row {
      display: flex;
      gap: 8px;
      padding: 3px 0;
      border-bottom: 1px solid rgba(48,54,61,0.3);
    }
    .graph-detail-body .gd-label {
      color: var(--text-muted);
      min-width: 90px;
      font-size: 12px;
    }
    .graph-detail-body .gd-value {
      color: var(--text-primary);
      font-size: 12px;
    }

    @media (max-width: 768px) {
      .graph-layout { grid-template-columns: 1fr; height: auto; }
      .graph-sidebar { max-height: 250px; }
      .graph-canvas-wrap { height: 400px; }
    }
  </style>
</head>
<body>

<div class="app">
  <!-- Header -->
  <header class="header">
    <div class="header-title">
      <span class="brain">&#x1F9E0;</span>
      Memory Dashboard
      <span class="header-subtitle">v1.0</span>
    </div>
    <div class="header-right">
      <div class="status-dot" id="statusDot"></div>
      <span class="status-label" id="statusLabel">Connecting...</span>
    </div>
  </header>

  <!-- Tab Navigation -->
  <nav class="tab-nav">
    <button class="tab-btn active" data-tab="semantic">Semantic Memories</button>
    <button class="tab-btn" data-tab="conversations">Conversations</button>
    <button class="tab-btn" data-tab="files">Memory Files</button>
    <button class="tab-btn" data-tab="stats">Stats</button>
    <button class="tab-btn" data-tab="graph">Graph Explorer</button>
  </nav>

  <div class="tab-content">

    <!-- ── Tab: Semantic Memories ── -->
    <div class="tab-panel active" id="tab-semantic">
      <div class="toolbar">
        <div class="search-wrap">
          <span class="search-icon">&#128269;</span>
          <input type="text" id="semanticSearch" placeholder="Search topics and summaries..." />
        </div>
        <button class="btn btn-secondary btn-sm" id="semanticRefresh">&#8635; Refresh</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Summary</th>
              <th class="sortable" data-sort="confidence">Confidence <span class="sort-arrow">&#8597;</span></th>
              <th>Tags</th>
              <th>Source</th>
              <th class="sortable" data-sort="created_at">Created <span class="sort-arrow">&#8597;</span></th>
              <th class="sortable" data-sort="access_count">Accesses <span class="sort-arrow">&#8597;</span></th>
              <th></th>
            </tr>
          </thead>
          <tbody id="semanticBody">
            <tr class="loading-row"><td colspan="8"><span class="spinner"></span></td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination" id="semanticPagination"></div>
    </div>

    <!-- ── Tab: Conversations ── -->
    <div class="tab-panel" id="tab-conversations">
      <div class="toolbar">
        <div class="search-wrap">
          <span class="search-icon">&#128269;</span>
          <input type="text" id="convSearch" placeholder="Search conversations..." />
        </div>
        <select id="convRole" style="width:160px">
          <option value="all">All Roles</option>
          <option value="user">User</option>
          <option value="assistant">Assistant</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="convRefresh">&#8635; Refresh</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Content</th>
              <th>Session</th>
              <th>Timestamp</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="convBody">
            <tr class="loading-row"><td colspan="5"><span class="spinner"></span></td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination" id="convPagination"></div>
    </div>

    <!-- ── Tab: Memory Files ── -->
    <div class="tab-panel" id="tab-files">
      <div class="files-layout">
        <div class="files-sidebar">
          <div class="files-sidebar-header">Files</div>
          <div class="files-list" id="filesList">
            <div style="padding:24px;color:var(--text-muted);text-align:center"><span class="spinner"></span></div>
          </div>
        </div>
        <div class="files-editor" id="filesEditor">
          <div class="editor-placeholder">
            <div class="editor-placeholder-icon">&#128196;</div>
            <div>Select a file to edit</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Tab: Stats ── -->
    <div class="tab-panel" id="tab-stats">
      <div class="stats-grid" id="statsCards">
        <div class="stat-card"><div class="stat-label">Loading...</div><div class="stat-value">—</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div class="section-title">Skill Usage</div>
          <div id="skillUsageTable" style="overflow-x:auto">
            <div style="color:var(--text-muted);text-align:center;padding:16px"><span class="spinner"></span></div>
          </div>
        </div>
        <div>
          <div class="section-title">Agent Usage</div>
          <div id="agentUsageTable" style="overflow-x:auto">
            <div style="color:var(--text-muted);text-align:center;padding:16px"><span class="spinner"></span></div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
        <div>
          <div class="section-title">Topic Distribution</div>
          <div class="bar-chart" id="barChart">
            <div style="color:var(--text-muted);text-align:center;padding:16px"><span class="spinner"></span></div>
          </div>
        </div>
        <div>
          <div class="section-title">Recent Activity</div>
          <div class="activity-list" id="activityList">
            <div style="padding:24px;color:var(--text-muted);text-align:center"><span class="spinner"></span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Tab: Graph Explorer ── -->
    <div class="tab-panel" id="tab-graph">
      <div class="graph-layout">
        <div class="graph-sidebar">
          <div class="graph-sidebar-section">
            <div class="section-title">Graph Stats</div>
            <div id="graphStats" class="graph-stats-grid">
              <div style="padding:12px;color:var(--text-muted);text-align:center"><span class="spinner"></span></div>
            </div>
          </div>
          <div class="graph-sidebar-section">
            <div class="section-title">Controls</div>
            <div class="graph-controls">
              <label class="graph-control-label">Min Weight
                <input type="range" id="graphMinWeight" min="0" max="1" step="0.05" value="0" />
                <span id="graphMinWeightVal">0.00</span>
              </label>
              <label class="graph-control-label">Max Depth (BFS)
                <input type="range" id="graphMaxDepth" min="1" max="6" step="1" value="3" />
                <span id="graphMaxDepthVal">3</span>
              </label>
              <label class="graph-control-label">
                <input type="checkbox" id="graphShowLabels" checked /> Show Labels
              </label>
              <label class="graph-control-label">
                <input type="checkbox" id="graphShowCommunities" /> Color by Community
              </label>
              <button class="btn btn-secondary btn-sm" id="graphResetBtn" style="width:100%">Reset View</button>
            </div>
          </div>
          <div class="graph-sidebar-section">
            <div class="section-title">Top Nodes (Centrality)</div>
            <div id="graphCentrality" class="graph-centrality-list">
              <div style="padding:12px;color:var(--text-muted);text-align:center"><span class="spinner"></span></div>
            </div>
          </div>
          <div class="graph-sidebar-section">
            <div class="section-title">Communities</div>
            <div id="graphCommunities" class="graph-community-list">
              <div style="padding:12px;color:var(--text-muted);text-align:center"><span class="spinner"></span></div>
            </div>
          </div>
        </div>
        <div class="graph-canvas-wrap">
          <canvas id="graphCanvas"></canvas>
          <div class="graph-tooltip" id="graphTooltip"></div>
          <div class="graph-legend" id="graphLegend"></div>
        </div>
      </div>
      <div class="graph-detail-panel" id="graphDetailPanel" style="display:none">
        <div class="graph-detail-header">
          <span class="section-title" id="graphDetailTitle">Node Details</span>
          <button class="btn btn-ghost btn-sm" id="graphDetailClose">&#10005;</button>
        </div>
        <div class="graph-detail-body" id="graphDetailBody"></div>
      </div>
    </div>

  </div><!-- /tab-content -->
</div><!-- /app -->

<!-- ── Modal: Semantic Edit ── -->
<div class="modal-backdrop" id="semanticModal">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title" id="semanticModalTitle">Edit Memory</div>
      <button class="btn btn-ghost btn-sm" id="semanticModalClose">&#10005;</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Topic</label>
        <input type="text" id="editTopic" />
      </div>
      <div class="field">
        <label>Summary</label>
        <textarea id="editSummary"></textarea>
      </div>
      <div class="field">
        <label>Confidence</label>
        <div class="slider-wrap">
          <input type="range" id="editConfidence" min="0" max="1" step="0.01" />
          <span class="slider-value" id="editConfidenceVal">0.80</span>
        </div>
      </div>
      <div class="field">
        <label>Tags (comma-separated)</label>
        <input type="text" id="editTags" placeholder="e.g. architecture, memory, sqlite" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-danger" id="semanticDeleteBtn">Delete</button>
      <div style="flex:1"></div>
      <button class="btn btn-secondary" id="semanticCancelBtn">Cancel</button>
      <button class="btn btn-primary" id="semanticSaveBtn">Save Changes</button>
    </div>
  </div>
</div>

<!-- ── Modal: Conversation View ── -->
<div class="modal-backdrop" id="convModal">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title" id="convModalTitle">Conversation</div>
      <button class="btn btn-ghost btn-sm" id="convModalClose">&#10005;</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
        <span id="convModalBadge" class="badge"></span>
        <span class="td-mono" id="convModalSession"></span>
        <span style="margin-left:auto;color:var(--text-muted);font-size:12px" id="convModalTime"></span>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--radius);padding:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word;font-size:13px;max-height:400px;overflow-y:auto" id="convModalContent"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-danger btn-sm" id="convDeleteBtn">Delete</button>
      <div style="flex:1"></div>
      <button class="btn btn-secondary" id="convCancelBtn">Close</button>
    </div>
  </div>
</div>

<!-- ── Toast Container ── -->
<div class="toast-container" id="toastContainer"></div>

<script>
(function() {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────
  const state = {
    semantic: { items: [], offset: 0, limit: 50, total: 0, sort: 'created_at', order: 'desc', search: '' },
    conv: { items: [], offset: 0, limit: 50, total: 0, search: '', role: 'all' },
    files: { list: [], selectedFile: null, content: '', previewMode: false },
    editing: { semanticId: null, convId: null },
  };

  // ── API Helpers ────────────────────────────────────────────────────────
  async function apiFetch(url, opts = {}) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      throw e;
    }
  }

  // ── Toast ──────────────────────────────────────────────────────────────
  function toast(msg, type = 'info') {
    const icons = { success: '&#10003;', error: '&#10005;', info: '&#8505;' };
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type === 'error' ? 'error' : 'success');
    el.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
                   '<span class="toast-msg">' + esc(msg) + '</span>';
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // ── Escape HTML ────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Format helpers ─────────────────────────────────────────────────────
  function fmtDate(ts) {
    if (!ts) return '—';
    const n = typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts;
    return new Date(n).toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function fmtSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function confidenceBadge(c) {
    const pct = Math.round((c ?? 0) * 100);
    const cls = c >= 0.8 ? 'badge-green' : c >= 0.5 ? 'badge-yellow' : 'badge-red';
    return '<span class="badge ' + cls + '">' + pct + '%</span>';
  }

  function roleBadge(role) {
    const cls = role === 'user' ? 'badge-user' : 'badge-assistant';
    return '<span class="badge ' + cls + '">' + esc(role) + '</span>';
  }

  function renderTags(tags) {
    if (!tags || !tags.length) return '<span style="color:var(--text-muted)">—</span>';
    return tags.slice(0, 3).map(t => '<span class="tag-pill">' + esc(t) + '</span>').join('');
  }

  // ── Connection Status ──────────────────────────────────────────────────
  async function checkStatus() {
    try {
      await fetch('/api/stats');
      document.getElementById('statusDot').style.background = 'var(--green)';
      document.getElementById('statusDot').style.boxShadow = '0 0 6px var(--green)';
      document.getElementById('statusLabel').textContent = 'Connected';
    } catch {
      document.getElementById('statusDot').style.background = 'var(--red)';
      document.getElementById('statusDot').style.boxShadow = '0 0 6px var(--red)';
      document.getElementById('statusLabel').textContent = 'Offline';
    }
  }

  // ── Tabs ───────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
      // Lazy-load on first visit
      const tab = btn.dataset.tab;
      if (tab === 'semantic' && state.semantic.items.length === 0) loadSemantic();
      if (tab === 'conversations' && state.conv.items.length === 0) loadConversations();
      if (tab === 'files' && state.files.list.length === 0) loadFiles();
      if (tab === 'stats') loadStats();
      if (tab === 'graph') initGraph();
    });
  });

  // ── Pagination Helper ──────────────────────────────────────────────────
  function renderPagination(containerId, st, loadFn) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const total = st.total;
    const pages = Math.ceil(total / st.limit);
    const currentPage = Math.floor(st.offset / st.limit) + 1;

    const info = document.createElement('span');
    info.className = 'pagination-info';
    const from = total === 0 ? 0 : st.offset + 1;
    const to = Math.min(st.offset + st.limit, total);
    info.textContent = from + '–' + to + ' of ' + total;
    container.appendChild(info);

    if (pages <= 1) return;

    const prev = document.createElement('button');
    prev.className = 'btn btn-secondary btn-sm';
    prev.textContent = '← Prev';
    prev.disabled = currentPage <= 1;
    prev.addEventListener('click', () => { st.offset = Math.max(0, st.offset - st.limit); loadFn(); });
    container.appendChild(prev);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = 'Page ' + currentPage + ' / ' + pages;
    container.appendChild(pageInfo);

    const next = document.createElement('button');
    next.className = 'btn btn-secondary btn-sm';
    next.textContent = 'Next →';
    next.disabled = currentPage >= pages;
    next.addEventListener('click', () => { st.offset = Math.min((pages - 1) * st.limit, st.offset + st.limit); loadFn(); });
    container.appendChild(next);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SEMANTIC MEMORIES
  // ═══════════════════════════════════════════════════════════════════════
  async function loadSemantic() {
    const tbody = document.getElementById('semanticBody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="8"><span class="spinner"></span></td></tr>';
    const st = state.semantic;
    const params = new URLSearchParams({
      limit: st.limit, offset: st.offset, sort: st.sort, order: st.order
    });
    if (st.search) params.set('search', st.search);
    try {
      const data = await apiFetch('/api/semantic?' + params);
      st.items = data.items ?? data ?? [];
      st.total = data.total ?? st.items.length;
      renderSemanticTable();
      renderPagination('semanticPagination', st, loadSemantic);
    } catch (e) {
      tbody.innerHTML = '<tr class="loading-row"><td colspan="8" style="color:var(--red)">Failed to load: ' + esc(e.message) + '</td></tr>';
    }
  }

  function renderSemanticTable() {
    const tbody = document.getElementById('semanticBody');
    const items = state.semantic.items;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">&#128193;</div><div>No memories found</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = items.map(item => {
      const tags = Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(',').map(t => t.trim()).filter(Boolean) : []);
      return '<tr data-id="' + esc(item.id) + '">' +
        '<td><strong>' + esc(item.topic ?? '—') + '</strong></td>' +
        '<td class="td-truncate" style="max-width:260px;color:var(--text-secondary)">' + esc(item.summary ?? '') + '</td>' +
        '<td>' + confidenceBadge(item.confidence ?? item.relevance_score ?? 0) + '</td>' +
        '<td>' + renderTags(tags) + '</td>' +
        '<td class="td-mono">' + esc(item.source ?? '—') + '</td>' +
        '<td class="td-mono" style="font-size:11px">' + esc(fmtDate(item.created_at ?? item.createdAt)) + '</td>' +
        '<td style="text-align:center;color:var(--text-secondary)">' + (item.access_count ?? item.accessCount ?? 0) + '</td>' +
        '<td><button class="btn btn-ghost btn-sm edit-sem-btn" data-id="' + esc(item.id) + '">Edit</button></td>' +
      '</tr>';
    }).join('');
  }

  // Sort headers
  document.querySelectorAll('#tab-semantic th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const st = state.semantic;
      const col = th.dataset.sort;
      if (st.sort === col) {
        st.order = st.order === 'desc' ? 'asc' : 'desc';
      } else {
        st.sort = col;
        st.order = 'desc';
      }
      document.querySelectorAll('#tab-semantic th.sortable').forEach(h => h.classList.remove('sort-active'));
      th.classList.add('sort-active');
      th.querySelector('.sort-arrow').textContent = st.order === 'desc' ? '↓' : '↑';
      st.offset = 0;
      loadSemantic();
    });
  });

  // Search with debounce
  let semanticSearchTimer;
  document.getElementById('semanticSearch').addEventListener('input', e => {
    clearTimeout(semanticSearchTimer);
    semanticSearchTimer = setTimeout(() => {
      state.semantic.search = e.target.value;
      state.semantic.offset = 0;
      loadSemantic();
    }, 300);
  });

  document.getElementById('semanticRefresh').addEventListener('click', loadSemantic);

  // Row click / edit button
  document.getElementById('semanticBody').addEventListener('click', async e => {
    const btn = e.target.closest('.edit-sem-btn');
    const row = e.target.closest('tr[data-id]');
    if (btn) {
      e.stopPropagation();
      openSemanticModal(btn.dataset.id);
    } else if (row) {
      openSemanticModal(row.dataset.id);
    }
  });

  async function openSemanticModal(id) {
    state.editing.semanticId = id;
    const item = state.semantic.items.find(i => String(i.id) === String(id));
    if (!item) {
      toast('Memory not found', 'error');
      return;
    }
    document.getElementById('semanticModalTitle').textContent = 'Edit Memory';
    document.getElementById('editTopic').value = item.topic ?? '';
    document.getElementById('editSummary').value = item.summary ?? '';
    const conf = item.confidence ?? item.relevance_score ?? 0.8;
    document.getElementById('editConfidence').value = conf;
    document.getElementById('editConfidenceVal').textContent = Number(conf).toFixed(2);
    const tags = Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(',').map(t => t.trim()).filter(Boolean) : []);
    document.getElementById('editTags').value = tags.join(', ');
    document.getElementById('semanticModal').classList.add('open');
    document.getElementById('editTopic').focus();
  }

  document.getElementById('editConfidence').addEventListener('input', e => {
    document.getElementById('editConfidenceVal').textContent = Number(e.target.value).toFixed(2);
  });

  document.getElementById('semanticModalClose').addEventListener('click', closeSemanticModal);
  document.getElementById('semanticCancelBtn').addEventListener('click', closeSemanticModal);
  document.getElementById('semanticModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeSemanticModal(); });

  function closeSemanticModal() {
    document.getElementById('semanticModal').classList.remove('open');
    state.editing.semanticId = null;
  }

  document.getElementById('semanticSaveBtn').addEventListener('click', async () => {
    const id = state.editing.semanticId;
    if (!id) return;
    const payload = {
      topic: document.getElementById('editTopic').value.trim(),
      summary: document.getElementById('editSummary').value.trim(),
      confidence: parseFloat(document.getElementById('editConfidence').value),
      tags: document.getElementById('editTags').value.split(',').map(t => t.trim()).filter(Boolean),
    };
    const btn = document.getElementById('semanticSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';
    try {
      await apiFetch('/api/semantic/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) });
      toast('Memory saved successfully', 'success');
      closeSemanticModal();
      loadSemantic();
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Save Changes';
    }
  });

  document.getElementById('semanticDeleteBtn').addEventListener('click', async () => {
    const id = state.editing.semanticId;
    if (!id) return;
    if (!confirm('Delete this memory? This cannot be undone.')) return;
    const btn = document.getElementById('semanticDeleteBtn');
    btn.disabled = true;
    try {
      await apiFetch('/api/semantic/' + encodeURIComponent(id), { method: 'DELETE' });
      toast('Memory deleted', 'success');
      closeSemanticModal();
      loadSemantic();
    } catch (e) {
      toast('Delete failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // CONVERSATIONS
  // ═══════════════════════════════════════════════════════════════════════
  async function loadConversations() {
    const tbody = document.getElementById('convBody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="5"><span class="spinner"></span></td></tr>';
    const st = state.conv;
    const params = new URLSearchParams({ limit: st.limit, offset: st.offset });
    if (st.search) params.set('search', st.search);
    if (st.role && st.role !== 'all') params.set('role', st.role);
    try {
      const data = await apiFetch('/api/conversations?' + params);
      st.items = data.items ?? data ?? [];
      st.total = data.total ?? st.items.length;
      renderConvTable();
      renderPagination('convPagination', st, loadConversations);
    } catch (e) {
      tbody.innerHTML = '<tr class="loading-row"><td colspan="5" style="color:var(--red)">Failed to load: ' + esc(e.message) + '</td></tr>';
    }
  }

  function renderConvTable() {
    const tbody = document.getElementById('convBody');
    const items = state.conv.items;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">&#128172;</div><div>No conversations found</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = items.map(item => {
      const content = item.content ?? '';
      const preview = content.length > 200 ? content.slice(0, 200) + '…' : content;
      return '<tr data-id="' + esc(item.id) + '">' +
        '<td>' + roleBadge(item.role ?? 'user') + '</td>' +
        '<td class="td-truncate" style="max-width:360px;color:var(--text-secondary)">' + esc(preview) + '</td>' +
        '<td class="td-mono" style="font-size:11px">' + esc((item.session_id ?? item.sessionId ?? '').slice(0, 16)) + '…</td>' +
        '<td class="td-mono" style="font-size:11px">' + esc(fmtDate(item.timestamp ?? item.created_at)) + '</td>' +
        '<td><button class="btn btn-ghost btn-sm del-conv-btn" data-id="' + esc(item.id) + '" style="color:var(--red)">&#128465;</button></td>' +
      '</tr>';
    }).join('');
  }

  let convSearchTimer;
  document.getElementById('convSearch').addEventListener('input', e => {
    clearTimeout(convSearchTimer);
    convSearchTimer = setTimeout(() => {
      state.conv.search = e.target.value;
      state.conv.offset = 0;
      loadConversations();
    }, 300);
  });

  document.getElementById('convRole').addEventListener('change', e => {
    state.conv.role = e.target.value;
    state.conv.offset = 0;
    loadConversations();
  });

  document.getElementById('convRefresh').addEventListener('click', loadConversations);

  document.getElementById('convBody').addEventListener('click', async e => {
    const delBtn = e.target.closest('.del-conv-btn');
    const row = e.target.closest('tr[data-id]');
    if (delBtn) {
      e.stopPropagation();
      if (!confirm('Delete this conversation message?')) return;
      delBtn.disabled = true;
      try {
        await apiFetch('/api/conversations/' + encodeURIComponent(delBtn.dataset.id), { method: 'DELETE' });
        toast('Message deleted', 'success');
        loadConversations();
      } catch (err) {
        toast('Delete failed: ' + err.message, 'error');
        delBtn.disabled = false;
      }
    } else if (row) {
      openConvModal(row.dataset.id);
    }
  });

  function openConvModal(id) {
    state.editing.convId = id;
    const item = state.conv.items.find(i => String(i.id) === String(id));
    if (!item) return;
    const badge = document.getElementById('convModalBadge');
    badge.className = 'badge ' + (item.role === 'user' ? 'badge-user' : 'badge-assistant');
    badge.textContent = item.role ?? 'user';
    document.getElementById('convModalSession').textContent = (item.session_id ?? item.sessionId ?? '').slice(0, 24) + '…';
    document.getElementById('convModalTime').textContent = fmtDate(item.timestamp ?? item.created_at);
    document.getElementById('convModalContent').textContent = item.content ?? '';
    document.getElementById('convModal').classList.add('open');
  }

  document.getElementById('convModalClose').addEventListener('click', closeConvModal);
  document.getElementById('convCancelBtn').addEventListener('click', closeConvModal);
  document.getElementById('convModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeConvModal(); });

  function closeConvModal() {
    document.getElementById('convModal').classList.remove('open');
    state.editing.convId = null;
  }

  document.getElementById('convDeleteBtn').addEventListener('click', async () => {
    const id = state.editing.convId;
    if (!id || !confirm('Delete this message?')) return;
    const btn = document.getElementById('convDeleteBtn');
    btn.disabled = true;
    try {
      await apiFetch('/api/conversations/' + encodeURIComponent(id), { method: 'DELETE' });
      toast('Message deleted', 'success');
      closeConvModal();
      loadConversations();
    } catch (e) {
      toast('Delete failed: ' + e.message, 'error');
      btn.disabled = false;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // FILES
  // ═══════════════════════════════════════════════════════════════════════
  async function loadFiles() {
    document.getElementById('filesList').innerHTML = '<div style="padding:24px;color:var(--text-muted);text-align:center"><span class="spinner"></span></div>';
    try {
      const data = await apiFetch('/api/files');
      state.files.list = data.files ?? data ?? [];
      renderFilesList();
    } catch (e) {
      document.getElementById('filesList').innerHTML = '<div style="padding:16px;color:var(--red);font-size:13px">Failed: ' + esc(e.message) + '</div>';
    }
  }

  function renderFilesList() {
    const list = document.getElementById('filesList');
    const files = state.files.list;
    if (!files.length) {
      list.innerHTML = '<div style="padding:24px;color:var(--text-muted);text-align:center;font-size:13px">No files found</div>';
      return;
    }
    list.innerHTML = files.map(f => {
      const name = typeof f === 'string' ? f : (f.name ?? f.filename ?? '');
      const size = typeof f === 'object' ? f.size : null;
      return '<div class="file-item" data-filename="' + esc(name) + '">' +
        '<span class="file-icon">&#128196;</span>' +
        '<span class="file-name">' + esc(name) + '</span>' +
        (size != null ? '<span class="file-size">' + esc(fmtSize(size)) + '</span>' : '') +
      '</div>';
    }).join('');
  }

  document.getElementById('filesList').addEventListener('click', async e => {
    const item = e.target.closest('.file-item');
    if (!item) return;
    const filename = item.dataset.filename;
    document.querySelectorAll('.file-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    await openFile(filename);
  });

  async function openFile(filename) {
    state.files.selectedFile = filename;
    state.files.previewMode = false;
    renderEditorLoading(filename);
    try {
      const data = await apiFetch('/api/files/' + encodeURIComponent(filename));
      state.files.content = data.content ?? '';
      renderEditor(filename, state.files.content);
    } catch (e) {
      renderEditorError(filename, e.message);
    }
  }

  function renderEditorLoading(filename) {
    document.getElementById('filesEditor').innerHTML =
      '<div class="editor-toolbar">' +
        '<span class="editor-filename">' + esc(filename) + '</span>' +
        '<span class="spinner"></span>' +
      '</div>' +
      '<div class="editor-area" style="display:flex;align-items:center;justify-content:center"><div class="spinner"></div></div>';
  }

  function renderEditorError(filename, msg) {
    document.getElementById('filesEditor').innerHTML =
      '<div class="editor-toolbar"><span class="editor-filename">' + esc(filename) + '</span></div>' +
      '<div class="editor-area" style="display:flex;align-items:center;justify-content:center;color:var(--red)">' + esc(msg) + '</div>';
  }

  function renderEditor(filename, content) {
    const editor = document.getElementById('filesEditor');
    editor.innerHTML =
      '<div class="editor-toolbar">' +
        '<span class="editor-filename">' + esc(filename) + '</span>' +
        '<button class="btn btn-ghost btn-sm" id="previewToggle">Preview</button>' +
        '<button class="btn btn-primary btn-sm" id="fileSaveBtn">Save</button>' +
      '</div>' +
      '<div class="editor-area">' +
        '<textarea id="fileTextarea">' + esc(content) + '</textarea>' +
        '<div class="editor-preview md-preview" id="editorPreview"></div>' +
      '</div>';

    document.getElementById('previewToggle').addEventListener('click', () => {
      state.files.previewMode = !state.files.previewMode;
      const ta = document.getElementById('fileTextarea');
      const prev = document.getElementById('editorPreview');
      const btn = document.getElementById('previewToggle');
      if (state.files.previewMode) {
        ta.classList.add('hidden');
        prev.classList.add('active');
        prev.innerHTML = renderMarkdown(ta.value);
        btn.textContent = 'Edit';
      } else {
        ta.classList.remove('hidden');
        prev.classList.remove('active');
        btn.textContent = 'Preview';
      }
    });

    document.getElementById('fileSaveBtn').addEventListener('click', async () => {
      const ta = document.getElementById('fileTextarea');
      const content = ta ? ta.value : state.files.content;
      const btn = document.getElementById('fileSaveBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        await apiFetch('/api/files/' + encodeURIComponent(filename), {
          method: 'PUT',
          body: JSON.stringify({ content }),
        });
        state.files.content = content;
        toast('File saved: ' + filename, 'success');
      } catch (e) {
        toast('Save failed: ' + e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save';
      }
    });
  }

  // Basic Markdown renderer (no external deps)
  // Avoids regex literals that need backtick or heavy backslash escaping inside
  // this JS-embedded-in-HTML-embedded-in-TS-template-literal context.
  function renderMarkdown(md) {
    if (!md) return '';
    // Split on fenced code blocks first to protect their content
    const FENCE = '\u0060\u0060\u0060';
    const parts = md.split(FENCE);
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        // Inside a code fence: strip optional language tag on first line
        const firstNl = parts[i].indexOf('\\n');
        const code = firstNl >= 0 ? parts[i].slice(firstNl + 1) : parts[i];
        out += '<pre><code>' + esc(code) + '</code></pre>';
      } else {
        out += processInlineMarkdown(parts[i]);
      }
    }
    return out;
  }

  function processInlineMarkdown(text) {
    if (!text) return '';
    // Process line by line for block-level elements
    const lines = text.split('\\n');
    let html = '';
    let inPara = false;
    let inUl = false;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      // HR
      if (line.trim() === '---') {
        if (inPara) { html += '</p>'; inPara = false; }
        if (inUl) { html += '</ul>'; inUl = false; }
        html += '<hr>';
        continue;
      }
      // Headers
      if (line.startsWith('### ')) {
        if (inPara) { html += '</p>'; inPara = false; }
        if (inUl) { html += '</ul>'; inUl = false; }
        html += '<h3>' + inlineFormat(line.slice(4)) + '</h3>';
        continue;
      }
      if (line.startsWith('## ')) {
        if (inPara) { html += '</p>'; inPara = false; }
        if (inUl) { html += '</ul>'; inUl = false; }
        html += '<h2>' + inlineFormat(line.slice(3)) + '</h2>';
        continue;
      }
      if (line.startsWith('# ')) {
        if (inPara) { html += '</p>'; inPara = false; }
        if (inUl) { html += '</ul>'; inUl = false; }
        html += '<h1>' + inlineFormat(line.slice(2)) + '</h1>';
        continue;
      }
      // Blockquote
      if (line.startsWith('> ')) {
        if (inPara) { html += '</p>'; inPara = false; }
        if (inUl) { html += '</ul>'; inUl = false; }
        html += '<blockquote>' + inlineFormat(line.slice(2)) + '</blockquote>';
        continue;
      }
      // UL items (- or *)
      if (line.match(/^[-*] /)) {
        if (inPara) { html += '</p>'; inPara = false; }
        if (!inUl) { html += '<ul>'; inUl = true; }
        html += '<li>' + inlineFormat(line.slice(2)) + '</li>';
        continue;
      }
      // Empty line ends lists and paragraphs
      if (line.trim() === '') {
        if (inUl) { html += '</ul>'; inUl = false; }
        if (inPara) { html += '</p>'; inPara = false; }
        continue;
      }
      // Regular line
      if (inUl) { html += '</ul>'; inUl = false; }
      if (!inPara) { html += '<p>'; inPara = true; }
      else { html += ' '; }
      html += inlineFormat(line);
    }
    if (inUl) html += '</ul>';
    if (inPara) html += '</p>';
    return html;
  }

  function inlineFormat(text) {
    let s = esc(text);
    // Inline code (single backtick)
    s = s.replace(new RegExp('\u0060([^\u0060]+)\u0060', 'g'), '<code>$1</code>');
    // Bold
    s = s.replace(new RegExp('[*][*](.+?)[*][*]', 'g'), '<strong>$1</strong>');
    // Italic
    s = s.replace(new RegExp('[*](.+?)[*]', 'g'), '<em>$1</em>');
    // Links [text](url)
    s = s.replace(new RegExp('\\[([^\\]]+)\\]\\(([^)]+)\\)', 'g'), '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════════
  async function loadStats() {
    try {
      const data = await apiFetch('/api/stats');
      renderStats(data);
    } catch (e) {
      document.getElementById('statsCards').innerHTML = '<div style="color:var(--red)">Failed to load stats: ' + esc(e.message) + '</div>';
    }
  }

  function renderStats(data) {
    console.log('[memory-dashboard] renderStats called with keys:', Object.keys(data));
    console.log('[memory-dashboard] avgConfidence:', data.avgConfidence, 'topicDistribution:', (data.topicDistribution ?? []).length, 'recentActivity:', (data.recentActivity ?? []).length, 'skillUsage:', (data.skillUsage ?? []).length, 'agentUsage:', (data.agentUsage ?? []).length);

    // Stat Cards
    try {
      const cards = [
        { label: 'Semantic Memories', value: data.semantic_count ?? data.semanticCount ?? 0, icon: '&#x1F9E0;' },
        { label: 'Conversations', value: data.conversation_count ?? data.conversationCount ?? 0, icon: '&#128172;' },
        { label: 'Associations', value: data.association_count ?? data.associationCount ?? 0, icon: '&#128279;' },
        { label: 'Avg Confidence', value: ((data.avg_confidence ?? data.avgConfidence ?? 0) * 100).toFixed(1) + '%', icon: '&#127919;' },
      ];

      document.getElementById('statsCards').innerHTML = cards.map(c =>
        '<div class="stat-card">' +
          '<div class="stat-label">' + c.icon + ' ' + esc(c.label) + '</div>' +
          '<div class="stat-value">' + esc(String(c.value)) + '</div>' +
        '</div>'
      ).join('');
    } catch (e) { console.error('[memory-dashboard] stat cards error:', e); }

    // Bar Chart - Top Topics by count (from topicDistribution)
    try {
      const topics = data.topic_distribution ?? data.topicDistribution ?? [];
      const maxCount = Math.max(...topics.map(t => t.count ?? 0), 1);
      document.getElementById('barChart').innerHTML = topics.length
        ? topics.slice(0, 10).map(t => {
            const count = t.count ?? 0;
            const pct = Math.round((count / maxCount) * 100);
            return '<div class="bar-row">' +
              '<div class="bar-label" title="' + esc(t.topic) + '">' + esc(t.topic ?? '—') + '</div>' +
              '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
              '<div class="bar-count">' + count + '</div>' +
            '</div>';
          }).join('')
        : '<div style="color:var(--text-muted);text-align:center;padding:16px">No data</div>';
    } catch (e) { console.error('[memory-dashboard] bar chart error:', e); }

    // Activity Timeline
    try {
      const recent = data.recent_activity ?? data.recentActivity ?? [];
      document.getElementById('activityList').innerHTML = recent.length
        ? recent.slice(0, 20).map(item => {
            const ts = item.created_at ?? item.timestamp ?? item.createdAt;
            return '<div class="activity-item">' +
              '<div class="activity-dot"></div>' +
              '<div class="activity-content">' +
                '<div class="activity-topic">' + esc(item.topic ?? item.content?.slice(0, 60) ?? '—') + '</div>' +
                '<div class="activity-meta">' + esc(fmtDate(ts)) + (item.source ? ' &bull; ' + esc(item.source) : '') + '</div>' +
              '</div>' +
            '</div>';
          }).join('')
        : '<div style="padding:24px;color:var(--text-muted);text-align:center">No recent activity</div>';
    } catch (e) { console.error('[memory-dashboard] activity timeline error:', e); }

    // Skill Usage Table
    try {
      const skillUsage = data.skillUsage ?? data.skill_usage ?? [];
      document.getElementById('skillUsageTable').innerHTML = skillUsage.length
        ? '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
          '<thead><tr style="border-bottom:1px solid var(--border)">' +
          '<th style="text-align:left;padding:8px;color:var(--text-muted)">Skill</th>' +
          '<th style="text-align:right;padding:8px;color:var(--text-muted)">Uses</th>' +
          '<th style="text-align:right;padding:8px;color:var(--text-muted)">Success Rate</th>' +
          '</tr></thead><tbody>' +
          skillUsage.map(s => {
            const rate = s.invocations > 0 ? Math.round((s.successes / s.invocations) * 100) : 0;
            return '<tr style="border-bottom:1px solid var(--border)">' +
              '<td style="padding:8px">' + esc(s.skill_name ?? s.skillName) + '</td>' +
              '<td style="text-align:right;padding:8px">' + (s.invocations ?? 0) + '</td>' +
              '<td style="text-align:right;padding:8px">' + rate + '%</td>' +
            '</tr>';
          }).join('') +
          '</tbody></table>'
        : '<div style="color:var(--text-muted);text-align:center;padding:16px">No skill usage data</div>';
    } catch (e) { console.error('[memory-dashboard] skill usage error:', e); }

    // Agent Usage Table
    try {
      const agentUsage = data.agentUsage ?? data.agent_usage ?? [];
      document.getElementById('agentUsageTable').innerHTML = agentUsage.length
        ? '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
          '<thead><tr style="border-bottom:1px solid var(--border)">' +
          '<th style="text-align:left;padding:8px;color:var(--text-muted)">Agent</th>' +
          '<th style="text-align:right;padding:8px;color:var(--text-muted)">Uses</th>' +
          '</tr></thead><tbody>' +
          agentUsage.map(a =>
            '<tr style="border-bottom:1px solid var(--border)">' +
              '<td style="padding:8px">' + esc(a.agent_name ?? a.agent_type ?? a.agentType) + '</td>' +
              '<td style="text-align:right;padding:8px">' + (a.invocations ?? a.occurrences ?? 0) + '</td>' +
            '</tr>'
          ).join('') +
          '</tbody></table>'
        : '<div style="color:var(--text-muted);text-align:center;padding:16px">No agent usage data</div>';
    } catch (e) { console.error('[memory-dashboard] agent usage error:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // GRAPH EXPLORER
  // ═══════════════════════════════════════════════════════════════════════
  const COMMUNITY_COLORS = [
    '#58a6ff', '#3fb950', '#bc8cff', '#f0883e', '#d29922',
    '#f85149', '#79c0ff', '#56d364', '#d2a8ff', '#ffa657',
    '#e3b341', '#ff7b72', '#a5d6ff', '#7ee787', '#e8d5ff',
  ];

  let graphState = {
    initialized: false,
    nodes: [],
    edges: [],
    stats: null,
    communities: null,
    centrality: null,
    // Simulation
    simNodes: [],   // {id, x, y, vx, vy, radius, color, ...data}
    simEdges: [],   // {source, target, weight}
    // View
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    // Interaction
    dragging: null,
    panning: false,
    panStart: { x: 0, y: 0 },
    hoveredNode: null,
    selectedNode: null,
    // Settings
    showLabels: true,
    showCommunities: false,
    minWeight: 0,
    animating: false,
  };

  let graphAnimFrame = null;

  async function initGraph() {
    if (graphState.initialized) return;
    graphState.initialized = true;

    try {
      const [graphData, centralityData, communityData] = await Promise.all([
        apiFetch('/api/graph/data'),
        apiFetch('/api/graph/centrality'),
        apiFetch('/api/graph/communities'),
      ]);

      graphState.nodes = graphData.nodes || [];
      graphState.edges = graphData.edges || [];
      graphState.stats = graphData.stats || {};
      graphState.centrality = centralityData;
      graphState.communities = communityData;

      renderGraphStats(graphData.stats);
      renderGraphCentrality(centralityData);
      renderGraphCommunities(communityData);
      renderGraphLegend(communityData);
      initForceSimulation();
      setupGraphInteractions();
      startGraphAnimation();
    } catch (e) {
      document.getElementById('graphStats').innerHTML =
        '<div style="color:var(--red);grid-column:span 2;text-align:center;padding:12px">Failed to load: ' + esc(e.message) + '</div>';
    }
  }

  function renderGraphStats(stats) {
    if (!stats) return;
    const items = [
      { label: 'Nodes', value: stats.nodeCount || 0 },
      { label: 'Edges', value: stats.edgeCount || 0 },
      { label: 'Avg Degree', value: stats.avgDegree || 0 },
      { label: 'Components', value: stats.connectedComponents || 0 },
      { label: 'Density', value: stats.density || 0 },
      { label: 'Avg Weight', value: stats.avgWeight || 0 },
      { label: 'Max Degree', value: stats.maxDegree || 0 },
      { label: 'Isolated', value: stats.isolatedNodes || 0 },
    ];
    document.getElementById('graphStats').innerHTML = items.map(i =>
      '<div class="graph-stat-item"><div class="gs-value">' + esc(String(i.value)) +
      '</div><div class="gs-label">' + esc(i.label) + '</div></div>'
    ).join('');
  }

  function renderGraphCentrality(data) {
    if (!data || !data.nodes || data.nodes.length === 0) {
      document.getElementById('graphCentrality').innerHTML =
        '<div style="color:var(--text-muted);text-align:center;font-size:12px;padding:8px">No data</div>';
      return;
    }
    document.getElementById('graphCentrality').innerHTML = data.nodes.slice(0, 15).map((n, i) =>
      '<div class="graph-centrality-item" data-node-id="' + esc(n.id) + '">' +
        '<span class="gc-rank">' + (i + 1) + '</span>' +
        '<span class="gc-topic">' + esc(n.topic) + '</span>' +
        '<span class="gc-score">' + n.centrality + '</span>' +
      '</div>'
    ).join('');
  }

  function renderGraphCommunities(data) {
    if (!data || !data.communities || data.communities.length === 0) {
      document.getElementById('graphCommunities').innerHTML =
        '<div style="color:var(--text-muted);text-align:center;font-size:12px;padding:8px">No communities</div>';
      return;
    }
    document.getElementById('graphCommunities').innerHTML = data.communities.slice(0, 10).map((c, i) =>
      '<div class="graph-community-item" data-community-id="' + c.id + '">' +
        '<span class="gc-color" style="background:' + COMMUNITY_COLORS[i % COMMUNITY_COLORS.length] + '"></span>' +
        '<span class="gc-info">Community ' + c.id + '</span>' +
        '<span class="gc-size">' + c.size + ' nodes</span>' +
      '</div>'
    ).join('');
  }

  function renderGraphLegend(communityData) {
    const legend = document.getElementById('graphLegend');
    legend.innerHTML =
      '<div class="graph-legend-item"><div class="graph-legend-dot" style="background:var(--accent)"></div>Node</div>' +
      '<div class="graph-legend-item"><div class="graph-legend-dot" style="background:rgba(88,166,255,0.3);border:1px solid var(--accent)"></div>Edge</div>' +
      '<div class="graph-legend-item" style="color:var(--text-secondary)">Scroll to zoom | Drag to pan | Click node for details</div>';
  }

  // ── Force-Directed Layout ──────────────────────────────────────────────

  function initForceSimulation() {
    const canvas = document.getElementById('graphCanvas');
    const W = canvas.parentElement.clientWidth || 800;
    const H = canvas.parentElement.clientHeight || 600;
    canvas.width = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const cx = W / 2;
    const cy = H / 2;

    // Build community map for coloring
    const communityMap = new Map();
    if (graphState.communities && graphState.communities.communities) {
      for (const c of graphState.communities.communities) {
        for (const m of c.members) {
          communityMap.set(m.id, c.id);
        }
      }
    }

    // Create simulation nodes with random initial positions
    graphState.simNodes = graphState.nodes.map(n => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 50 + Math.random() * Math.min(W, H) * 0.3;
      const degree = n.degree || 1;
      return {
        ...n,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        radius: Math.max(4, Math.min(18, 3 + Math.sqrt(degree) * 3)),
        color: COMMUNITY_COLORS[communityMap.get(n.id) % COMMUNITY_COLORS.length] || COMMUNITY_COLORS[0],
        communityId: communityMap.get(n.id) ?? 0,
      };
    });

    // Create node lookup for edge resolution
    const nodeIndex = new Map();
    graphState.simNodes.forEach((n, i) => nodeIndex.set(n.id, i));

    graphState.simEdges = graphState.edges
      .filter(e => nodeIndex.has(e.source) && nodeIndex.has(e.target))
      .map(e => ({
        sourceIdx: nodeIndex.get(e.source),
        targetIdx: nodeIndex.get(e.target),
        weight: e.weight,
      }));

    // Center view
    graphState.offsetX = 0;
    graphState.offsetY = 0;
    graphState.scale = 1;
  }

  function simulationTick() {
    const nodes = graphState.simNodes;
    const edges = graphState.simEdges;
    if (!nodes.length) return;

    const canvas = document.getElementById('graphCanvas');
    const W = canvas.width / window.devicePixelRatio;
    const H = canvas.height / window.devicePixelRatio;
    const cx = W / 2;
    const cy = H / 2;

    // Force constants
    const repulsion = 800;
    const attraction = 0.005;
    const damping = 0.85;
    const centerPull = 0.01;

    // Reset forces
    for (const n of nodes) {
      n.fx = 0;
      n.fy = 0;
    }

    // Repulsion (all pairs — O(n^2), fine for <500 nodes)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].fx -= fx;
        nodes[i].fy -= fy;
        nodes[j].fx += fx;
        nodes[j].fy += fy;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const s = nodes[e.sourceIdx];
      const t = nodes[e.targetIdx];
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = attraction * dist * (0.5 + e.weight * 0.5);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.fx += fx;
      s.fy += fy;
      t.fx -= fx;
      t.fy -= fy;
    }

    // Center gravity
    for (const n of nodes) {
      n.fx += (cx - n.x) * centerPull;
      n.fy += (cy - n.y) * centerPull;
    }

    // Apply forces with velocity and damping
    let totalMovement = 0;
    for (const n of nodes) {
      if (graphState.dragging && n.id === graphState.dragging.id) continue;
      n.vx = (n.vx + n.fx) * damping;
      n.vy = (n.vy + n.fy) * damping;
      n.x += n.vx;
      n.y += n.vy;
      totalMovement += Math.abs(n.vx) + Math.abs(n.vy);
    }

    return totalMovement;
  }

  function drawGraph() {
    const canvas = document.getElementById('graphCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Apply pan + zoom transform
    ctx.translate(graphState.offsetX + W / 2, graphState.offsetY + H / 2);
    ctx.scale(graphState.scale, graphState.scale);
    ctx.translate(-W / 2, -H / 2);

    const nodes = graphState.simNodes;
    const edges = graphState.simEdges;
    const showLabels = graphState.showLabels;
    const showComm = graphState.showCommunities;

    // Draw edges
    for (const e of edges) {
      if (e.weight < graphState.minWeight) continue;
      const s = nodes[e.sourceIdx];
      const t = nodes[e.targetIdx];
      const alpha = 0.1 + e.weight * 0.5;
      const width = 0.5 + e.weight * 2;

      // Highlight edges connected to selected node
      const isHighlighted = graphState.selectedNode &&
        (s.id === graphState.selectedNode || t.id === graphState.selectedNode);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = isHighlighted
        ? 'rgba(88, 166, 255, ' + Math.min(1, alpha + 0.4) + ')'
        : 'rgba(88, 166, 255, ' + alpha + ')';
      ctx.lineWidth = isHighlighted ? width + 1 : width;
      ctx.stroke();
    }

    // Draw nodes
    for (const n of nodes) {
      const isSelected = graphState.selectedNode === n.id;
      const isHovered = graphState.hoveredNode === n.id;
      const color = showComm ? n.color : (isSelected ? '#79b8ff' : (isHovered ? '#58a6ff' : '#58a6ff'));
      const radius = isSelected ? n.radius + 3 : (isHovered ? n.radius + 2 : n.radius);

      // Glow for selected/hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = isSelected ? 1 : (isHovered ? 0.95 : 0.8);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Border
      ctx.strokeStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = isSelected ? 2 : 0.5;
      ctx.stroke();

      // Labels
      if (showLabels && (graphState.scale > 0.6 || isSelected || isHovered)) {
        const label = (n.topic || '').slice(0, 24);
        if (label) {
          ctx.font = (isSelected ? 'bold ' : '') + '10px -apple-system, sans-serif';
          ctx.fillStyle = isSelected ? '#fff' : 'rgba(230,237,243,0.7)';
          ctx.textAlign = 'center';
          ctx.fillText(label, n.x, n.y + radius + 12);
        }
      }
    }

    ctx.restore();
  }

  function startGraphAnimation() {
    if (graphState.animating) return;
    graphState.animating = true;
    let cooldown = 300; // Run for 300 frames then slow down

    function frame() {
      const movement = simulationTick();
      drawGraph();

      cooldown--;
      if (cooldown > 0 || (movement && movement > 0.5) || graphState.dragging) {
        graphAnimFrame = requestAnimationFrame(frame);
      } else {
        graphState.animating = false;
        // One final draw
        drawGraph();
      }
    }
    graphAnimFrame = requestAnimationFrame(frame);
  }

  function restartAnimation() {
    if (!graphState.animating) {
      graphState.animating = false;
      startGraphAnimation();
    }
  }

  // ── Graph Interactions ─────────────────────────────────────────────────

  function setupGraphInteractions() {
    const canvas = document.getElementById('graphCanvas');
    const tooltip = document.getElementById('graphTooltip');

    // Transform screen coords to graph coords
    function screenToGraph(sx, sy) {
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const x = (sx - rect.left - graphState.offsetX - W / 2) / graphState.scale + W / 2;
      const y = (sy - rect.top - graphState.offsetY - H / 2) / graphState.scale + H / 2;
      return { x, y };
    }

    function findNodeAt(sx, sy) {
      const { x, y } = screenToGraph(sx, sy);
      for (let i = graphState.simNodes.length - 1; i >= 0; i--) {
        const n = graphState.simNodes[i];
        const dx = n.x - x;
        const dy = n.y - y;
        if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) {
          return n;
        }
      }
      return null;
    }

    // Mouse down
    canvas.addEventListener('mousedown', e => {
      const node = findNodeAt(e.clientX, e.clientY);
      if (node) {
        graphState.dragging = node;
        canvas.style.cursor = 'grabbing';
      } else {
        graphState.panning = true;
        graphState.panStart = { x: e.clientX - graphState.offsetX, y: e.clientY - graphState.offsetY };
        canvas.style.cursor = 'grabbing';
      }
      restartAnimation();
    });

    // Mouse move
    canvas.addEventListener('mousemove', e => {
      if (graphState.dragging) {
        const { x, y } = screenToGraph(e.clientX, e.clientY);
        graphState.dragging.x = x;
        graphState.dragging.y = y;
        graphState.dragging.vx = 0;
        graphState.dragging.vy = 0;
        restartAnimation();
      } else if (graphState.panning) {
        graphState.offsetX = e.clientX - graphState.panStart.x;
        graphState.offsetY = e.clientY - graphState.panStart.y;
        drawGraph();
      } else {
        const node = findNodeAt(e.clientX, e.clientY);
        if (node) {
          graphState.hoveredNode = node.id;
          canvas.style.cursor = 'pointer';
          // Show tooltip
          const rect = canvas.getBoundingClientRect();
          tooltip.innerHTML =
            '<div class="gt-topic">' + esc(node.topic) + '</div>' +
            '<div class="gt-summary">' + esc((node.summary || '').slice(0, 120)) + '</div>' +
            '<div class="gt-meta">' +
              '<span>Degree: ' + (node.degree || 0) + '</span>' +
              '<span>Confidence: ' + Math.round((node.confidence || 0) * 100) + '%</span>' +
              '<span>Accesses: ' + (node.accessCount || 0) + '</span>' +
            '</div>';
          tooltip.style.display = 'block';
          tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
          tooltip.style.top = (e.clientY - rect.top + 14) + 'px';
          drawGraph();
        } else {
          if (graphState.hoveredNode) {
            graphState.hoveredNode = null;
            drawGraph();
          }
          tooltip.style.display = 'none';
          canvas.style.cursor = 'grab';
        }
      }
    });

    // Mouse up
    canvas.addEventListener('mouseup', e => {
      if (graphState.dragging) {
        graphState.dragging = null;
        canvas.style.cursor = 'grab';
      }
      if (graphState.panning) {
        graphState.panning = false;
        canvas.style.cursor = 'grab';
      }
    });

    // Click to select
    canvas.addEventListener('click', e => {
      const node = findNodeAt(e.clientX, e.clientY);
      if (node) {
        graphState.selectedNode = node.id;
        showNodeDetail(node);
        drawGraph();
      } else {
        graphState.selectedNode = null;
        document.getElementById('graphDetailPanel').style.display = 'none';
        drawGraph();
      }
    });

    // Scroll to zoom
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(5, graphState.scale * delta));
      graphState.scale = newScale;
      drawGraph();
    }, { passive: false });

    // Window resize
    window.addEventListener('resize', () => {
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      drawGraph();
    });

    // Controls
    document.getElementById('graphMinWeight').addEventListener('input', e => {
      graphState.minWeight = parseFloat(e.target.value);
      document.getElementById('graphMinWeightVal').textContent = graphState.minWeight.toFixed(2);
      drawGraph();
    });
    document.getElementById('graphMaxDepth').addEventListener('input', e => {
      document.getElementById('graphMaxDepthVal').textContent = e.target.value;
    });
    document.getElementById('graphShowLabels').addEventListener('change', e => {
      graphState.showLabels = e.target.checked;
      drawGraph();
    });
    document.getElementById('graphShowCommunities').addEventListener('change', e => {
      graphState.showCommunities = e.target.checked;
      drawGraph();
    });
    document.getElementById('graphResetBtn').addEventListener('click', () => {
      graphState.offsetX = 0;
      graphState.offsetY = 0;
      graphState.scale = 1;
      graphState.selectedNode = null;
      document.getElementById('graphDetailPanel').style.display = 'none';
      initForceSimulation();
      startGraphAnimation();
    });
    document.getElementById('graphDetailClose').addEventListener('click', () => {
      graphState.selectedNode = null;
      document.getElementById('graphDetailPanel').style.display = 'none';
      drawGraph();
    });

    // Centrality list click -> focus node
    document.getElementById('graphCentrality').addEventListener('click', e => {
      const item = e.target.closest('.graph-centrality-item');
      if (!item) return;
      const nodeId = item.dataset.nodeId;
      focusNode(nodeId);
    });

    // Community list click -> highlight community
    document.getElementById('graphCommunities').addEventListener('click', e => {
      const item = e.target.closest('.graph-community-item');
      if (!item) return;
      graphState.showCommunities = true;
      document.getElementById('graphShowCommunities').checked = true;
      drawGraph();
    });
  }

  function focusNode(nodeId) {
    const node = graphState.simNodes.find(n => n.id === nodeId);
    if (!node) return;
    const canvas = document.getElementById('graphCanvas');
    const W = canvas.width / window.devicePixelRatio;
    const H = canvas.height / window.devicePixelRatio;
    graphState.offsetX = W / 2 - node.x;
    graphState.offsetY = H / 2 - node.y;
    graphState.scale = 1.5;
    graphState.selectedNode = nodeId;
    showNodeDetail(node);
    drawGraph();
  }

  function showNodeDetail(node) {
    const panel = document.getElementById('graphDetailPanel');
    panel.style.display = 'block';
    document.getElementById('graphDetailTitle').textContent = node.topic || 'Node Details';

    // Find neighbors from edges
    const neighborIds = new Set();
    for (const e of graphState.simEdges) {
      const s = graphState.simNodes[e.sourceIdx];
      const t = graphState.simNodes[e.targetIdx];
      if (s.id === node.id) neighborIds.add(t.id);
      if (t.id === node.id) neighborIds.add(s.id);
    }
    const neighbors = graphState.simNodes.filter(n => neighborIds.has(n.id));

    document.getElementById('graphDetailBody').innerHTML =
      '<div class="gd-row"><span class="gd-label">Summary</span><span class="gd-value">' + esc(node.summary || '—') + '</span></div>' +
      '<div class="gd-row"><span class="gd-label">Confidence</span><span class="gd-value">' + confidenceBadge(node.confidence) + '</span></div>' +
      '<div class="gd-row"><span class="gd-label">Degree</span><span class="gd-value">' + (node.degree || 0) + '</span></div>' +
      '<div class="gd-row"><span class="gd-label">Accesses</span><span class="gd-value">' + (node.accessCount || 0) + '</span></div>' +
      '<div class="gd-row"><span class="gd-label">Community</span><span class="gd-value">' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (node.color || COMMUNITY_COLORS[0]) + ';margin-right:4px"></span>' +
        'Community ' + (node.communityId ?? '?') +
      '</span></div>' +
      '<div class="gd-row"><span class="gd-label">Created</span><span class="gd-value">' + esc(fmtDate(node.createdAt)) + '</span></div>' +
      '<div class="gd-row"><span class="gd-label">Source</span><span class="gd-value">' + esc(node.source || '—') + '</span></div>' +
      '<div class="gd-row"><span class="gd-label">Neighbors</span><span class="gd-value">' +
        (neighbors.length > 0 ? neighbors.map(n =>
          '<span style="cursor:pointer;color:var(--accent);margin-right:6px" data-node-id="' + esc(n.id) + '" class="graph-neighbor-link">' +
          esc(n.topic) + '</span>'
        ).join('') : '<span style="color:var(--text-muted)">None</span>') +
      '</span></div>';
  }

  // Custom event for focusing nodes from detail panel
  document.addEventListener('graph-focus', e => {
    focusNode(e.detail);
  });

  // Handle clicks on neighbor links
  document.addEventListener('click', e => {
    const link = e.target.closest('.graph-neighbor-link');
    if (link) {
      const nodeId = link.dataset.nodeId;
      if (nodeId) focusNode(nodeId);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════════════
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('semanticModal').classList.contains('open')) closeSemanticModal();
      if (document.getElementById('convModal').classList.contains('open')) closeConvModal();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════
  checkStatus();
  setInterval(checkStatus, 30000);
  loadSemantic(); // Pre-load first tab
})();
</script>
</body>
</html>`;
}
