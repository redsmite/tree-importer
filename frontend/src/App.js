import React, { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import toast, { Toaster } from 'react-hot-toast';
import './App.css';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const FIELD_LABELS = {
  tree_no: 'Tree No', common_name: 'Common Name', dbh: 'DBH', mh: 'MH', th: 'TH',
  gross_volume: 'Gross Volume', trees_defect: 'Trees Defect', trees_longitude: 'Longitude',
  trees_latitude: 'Latitude', hazard_rating: 'Hazard Rating', nog: 'NOG',
  evaluation: 'Evaluation', recommendation_type: 'Rec. Type',
  recommendation_action: 'Rec. Action', recommendation: 'Recommendation',
};
const DEFAULT_COL_MAP = {
  tree_no: 1, common_name: 2, dbh: 3, mh: 4, th: 5,
  gross_volume: 6, trees_defect: 7, trees_longitude: 8,
  trees_latitude: 9, hazard_rating: 10, nog: 11,
  evaluation: 12, recommendation_type: 13,
  recommendation_action: 14, recommendation: 15,
};
const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LS_KEY = 'tree_attachments';

const OFFICERS = [
  { id: 84,   last_name: "Carolino",  first_name: "Anne Patricia" },
  { id: 125,  last_name: "Belen",     first_name: "Sarah" },
  { id: 128,  last_name: "Paulino",   first_name: "Ezra Jane" },
  { id: 495,  last_name: "Gallibu",   first_name: "Shirley" },
  { id: 497,  last_name: "Nuguid",    first_name: "Emelyn Joyce" },
  { id: 500,  last_name: "Rosal",     first_name: "Joel" },
  { id: 531,  last_name: "Atienza",   first_name: "Bernadette" },
  { id: 558,  last_name: "Romero",    first_name: "Diana" },
  { id: 1347, last_name: "Ravina",    first_name: "Jason Kevin" },
  { id: 1425, last_name: "Abadicio",  first_name: "Joseph Ryan" },
  { id: 1463, last_name: "Manucom",   first_name: "Justin Gerick" },
  { id: 1836, last_name: "Nuguid",    first_name: "Emelyn" },
  { id: 2230, last_name: "Diaz",      first_name: "Kathreen" },
  { id: 2280, last_name: "Pullan",    first_name: "Carizza" },
];

const MAX_ID_SQL = "SELECT max(id)+1 FROM tcp_narrative_report";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function loadAttachments() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}
function saveAttachments(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────
function StatusBadge({ ok }) {
  return <span className={`badge ${ok ? 'badge-ok' : 'badge-err'}`}>{ok ? '● CONNECTED' : '● OFFLINE'}</span>;
}

function StatCard({ label, value, accent }) {
  return (
    <div className="stat-card">
      <span className="stat-value" style={accent ? { color: accent } : {}}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function SqlBox({ statements, label }) {
  const [copied, setCopied] = useState(false);
  const text = statements.join('\n');
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="sql-box-wrap">
      <div className="sql-box-header">
        <span className="sql-box-label">📋 {label || 'INSERT SQL'} <span className="sql-row-count">({statements.length} rows)</span></span>
        <button className="btn-copy" onClick={handleCopy}>
          {copied ? <><span className="copy-icon">✓</span> Copied!</> : <><span className="copy-icon">⎘</span> Copy All</>}
        </button>
      </div>
      <textarea className="sql-textarea" readOnly value={text} spellCheck={false} />
    </div>
  );
}

// Inline copy SQL hint box
function SqlHint({ sql }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(sql).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="sql-hint-wrap">
      <span className="sql-hint-label">Run this on your DB first:</span>
      <div className="sql-hint-row">
        <code className="sql-hint-code">{sql}</code>
        <button className="btn-hint-copy" onClick={handleCopy} title="Copy SQL">
          {copied ? '✓' : '⎘'}
        </button>
      </div>
    </div>
  );
}

// ─── ATTACHMENT ROW ───────────────────────────────────────────────────────────
function AttachmentRow({ treeNo, attachments, onChange }) {
  const fileRef = useRef();
  const files = attachments[treeNo] || [];

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files).map(f => f.name);
    const updated = { ...attachments, [treeNo]: [...files, ...selected] };
    onChange(updated);
    e.target.value = '';
  };

  const removeFile = (idx) => {
    const updated = { ...attachments, [treeNo]: files.filter((_, i) => i !== idx) };
    onChange(updated);
  };

  return (
    <div className="attach-row">
      <div className="attach-tree-label">
        <span className="attach-tree-tag">Tree No: {treeNo}</span>
        <button className="btn-upload-img" onClick={() => fileRef.current.click()}>
          🖼 Upload Image
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
      </div>
      <div className="attach-files">
        {files.length === 0 ? (
          <span className="attach-empty">No images uploaded</span>
        ) : (
          files.map((fname, i) => (
            <div key={i} className="attach-file-chip">
              <span className="attach-file-icon">🖼</span>
              <span className="attach-file-name">{fname}</span>
              <button className="attach-remove" onClick={() => removeFile(i)} title="Remove">✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('import');
  const [connected, setConnected] = useState(null);

  const [file, setFile] = useState(null);
  const [appId, setAppId] = useState('');
  const [officerId, setOfficerId] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [colMap, setColMap] = useState({ ...DEFAULT_COL_MAP });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [attachments, setAttachments] = useState(loadAttachments());
  const [startingReportId, setStartingReportId] = useState('');
  const [attachSql, setAttachSql] = useState([]);

  useEffect(() => { saveAttachments(attachments); }, [attachments]);

  useEffect(() => {
    if (!result?.tree_rows?.length || !startingReportId) { setAttachSql([]); return; }
    const baseId = parseInt(startingReportId, 10);
    if (isNaN(baseId)) { setAttachSql([]); return; }

    const today = new Date().toISOString().slice(0, 10);
    const FILE_LOCATION = '/var/www/tcp/assets/attachments/NarrativeReport/';
    const TYPE = 'Narrative Report';
    const lines = [];
    result.tree_rows.forEach((tr, idx) => {
      const reportId = baseId + idx;
      const files = attachments[tr.tree_no] || [];
      files.forEach(fname => {
        const escFname = fname.replace(/'/g, "''");
        lines.push(
          `INSERT INTO tcp_narrative_report_attachment (tcp_narrative_report_id, file_name, file_location, date_uploaded, type) VALUES ('${reportId}', '${escFname}', '${FILE_LOCATION}', '${today}', '${TYPE}');`
        );
      });
    });
    setAttachSql(lines);
  }, [attachments, startingReportId, result]);

  useEffect(() => {
    axios.get('/api/test-connection')
      .then(r => setConnected(r.data.success))
      .catch(() => setConnected(false));
  }, []);

  const handleInitDb = async () => {
    try {
      const r = await axios.post('/api/init-db');
      if (r.data.success) toast.success(r.data.message);
      else toast.error(r.data.message);
    } catch { toast.error('Failed to initialise database.'); }
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    setResetting(true);
    try {
      const r = await axios.post('/api/reset');
      if (r.data.success) {
        localStorage.removeItem(LS_KEY);
        setAttachments({});
        setResult(null);
        setRecords([]);
        setStartingReportId('');
        setAttachSql([]);
        toast.success('Tables truncated and local storage cleared.');
      } else {
        toast.error(r.data.message);
      }
    } catch { toast.error('Reset failed.'); }
    finally { setResetting(false); }
  };

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

  const handleUpload = async () => {
    if (!file) return toast.error('Please select a file first.');
    if (!appId) return toast.error('App ID is required.');
    if (!officerId) return toast.error('Action Officer ID is required.');
    setLoading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('app_id', appId);
      fd.append('action_officer_id', officerId); fd.append('header_row', headerRow);
      fd.append('column_map', JSON.stringify(colMap));
      const r = await axios.post('/api/upload', fd);
      setResult(r.data);
      if (r.data.success) toast.success(`Inserted ${r.data.inserted} of ${r.data.total} rows.`);
      else if (r.data.aborted) toast.error(`Import aborted — ${r.data.errors.length} validation error(s).`);
      else toast.error(r.data.message);
    } catch { toast.error('Upload failed. Is the backend running?'); }
    finally { setLoading(false); }
  };

  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      const r = await axios.get('/api/trees');
      if (r.data.success) setRecords(r.data.data);
      else toast.error(r.data.message);
    } catch { toast.error('Could not fetch records.'); }
    finally { setLoadingRecords(false); }
  };

  useEffect(() => { if (tab === 'records') fetchRecords(); }, [tab]);

  const updateCol = (field, val) => {
    const n = parseInt(val, 10);
    if (!isNaN(n)) setColMap(m => ({ ...m, [field]: n }));
  };

  const treeRows = result?.tree_rows || [];

  return (
    <div className="app">
      <Toaster position="top-right" toastOptions={{ style: { background: '#ffffff', color: '#1e2d1a', border: '1px solid #d4e0c8', boxShadow: '0 4px 12px rgba(58,125,68,0.15)' }}} />

      {/* ── RESET CONFIRM MODAL ── */}
      {showResetConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <span className="modal-icon">⚠️</span>
            <h3 className="modal-title">Reset Everything?</h3>
            <p className="modal-body">
              This will <strong>truncate</strong> both tables in the <strong>local</strong> database and clear all image attachments from localStorage.<br /><br />
              This action <strong>cannot be undone</strong>.
            </p>
            <div className="modal-actions">
              <button className="btn-modal-cancel" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="btn-modal-confirm" onClick={handleReset} disabled={resetting}>
                {resetting ? 'Resetting…' : '🗑 Yes, Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            {connected && (
              <>
                <button className="btn-header" onClick={handleInitDb}>Init / Reset DB</button>
                <button className="btn-header btn-header-danger" onClick={() => setShowResetConfirm(true)}>🗑 Reset & Clear</button>
              </>
            )}
          </div>
        </div>
      </header>

      <nav className="tabs">
        {['import', 'column-map', 'records'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>
            {t === 'import' ? '↑ Import' : t === 'column-map' ? '⚙ Column Map' : '⊞ Records'}
          </button>
        ))}
      </nav>

      <main className="main">

        {/* ══ IMPORT TAB ══ */}
        {tab === 'import' && (
          <div className="panel fade-in">
            <div className="grid-2">
              {/* Left */}
              <div className="col">
                <section className="card">
                  <h2 className="card-title">01 — Upload File</h2>
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
                      <label>Action Officer <span className="req">*</span></label>
                      <select
                        className="input"
                        value={officerId}
                        onChange={e => setOfficerId(e.target.value)}
                      >
                        <option value="">— Select officer —</option>
                        {OFFICERS.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.last_name}, {o.first_name.trim()} (ID: {o.id})
                          </option>
                        ))}
                      </select>
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

              {/* Right */}
              <div className="col">
                <section className="card card-action">
                  <h2 className="card-title">03 — Execute</h2>
                  <button className={`btn btn-primary btn-lg ${loading ? 'btn-loading' : ''}`} onClick={handleUpload} disabled={loading}>
                    {loading ? <><span className="spinner" />Importing…</> : '↑ Import to MySQL'}
                  </button>
                  <p className="action-hint">All rows must pass validation before any row is inserted.</p>
                </section>

                {result && (
                  <section className="card fade-in">
                    <h2 className="card-title">Result</h2>
                    {result.aborted ? (
                      <div className="abort-banner">
                        <span className="abort-icon">🚫</span>
                        <div>
                          <p className="abort-title">Import Aborted — Nothing was inserted</p>
                          <p className="abort-sub">{result.message}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="stat-row">
                        <StatCard label="Inserted" value={result.inserted} accent="var(--accent)" />
                        <StatCard label="Total Rows" value={result.total} />
                        <StatCard label="DB Errors" value={result.errors?.length ?? 0} accent={(result.errors?.length ?? 0) > 0 ? 'var(--danger)' : undefined} />
                      </div>
                    )}
                    {result.errors?.length > 0 && (
                      <div className={`error-list ${result.aborted ? 'error-list-aborted' : ''}`}>
                        <p className="error-title">
                          {result.aborted ? '🚫 Validation Errors' : '⚠ Import Errors'} — {result.errors.length} issue{result.errors.length !== 1 ? 's' : ''} found{result.aborted ? '. Fix all errors and re-import:' : ':'}
                        </p>
                        <div className="error-scroll">
                          {result.errors.map((e, i) => {
                            const isValidation = e.includes('NOG:') || e.includes('Recommendation Action:') || e.includes('Recommendation Type:') || e.includes('Hazard Rating:');
                            return (
                              <div key={i} className={`error-item ${isValidation ? 'error-item-validation' : 'error-item-db'}`}>
                                <span className="error-icon">{isValidation ? '⊘' : '✕'}</span>
                                <span>{e}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {result.sql_statements?.length > 0 && (
                      <SqlBox statements={result.sql_statements} label="INSERT SQL — tcp_narrative_report" />
                    )}
                  </section>
                )}
              </div>
            </div>

            {/* ── ATTACHMENT SECTION ── */}
            {result?.success && treeRows.length > 0 && (
              <section className="card fade-in attach-section">
                <h2 className="card-title">04 — Image Attachments</h2>
                <p className="card-desc">
                  Upload images per tree. File paths are stored locally and used to generate the attachment INSERT SQL below.
                </p>

                <div className="attach-id-row">
                  <div className="field" style={{ maxWidth: 300 }}>
                    <label>Starting <code>tcp_narrative_report_id</code> <span className="req">*</span></label>
                    <input
                      className="input"
                      type="number"
                      placeholder="e.g. 101"
                      value={startingReportId}
                      onChange={e => setStartingReportId(e.target.value)}
                    />
                    <SqlHint sql={MAX_ID_SQL} />
                  </div>
                  <p className="attach-id-hint">
                    Enter the <strong>first ID</strong> of the rows just inserted into <code>tcp_narrative_report</code>.<br />
                    Run the SQL query on the left to get the correct starting ID.<br />
                    Each subsequent tree row will increment by 1.
                  </p>
                </div>

                <div className="attach-table">
                  <div className="attach-table-head">
                    <span>Upload Image</span>
                    <span>Image File(s)</span>
                  </div>
                  {treeRows.map(tr => (
                    <AttachmentRow
                      key={tr.tree_no}
                      treeNo={tr.tree_no}
                      attachments={attachments}
                      onChange={updated => setAttachments(updated)}
                    />
                  ))}
                </div>

                {attachSql.length > 0 && (
                  <SqlBox statements={attachSql} label="INSERT SQL — tcp_narrative_report_attachment" />
                )}
                {attachSql.length === 0 && startingReportId && (
                  <p className="attach-no-sql">Upload at least one image above to generate attachment SQL.</p>
                )}
                {!startingReportId && (
                  <p className="attach-no-sql">Enter the starting report ID above to generate attachment SQL.</p>
                )}
              </section>
            )}
          </div>
        )}

        {/* ══ COLUMN MAP TAB ══ */}
        {tab === 'column-map' && (
          <div className="panel fade-in">
            <section className="card">
              <h2 className="card-title">Column Mapping</h2>
              <p className="card-desc">Adjust which Excel column (0-based index) maps to each database field. A=0, B=1, C=2…</p>
              <div className="colmap-grid">
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <div key={field} className="colmap-row">
                    <span className="colmap-label">{label}</span>
                    <select className="input input-sm" value={colMap[field]} onChange={e => updateCol(field, e.target.value)}>
                      {COL_LETTERS.map((l, i) => <option key={i} value={i}>{l} (col {i})</option>)}
                    </select>
                    <span className="colmap-badge">→ DB: <code>{field}</code></span>
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm mt-2" onClick={() => setColMap({ ...DEFAULT_COL_MAP })}>↺ Reset to defaults</button>
            </section>
          </div>
        )}

        {/* ══ RECORDS TAB ══ */}
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
              <div className="empty-state">No records found. Import a file first.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {['id','app_id','date_created','action_officer_id','tree_no','common_name',
                        'dbh','mh','th','gross_volume','trees_defect','trees_longitude','trees_latitude',
                        'hazard_rating','evaluation','nog','recommendation_action','recommendation',
                        'status','recommendation_type'].map(col => <th key={col}>{col}</th>)}
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
