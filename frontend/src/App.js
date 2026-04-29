import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import toast, { Toaster } from 'react-hot-toast';
import './App.css';

// ─── COLUMN MAP DEFAULTS ────────────────────────────────────────────────────
const FIELD_LABELS = {
  tree_no: 'Tree No',
  common_name: 'Common Name',
  dbh: 'DBH',
  mh: 'MH',
  th: 'TH',
  gross_volume: 'Gross Volume',
  trees_defect: 'Trees Defect',
  trees_longitude: 'Longitude',
  trees_latitude: 'Latitude',
  hazard_rating: 'Hazard Rating',
  nog: 'NOG',
  evaluation: 'Evaluation',
  recommendation_type: 'Rec. Type',
  recommendation_action: 'Rec. Action',
  recommendation: 'Recommendation',
};

const DEFAULT_COL_MAP = {
  tree_no: 1, common_name: 2, dbh: 3, mh: 4, th: 5,
  gross_volume: 6, trees_defect: 7, trees_longitude: 8,
  trees_latitude: 9, hazard_rating: 10, nog: 11,
  evaluation: 12, recommendation_type: 13,
  recommendation_action: 14, recommendation: 15,
};

const COL_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

// ─── COMPONENTS ─────────────────────────────────────────────────────────────
function StatusBadge({ ok }) {
  return (
    <span className={`badge ${ok ? 'badge-ok' : 'badge-err'}`}>
      {ok ? '● CONNECTED' : '● OFFLINE'}
    </span>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="stat-card">
      <span className="stat-value" style={accent ? { color: accent } : {}}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('import');
  const [dbReady, setDbReady] = useState(null);
  const [connected, setConnected] = useState(null);

  const [file, setFile] = useState(null);
  const [appId, setAppId] = useState('');
  const [officerId, setOfficerId] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [colMap, setColMap] = useState({ ...DEFAULT_COL_MAP });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Test connection on mount
  useEffect(() => {
    axios.get('/api/test-connection')
      .then(r => setConnected(r.data.success))
      .catch(() => setConnected(false));
  }, []);

  // Init DB
  const handleInitDb = async () => {
    try {
      const r = await axios.post('/api/init-db');
      if (r.data.success) {
        setDbReady(true);
        toast.success(r.data.message);
      } else {
        toast.error(r.data.message);
      }
    } catch (e) {
      toast.error('Failed to initialise database.');
    }
  };

  // Dropzone
  const onDrop = useCallback(accepted => {
    if (accepted[0]) { setFile(accepted[0]); setResult(null); }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/csv': ['.csv'],
    }, multiple: false,
  });

  // Upload
  const handleUpload = async () => {
    if (!file) return toast.error('Please select an Excel file first.');
    if (!appId) return toast.error('App ID is required.');
    if (!officerId) return toast.error('Action Officer ID is required.');
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('app_id', appId);
      fd.append('action_officer_id', officerId);
      fd.append('header_row', headerRow);
      fd.append('column_map', JSON.stringify(colMap));
      const r = await axios.post('/api/upload', fd);
      setResult(r.data);
      if (r.data.success) toast.success(`Inserted ${r.data.inserted} of ${r.data.total} rows.`);
      else toast.error(r.data.message);
    } catch (e) {
      toast.error('Upload failed. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  // Fetch records
  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      const r = await axios.get('/api/trees');
      if (r.data.success) setRecords(r.data.data);
      else toast.error(r.data.message);
    } catch {
      toast.error('Could not fetch records.');
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => { if (tab === 'records') fetchRecords(); }, [tab]);

  const updateCol = (field, val) => {
    const n = parseInt(val, 10);
    if (!isNaN(n)) setColMap(m => ({ ...m, [field]: n }));
  };

  return (
    <div className="app">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e2530', color: '#e6edf3', border: '1px solid #2d3748' }}} />

      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <span className="brand-icon">🌳</span>
            <div>
              <h1 className="brand-title">TREE INVENTORY</h1>
              <p className="brand-sub">Excel → MySQL Importer</p>
            </div>
          </div>
          <div className="header-status">
            <StatusBadge ok={connected} />
            {connected && <button className="btn btn-ghost btn-sm" onClick={handleInitDb}>Init / Reset DB</button>}
          </div>
        </div>
      </header>

      {/* ── TABS ── */}
      <nav className="tabs">
        {['import', 'column-map', 'records'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'import' ? '↑ Import' : t === 'column-map' ? '⚙ Column Map' : '⊞ Records'}
          </button>
        ))}
      </nav>

      <main className="main">

        {/* ══ IMPORT TAB ══════════════════════════════════════════════════════ */}
        {tab === 'import' && (
          <div className="panel fade-in">
            <div className="grid-2">

              {/* Left: file + params */}
              <div className="col">
                <section className="card">
                  <h2 className="card-title">01 — Upload Excel</h2>
                  <div {...getRootProps()} className={`dropzone ${isDragActive ? 'dropzone-active' : ''} ${file ? 'dropzone-filled' : ''}`}>
                    <input {...getInputProps()} />
                    {file ? (
                      <div className="drop-filled">
                        <span className="file-icon">📊</span>
                        <div>
                          <p className="file-name">{file.name}</p>
                          <p className="file-size">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button className="btn-clear" onClick={e => { e.stopPropagation(); setFile(null); }}>✕</button>
                      </div>
                    ) : (
                      <div className="drop-prompt">
                        <span className="drop-icon">⬇</span>
                        <p>Drop your <strong>.xlsx</strong> or <strong>.csv</strong> file here</p>
                        <p className="drop-hint">or click to browse</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="card">
                  <h2 className="card-title">02 — Parameters</h2>
                  <div className="form-grid">
                    <div className="field">
                      <label>App ID <span className="req">*</span></label>
                      <input className="input" type="number" placeholder="e.g. 1001" value={appId} onChange={e => setAppId(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Action Officer ID <span className="req">*</span></label>
                      <input className="input" type="number" placeholder="e.g. 42" value={officerId} onChange={e => setOfficerId(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Header Row #</label>
                      <input className="input" type="number" min={1} value={headerRow} onChange={e => setHeaderRow(+e.target.value)} />
                    </div>
                    <div className="field field-info">
                      <label>Date Created</label>
                      <div className="input input-disabled">{new Date().toISOString().slice(0,10)} (today)</div>
                    </div>
                    <div className="field field-info">
                      <label>Status</label>
                      <div className="input input-disabled">Active (default)</div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right: action + result */}
              <div className="col">
                <section className="card card-action">
                  <h2 className="card-title">03 — Execute</h2>
                  <button className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`} onClick={handleUpload} disabled={loading}>
                    {loading ? <><span className="spinner" />Importing…</> : '↑ Import to MySQL'}
                  </button>
                  <p className="action-hint">Rows already in the DB are not de-duplicated. Each run inserts fresh rows.</p>
                </section>

                {result && (
                  <section className="card fade-in">
                    <h2 className="card-title">Result</h2>
                    <div className="stat-row">
                      <StatCard label="Inserted" value={result.inserted} accent="var(--accent)" />
                      <StatCard label="Total rows" value={result.total} />
                      <StatCard label="Errors" value={result.errors?.length ?? 0} accent={result.errors?.length ? 'var(--danger)' : undefined} />
                    </div>
                    {result.errors?.length > 0 && (
                      <div className="error-list">
                        <p className="error-title">Row errors:</p>
                        {result.errors.map((e, i) => <p key={i} className="error-item">⚠ {e}</p>)}
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ COLUMN MAP TAB ══════════════════════════════════════════════════ */}
        {tab === 'column-map' && (
          <div className="panel fade-in">
            <section className="card">
              <h2 className="card-title">Column Mapping</h2>
              <p className="card-desc">Adjust which Excel column (0-based index) maps to each database field. Column A = 0, B = 1, C = 2 …</p>
              <div className="colmap-grid">
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <div key={field} className="colmap-row">
                    <span className="colmap-label">{label}</span>
                    <select className="input input-sm" value={colMap[field]} onChange={e => updateCol(field, e.target.value)}>
                      {COL_LETTERS.map((l, i) => (
                        <option key={i} value={i}>{l} (col {i})</option>
                      ))}
                    </select>
                    <span className="colmap-badge">→ DB: <code>{field}</code></span>
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => setColMap({ ...DEFAULT_COL_MAP })}>↺ Reset to defaults</button>
            </section>
          </div>
        )}

        {/* ══ RECORDS TAB ══════════════════════════════════════════════════════ */}
        {tab === 'records' && (
          <div className="panel fade-in">
            <div className="records-header">
              <h2 className="section-title">Latest 200 Records</h2>
              <button className="btn btn-ghost btn-sm" onClick={fetchRecords} disabled={loadingRecords}>
                {loadingRecords ? '…' : '↻ Refresh'}
              </button>
            </div>
            {loadingRecords ? (
              <div className="loading-state">Loading records…</div>
            ) : records.length === 0 ? (
              <div className="empty-state">No records found. Import an Excel file first.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {['id','app_id','date_created','action_officer_id','tree_no','common_name',
                        'dbh','mh','th','gross_volume','trees_defect','trees_longitude','trees_latitude',
                        'hazard_rating','evaluation','nog','recommendation_action','recommendation',
                        'status','recommendation_type'].map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(row => (
                      <tr key={row.id}>
                        {['id','app_id','date_created','action_officer_id','tree_no','common_name',
                          'dbh','mh','th','gross_volume','trees_defect','trees_longitude','trees_latitude',
                          'hazard_rating','evaluation','nog','recommendation_action','recommendation',
                          'status','recommendation_type'].map(col => (
                          <td key={col} title={row[col] ?? ''}>
                            {col === 'status' ? <span className="status-pill">{row[col]}</span> : (row[col] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
