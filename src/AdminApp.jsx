import { useCallback, useEffect, useState } from 'react'
import { adminRequest, clearToken, getToken, saveToken } from './api'

const CLIENT_URL = import.meta.env.VITE_CLIENT_URL || 'http://localhost:5173'
const collections = [
  ['settings', 'Company details'],
  ['siteContent', 'Page content'],
  ['heroSlides', 'Hero slides'],
  ['services', 'Services'],
  ['products', 'Products'],
  ['courses', 'Training courses'],
  ['projects', 'Projects'],
  ['stats', 'Statistics'],
]

function itemLabel(item, index) {
  return item.data.name || item.data.title || item.data.label || item.data.id || `Item ${index + 1}`
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { token } = await adminRequest('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      saveToken(token)
      onLogin()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-shell"><form className="login-card" onSubmit={submit}>
    <div className="brand-mark">B</div>
    <p className="eyebrow">Bilatec Vocational Hub</p>
    <h1>Admin sign in</h1>
    <p className="subtle">Sign in to manage your public website and enquiries.</p>
    <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
    <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form></main>
}

function AdminApp() {
  const [authenticated, setAuthenticated] = useState(Boolean(getToken()))
  const [section, setSection] = useState('settings')
  const [records, setRecords] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [inquiryPage, setInquiryPage] = useState(1)
  const [inquiryTotal, setInquiryTotal] = useState(0)
  const [inquiryTotalPages, setInquiryTotalPages] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [published, setPublished] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const inquiryMode = section === 'inquiries'
  const sectionName = collections.find(([key]) => key === section)?.[1] || 'Customer enquiries'
  const selectedRecord = records.find((record) => record.id === selectedId)

  const loadSection = useCallback(async (requestedInquiryPage = inquiryPage) => {
    if (!authenticated) return
    setLoading(true)
    setError('')
    try {
      if (section === 'inquiries') {
        const result = await adminRequest(`/api/admin/inquiries?page=${requestedInquiryPage}&pageSize=50`)
        setInquiries(result.items)
        setInquiryTotal(result.total)
        setInquiryTotalPages(result.totalPages)
        setInquiryPage(result.page)
        return
      }
      const result = await adminRequest(`/api/admin/content/${section}`)
      setRecords(result)
      setSelectedId((current) => result.some((item) => item.id === current) ? current : result[0]?.id || '')
    } catch (requestError) {
      setError(requestError.message)
      if (requestError.message.includes('session') || requestError.message.includes('authentication')) {
        setAuthenticated(false)
      }
    } finally {
      setLoading(false)
    }
  }, [authenticated, inquiryPage, section])

  useEffect(() => { loadSection() }, [loadSection])

  useEffect(() => {
    setNotice('')
    setError('')
    if (section === 'inquiries') setInquiryPage(1)
  }, [section])

  useEffect(() => {
    if (!selectedRecord) {
      setDraft('')
      setSortOrder('0')
      setPublished(true)
      return
    }
    setDraft(JSON.stringify(selectedRecord.data, null, 2))
    setSortOrder(String(selectedRecord.sortOrder))
    setPublished(selectedRecord.published)
  }, [selectedId, selectedRecord])

  async function saveRecord(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = JSON.parse(draft)
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Content must be a JSON object.')
      const body = JSON.stringify({ data, sortOrder: Number(sortOrder), published })
      const path = `/api/admin/content/${section}${selectedId ? `/${selectedId}` : ''}`
      const result = await adminRequest(path, { method: selectedId ? 'PUT' : 'POST', body })
      await loadSection()
      setSelectedId(result.id)
      setNotice('Changes saved.')
    } catch (requestError) {
      setError(requestError instanceof SyntaxError ? `Invalid JSON: ${requestError.message}` : requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecord(id) {
    if (!window.confirm('Delete this content item? This cannot be undone.')) return
    setError('')
    try {
      await adminRequest(`/api/admin/content/${section}/${id}`, { method: 'DELETE' })
      setSelectedId('')
      setNotice('Content item deleted.')
      await loadSection()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function updateInquiry(id, status) {
    setError('')
    try {
      await adminRequest(`/api/admin/inquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      await loadSection()
      setNotice('Enquiry updated.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function deleteInquiry(id) {
    if (!window.confirm('Permanently delete this enquiry?')) return
    setError('')
    try {
      await adminRequest(`/api/admin/inquiries/${id}`, { method: 'DELETE' })
      await loadSection()
      setNotice('Enquiry deleted.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />

  return <div className="admin-shell">
    <aside className="sidebar">
      <a className="brand" href="#"><span className="brand-mark">B</span><span><strong>BILATEC</strong><small>ADMIN CONSOLE</small></span></a>
      <p className="nav-caption">WEBSITE</p>
      <nav aria-label="Admin sections">{collections.map(([key, title]) => <button key={key} className={section === key ? 'nav-item active' : 'nav-item'} onClick={() => setSection(key)}>{title}</button>)}</nav>
      <p className="nav-caption inbox-caption">INBOX</p>
      <button className={section === 'inquiries' ? 'nav-item active' : 'nav-item'} onClick={() => setSection('inquiries')}>Customer enquiries</button>
      <div className="sidebar-bottom"><a href={CLIENT_URL} target="_blank" rel="noreferrer">View public website ↗</a><button onClick={() => { clearToken(); setAuthenticated(false) }}>Sign out</button></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div><p className="eyebrow">Content management</p><h1>{sectionName}</h1></div><button className="refresh-button" onClick={loadSection} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></header>
      {error && <p role="alert" className="alert error">{error}</p>}
      {notice && <p role="status" className="alert success">{notice}</p>}
      {inquiryMode ? <section className="inbox-list" aria-label="Customer enquiries">
        <div className="inbox-summary"><strong>{inquiryTotal} total enquiries</strong><span>Showing all submissions, newest first</span></div>
        {loading && inquiries.length === 0 && <p className="empty-state">Loading enquiries…</p>}
        {!loading && inquiries.length === 0 && <p className="empty-state">No enquiries yet. New website submissions will appear here.</p>}
        {inquiries.map((inquiry) => <article className="inquiry-card" key={inquiry.id}>
          <div className="inquiry-heading"><div><h2>{inquiry.subject}</h2><p>{inquiry.name} · <a href={`mailto:${inquiry.email}`}>{inquiry.email}</a> · <a href={`tel:${inquiry.phone}`}>{inquiry.phone}</a></p></div><time>{new Date(inquiry.createdAt).toLocaleString()}</time></div>
          <p className="inquiry-message">{inquiry.message}</p>
          <div className="inquiry-actions"><label>Status<select value={inquiry.status} onChange={(event) => updateInquiry(inquiry.id, event.target.value)}><option value="new">New</option><option value="in-progress">In progress</option><option value="closed">Closed</option></select></label><button className="danger-button" onClick={() => deleteInquiry(inquiry.id)}>Delete</button></div>
        </article>)}
        {inquiryTotalPages > 1 && <div className="inbox-pagination"><button className="refresh-button" disabled={loading || inquiryPage <= 1} onClick={() => setInquiryPage((page) => page - 1)}>Newer</button><span>Page {inquiryPage} of {inquiryTotalPages}</span><button className="refresh-button" disabled={loading || inquiryPage >= inquiryTotalPages} onClick={() => setInquiryPage((page) => page + 1)}>Older</button></div>}
      </section> : <div className="editor-layout">
        <section className="record-list" aria-label={`${sectionName} records`}>
          <div className="list-heading"><span>{records.length} item{records.length === 1 ? '' : 's'}</span><button className="add-button" onClick={() => setSelectedId('')}>+ Add item</button></div>
          {loading && records.length === 0 && <p className="empty-state">Loading content…</p>}
          {!loading && records.length === 0 && <p className="empty-state">No records yet. Add one to get started.</p>}
          {records.map((record, index) => <button key={record.id} className={record.id === selectedId ? 'record-item selected' : 'record-item'} onClick={() => setSelectedId(record.id)}><span className="record-title">{itemLabel(record, index)}</span><span className={record.published ? 'published' : 'unpublished'}>{record.published ? 'Published' : 'Draft'}</span></button>)}
        </section>
        <form className="editor-card" onSubmit={saveRecord}>
          <div className="editor-heading"><div><h2>{selectedId ? 'Edit content' : 'New content item'}</h2><p>Use JSON to manage all fields for this item.</p></div>{selectedId && <button type="button" className="danger-button" onClick={() => deleteRecord(selectedId)}>Delete</button>}</div>
          <label className="field-label" htmlFor="record-data">Content data</label>
          <textarea id="record-data" className="json-editor" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={'{\n  "title": "New title"\n}'} spellCheck="false" required />
          <div className="record-settings"><label>Display order<input type="number" step="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></label><label className="check-label"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Published on public site</label></div>
          <div className="editor-footer"><p>Changes are saved to the Neon database.</p><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </div>}
    </main>
  </div>
}

export default AdminApp
