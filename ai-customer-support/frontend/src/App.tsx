import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Role = 'admin' | 'agent' | 'customer'
type Status = 'open' | 'pending' | 'resolved' | 'closed'
type Priority = 'low' | 'normal' | 'high' | 'urgent'
type Category = 'general' | 'account' | 'billing' | 'technical' | 'other'
type View = 'widget' | 'inbox' | 'accounts' | 'knowledge'
type User = { id: string; name: string; email: string; role: Role; isActive?: boolean }
type Account = { id: string; name: string; email: string; role: Role; isActive: boolean; lastLoginAt?: string; createdAt: string }
type Conversation = { _id: string; subject?: string; status: Status; mode: 'ai' | 'human'; priority?: Priority; category?: Category; lastMessageAt: string; customer?: { name: string; email: string }; assignedAgent?: { name: string } }
type Message = { _id: string; content: string; senderType: 'customer' | 'agent' | 'ai' | 'system'; messageType?: 'message' | 'system' | 'internal_note'; createdAt: string }
type Article = { _id: string; title: string; content: string; tags: string[]; isPublished?: boolean; updatedAt: string }
type Api<T> = { success: boolean; message?: string } & T
type Auth = { token?: string; user?: User; message?: string }

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000'
const TOKEN_KEY = 'ai_customer_support_token'
const statuses: Status[] = ['open', 'pending', 'resolved', 'closed']
const priorities: Priority[] = ['low', 'normal', 'high', 'urgent']
const categories: Category[] = ['general', 'account', 'billing', 'technical', 'other']

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '')
  const [user, setUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [view, setView] = useState<View>('widget')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [draft, setDraft] = useState('')
  const [ticketQuery, setTicketQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountQuery, setAccountQuery] = useState('')
  const [accountRole, setAccountRole] = useState<'all' | Role>('all')
  const [articles, setArticles] = useState<Article[]>([])
  const [articleQuery, setArticleQuery] = useState('')
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const isStaff = user?.role === 'admin' || user?.role === 'agent'
  const isAdmin = user?.role === 'admin'
  const shownConversations = useMemo(() => conversations.filter((item) => {
    const query = ticketQuery.trim().toLowerCase()
    const searchable = `${item.subject ?? ''} ${item.customer?.name ?? ''} ${item.customer?.email ?? ''}`.toLowerCase()
    return (!query || searchable.includes(query)) && (statusFilter === 'all' || item.status === statusFilter) && (priorityFilter === 'all' || (item.priority ?? 'normal') === priorityFilter)
  }), [conversations, priorityFilter, statusFilter, ticketQuery])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(''); setUser(null); setActive(null); setMessages([]); setConversations([]); setAccounts([]); setArticles([]); setNotice('')
  }, [])
  const loadConversations = useCallback(async (activeToken = token) => {
    try {
      const data = await request<Api<{ conversations: Conversation[] }>>('/api/conversations?limit=50', activeToken)
      setConversations(data.conversations)
      setActive((current) => data.conversations.find((item) => item._id === current?._id) ?? data.conversations[0] ?? null)
    } catch (error) { setNotice(errorText(error)) }
  }, [token])
  const loadMessages = useCallback(async (id: string) => {
    try { setMessages((await request<Api<{ messages: Message[] }>>(`/api/conversations/${id}/messages`, token)).messages) } catch (error) { setNotice(errorText(error)) }
  }, [token])
  const loadAccounts = useCallback(async () => {
    try {
      const query = new URLSearchParams({ limit: '100' })
      if (accountQuery.trim()) query.set('q', accountQuery.trim())
      if (accountRole !== 'all') query.set('role', accountRole)
      setAccounts((await request<Api<{ accounts: Account[] }>>(`/api/accounts?${query}`, token)).accounts)
    } catch (error) { setNotice(errorText(error)) }
  }, [accountQuery, accountRole, token])
  const loadArticles = useCallback(async (query = '') => {
    try {
      const path = query.trim() ? `/api/knowledge-base/search?q=${encodeURIComponent(query.trim())}` : '/api/knowledge-base'
      setArticles((await request<Api<{ articles: Article[] }>>(path, token)).articles)
    } catch (error) { setNotice(errorText(error)) }
  }, [token])
  const restoreSession = useCallback(async () => {
    try {
      const data = await request<Api<{ user: User }>>('/api/auth/me', token)
      setUser(data.user)
      await loadConversations(token)
    } catch { logout() }
  }, [loadConversations, logout, token])

  useEffect(() => { if (token) void restoreSession() }, [restoreSession, token])
  useEffect(() => { if (active && token) void loadMessages(active._id) }, [active, loadMessages, token])
  useEffect(() => { if (isStaff) setView('inbox') }, [isStaff])
  useEffect(() => { if (view === 'accounts' && isAdmin) void loadAccounts() }, [view, isAdmin, loadAccounts])
  useEffect(() => { if (view === 'knowledge' && isAdmin) void loadArticles() }, [view, isAdmin, loadArticles])

  async function submitAuth(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('')
    try {
      const data = await request<Auth>(authMode === 'register' ? '/api/auth/register' : '/api/auth/login', '', { method: 'POST', body: JSON.stringify(authMode === 'register' ? { name, email, password } : { email, password }) })
      if (!data.token || !data.user) throw new Error('Không thể tạo phiên đăng nhập')
      localStorage.setItem(TOKEN_KEY, data.token); setToken(data.token); setUser(data.user); setPassword(''); await loadConversations(data.token)
    } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  async function createConversation(event: FormEvent) {
    event.preventDefault(); setBusy(true)
    try {
      const data = await request<Api<{ conversation: Conversation }>>('/api/conversations', token, { method: 'POST', body: JSON.stringify({ subject: newSubject.trim() || 'Yêu cầu hỗ trợ mới' }) })
      setNewSubject(''); await loadConversations(); setActive(data.conversation); setNotice('Đã mở yêu cầu hỗ trợ.')
    } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  async function sendMessage(event: FormEvent) {
    event.preventDefault(); if (!active || !draft.trim()) return; setBusy(true)
    try {
      const result = await request<Api<{ message: Message; aiMessage?: Message | null; handoffMessage?: Message | null }>>(`/api/conversations/${active._id}/messages`, token, { method: 'POST', body: JSON.stringify({ content: draft.trim() }) })
      setMessages((current) => [...current, result.message, ...(result.aiMessage ? [result.aiMessage] : []), ...(result.handoffMessage ? [result.handoffMessage] : [])]); setDraft(''); await loadConversations()
    } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  async function updateStatus(status: Status) {
    if (!active) return; setBusy(true)
    try {
      const data = await request<Api<{ conversation: Conversation }>>(`/api/conversations/${active._id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) })
      setActive(data.conversation); await loadConversations(); setNotice('Đã cập nhật trạng thái ticket.')
    } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  async function updateMetadata(changes: Partial<Pick<Conversation, 'priority' | 'category'>>) {
    if (!active) return; setBusy(true)
    try {
      const data = await request<Api<{ conversation: Conversation }>>(`/api/conversations/${active._id}/metadata`, token, { method: 'PATCH', body: JSON.stringify(changes) })
      setActive(data.conversation); await loadConversations(); setNotice('Đã cập nhật thông tin ticket.')
    } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  async function addInternalNote(content: string) {
    if (!active || !content.trim()) return
    setBusy(true)
    try {
      const data = await request<Api<{ note: Message }>>(`/api/conversations/${active._id}/internal-notes`, token, { method: 'POST', body: JSON.stringify({ content: content.trim() }) })
      setMessages((current) => [...current, data.note]); setNotice('Đã thêm ghi chú nội bộ.')
    } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  async function handoff() {
    if (!active) return; setBusy(true)
    try {
      const data = await request<Api<{ conversation: Conversation }>>(`/api/conversations/${active._id}/handoff`, token, { method: 'POST' })
      setActive(data.conversation); await Promise.all([loadMessages(active._id), loadConversations()]); setNotice('Đã nhận xử lý cuộc hội thoại.')
    } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  async function updateAccount(account: Account, changes: Partial<Pick<Account, 'role' | 'isActive'>>) {
    setBusy(true); try { await request(`/api/accounts/${account.id}`, token, { method: 'PATCH', body: JSON.stringify(changes) }); await loadAccounts(); setNotice('Đã cập nhật tài khoản.') } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  async function saveArticle(article: Omit<Article, '_id' | 'updatedAt'>, id?: string) {
    setBusy(true)
    try {
      await request(id ? `/api/knowledge-base/${id}` : '/api/knowledge-base', token, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(article) })
      setEditingArticle(null); await loadArticles(articleQuery); setNotice(id ? 'Đã cập nhật bài viết.' : 'Đã tạo bài viết.')
    } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }
  async function deleteArticle(article: Article) {
    if (!window.confirm(`Xóa bài viết “${article.title}”?`)) return
    setBusy(true)
    try { await request(`/api/knowledge-base/${article._id}`, token, { method: 'DELETE' }); await loadArticles(articleQuery); setNotice('Đã xóa bài viết.') } catch (error) { setNotice(errorText(error)) } finally { setBusy(false) }
  }

  if (!user) return <AuthScreen {...{ authMode, setAuthMode, name, setName, email, setEmail, password, setPassword, busy, notice, onSubmit: submitAuth }} />
  return <main className="app-frame">
    <Topbar {...{ user, view, setView, isStaff, isAdmin, logout }} />
    {view === 'accounts' && isAdmin ? <AccountManager {...{ accounts, accountQuery, setAccountQuery, accountRole, setAccountRole, loadAccounts, updateAccount, user, busy }} />
      : view === 'knowledge' && isAdmin ? <KnowledgeBase {...{ articles, articleQuery, setArticleQuery, loadArticles, editingArticle, setEditingArticle, saveArticle, deleteArticle, busy }} />
        : view === 'widget' || !isStaff ? <CustomerWidget {...{ active, messages, subject: newSubject, setSubject: setNewSubject, draft, setDraft, createConversation, sendMessage, busy }} />
          : <AgentInbox {...{ conversations: shownConversations, allConversations: conversations, active, messages, ticketQuery, setTicketQuery, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter, selectConversation: setActive, draft, setDraft, sendMessage, updateStatus, updateMetadata, addInternalNote, handoff, busy }} />}
    {notice && <button className="toast" onClick={() => setNotice('')}>{notice} ×</button>}
    <footer>© 2026 Customer Support Workspace <span>•</span> Account, conversation & AI operations</footer>
  </main>
}

function AuthScreen(props: { authMode: 'login' | 'register'; setAuthMode: (mode: 'login' | 'register') => void; name: string; setName: (value: string) => void; email: string; setEmail: (value: string) => void; password: string; setPassword: (value: string) => void; busy: boolean; notice: string; onSubmit: (event: FormEvent) => void }) {
  const p = props
  return <main className="auth-page"><section className="auth-card"><div className="logo-mark">✦</div><p className="product-name">CUSTOMER SUPPORT</p><h1>Trung tâm hỗ trợ thông minh.</h1><p>Tạo yêu cầu, theo dõi xử lý và trao đổi trực tiếp với đội hỗ trợ.</p><div className="auth-tabs"><button className={p.authMode === 'login' ? 'selected' : ''} onClick={() => p.setAuthMode('login')}>Đăng nhập</button><button className={p.authMode === 'register' ? 'selected' : ''} onClick={() => p.setAuthMode('register')}>Đăng ký</button></div><form onSubmit={p.onSubmit}>{p.authMode === 'register' && <input required minLength={2} value={p.name} onChange={(e) => p.setName(e.target.value)} placeholder="Họ và tên" />}<input required type="email" value={p.email} onChange={(e) => p.setEmail(e.target.value)} placeholder="Email" /><input required minLength={6} value={p.password} onChange={(e) => p.setPassword(e.target.value)} type="password" placeholder="Mật khẩu" /><button className="action primary" disabled={p.busy}>{p.busy ? 'Đang xử lý...' : p.authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button></form>{p.notice && <p className="form-notice">{p.notice}</p>}</section></main>
}

function Topbar({ user, view, setView, isStaff, isAdmin, logout }: { user: User; view: View; setView: (view: View) => void; isStaff: boolean; isAdmin: boolean; logout: () => void }) {
  return <header className="topbar"><div className="brand"><div className="logo-mark">✦</div><div><strong>Care<br />Desk</strong><small>Operations workspace</small></div></div><nav><button className={view === 'widget' ? 'nav-active' : ''} onClick={() => setView('widget')}>Customer</button>{isStaff && <button className={view === 'inbox' ? 'nav-active' : ''} onClick={() => setView('inbox')}>Inbox</button>}{isAdmin && <button className={view === 'knowledge' ? 'nav-active' : ''} onClick={() => setView('knowledge')}>Knowledge base</button>}{isAdmin && <button className={view === 'accounts' ? 'nav-active' : ''} onClick={() => setView('accounts')}>Tài khoản</button>}<span className="nav-note">● Online</span></nav><div className="account"><span>{user.name}</span><small>{user.role}</small><button onClick={logout}>Đăng xuất</button></div></header>
}

function CustomerWidget({ active, messages, subject, setSubject, draft, setDraft, createConversation, sendMessage, busy }: { active: Conversation | null; messages: Message[]; subject: string; setSubject: (value: string) => void; draft: string; setDraft: (value: string) => void; createConversation: (event: FormEvent) => void; sendMessage: (event: FormEvent) => void; busy: boolean }) {
  return <section className="workspace widget-workspace"><section className="intro"><div><p className="kicker">LIVE CUSTOMER WIDGET</p><h1>Hỗ trợ nhanh, rõ ràng, liên tục.</h1><p>Gửi yêu cầu mới hoặc tiếp tục cuộc hội thoại đang mở của bạn.</p></div><div className="mode-tag">● Customer mode</div></section>{!active ? <form className="start-ticket" onSubmit={createConversation}><label>Bắt đầu yêu cầu hỗ trợ<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ví dụ: Không thể đăng nhập tài khoản" /></label><button className="action primary" disabled={busy}>Mở cuộc hội thoại</button></form> : <section className="chat-shell"><header className="chat-header"><div className="bot-avatar">✦</div><div><strong>{active.mode === 'human' ? 'Nhân viên hỗ trợ' : 'Support Assistant'}</strong><small>{active.mode === 'human' ? 'Đang được nhân viên xử lý' : 'Trực tuyến • Sẵn sàng tiếp nhận'}</small></div><span className={`status-pill ${active.status}`}>{labelStatus(active.status)}</span></header><div className="chat-history">{messages.length === 0 && <WelcomeMessage />}{messages.filter((message) => message.messageType !== 'internal_note').map((message) => <MessageBubble key={message._id} message={message} />)}</div><form className="message-composer" onSubmit={sendMessage}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nhập nội dung bạn cần hỗ trợ..." /><button className="send-button" disabled={busy || !draft.trim()}>➤</button></form></section>}</section>
}

function AgentInbox(props: { conversations: Conversation[]; allConversations: Conversation[]; active: Conversation | null; messages: Message[]; ticketQuery: string; setTicketQuery: (value: string) => void; statusFilter: 'all' | Status; setStatusFilter: (value: 'all' | Status) => void; priorityFilter: 'all' | Priority; setPriorityFilter: (value: 'all' | Priority) => void; selectConversation: (conversation: Conversation) => void; draft: string; setDraft: (value: string) => void; sendMessage: (event: FormEvent) => void; updateStatus: (status: Status) => void; updateMetadata: (changes: Partial<Pick<Conversation, 'priority' | 'category'>>) => void; addInternalNote: (content: string) => void; handoff: () => void; busy: boolean }) {
  const p = props
  return <section className="workspace inbox-workspace"><section className="inbox-grid">
    <aside className="ticket-list"><header className="panel-header"><div><p className="eyebrow">TICKET QUEUE</p><h2>Hộp thư đến</h2></div><span className="count-badge">{p.conversations.length}</span></header><input className="ticket-search" value={p.ticketQuery} onChange={(e) => p.setTicketQuery(e.target.value)} placeholder="Tìm ticket hoặc khách hàng" /><div className="ticket-filters"><select value={p.statusFilter} onChange={(e) => p.setStatusFilter(e.target.value as 'all' | Status)}><option value="all">Mọi trạng thái</option>{statuses.map((item) => <option key={item} value={item}>{labelStatus(item)}</option>)}</select><select value={p.priorityFilter} onChange={(e) => p.setPriorityFilter(e.target.value as 'all' | Priority)}><option value="all">Mọi ưu tiên</option>{priorities.map((item) => <option key={item} value={item}>{labelPriority(item)}</option>)}</select></div><div className="tickets">{p.conversations.map((item) => <button className={item._id === p.active?._id ? 'ticket selected-ticket' : 'ticket'} onClick={() => p.selectConversation(item)} key={item._id}><div className="ticket-meta"><small>#{item._id.slice(-6).toUpperCase()}</small><span className={`priority-dot ${item.priority ?? 'normal'}`}>{labelPriority(item.priority ?? 'normal')}</span></div><strong>{item.subject || 'Yêu cầu hỗ trợ'}</strong><p>{item.customer?.name ?? 'Khách hàng'} · {relativeTime(item.lastMessageAt)}</p><footer><span className={`tiny-status ${item.status}`}>{labelStatus(item.status)}</span><span>{item.mode === 'human' ? 'Agent' : 'AI'}</span></footer></button>)}{!p.conversations.length && <p className="empty">Không có ticket phù hợp.</p>}</div></aside>
    <section className="conversation-panel">{p.active ? <><header className="conversation-header"><div><p className="eyebrow">#{p.active._id.slice(-6).toUpperCase()}</p><h2>{p.active.subject || 'Yêu cầu hỗ trợ'}</h2><p>{p.active.customer?.name ?? 'Khách hàng'} · {p.active.customer?.email ?? 'Chưa có email'}</p></div><div className="conversation-actions"><span className={`status-pill ${p.active.status}`}>{labelStatus(p.active.status)}</span>{p.active.mode === 'ai' && <button className="action outline" onClick={p.handoff} disabled={p.busy}>Nhận ticket</button>}</div></header><div className="chat-history agent-history">{p.messages.length === 0 && <WelcomeMessage />}{p.messages.map((message) => <MessageBubble key={message._id} message={message} />)}</div><form className="agent-composer" onSubmit={p.sendMessage}><textarea value={p.draft} onChange={(e) => p.setDraft(e.target.value)} placeholder="Trả lời khách hàng…" rows={3} /><div><span>Phản hồi này sẽ được gửi tới khách hàng.</span><button className="action primary" disabled={p.busy || !p.draft.trim()}>Gửi phản hồi</button></div></form></> : <EmptyConversation />}</section>
    <TicketInspector active={p.active} busy={p.busy} updateStatus={p.updateStatus} updateMetadata={p.updateMetadata} addInternalNote={p.addInternalNote} />
  </section><section className="metrics"><Metric label="Đang hiển thị" value={p.conversations.length} /><Metric label="Đang mở" value={p.allConversations.filter((item) => item.status === 'open').length} /><Metric label="Ưu tiên cao" value={p.allConversations.filter((item) => ['high', 'urgent'].includes(item.priority ?? 'normal')).length} /><Metric label="Đã hoàn tất" value={p.allConversations.filter((item) => item.status === 'resolved' || item.status === 'closed').length} /></section></section>
}

function TicketInspector({ active, busy, updateStatus, updateMetadata, addInternalNote }: { active: Conversation | null; busy: boolean; updateStatus: (status: Status) => void; updateMetadata: (changes: Partial<Pick<Conversation, 'priority' | 'category'>>) => void; addInternalNote: (content: string) => void }) {
  const [note, setNote] = useState('')
  useEffect(() => { setNote('') }, [active?._id])
  if (!active) return <aside className="inspector empty-inspector">Chọn một ticket để xem chi tiết.</aside>
  return <aside className="inspector"><header className="panel-header"><div><p className="eyebrow">TICKET INSPECTOR</p><h2>Thông tin xử lý</h2></div></header><section className="inspector-section"><label>Trạng thái<select value={active.status} onChange={(e) => updateStatus(e.target.value as Status)} disabled={busy}>{statuses.map((item) => <option key={item} value={item}>{labelStatus(item)}</option>)}</select></label><label>Mức ưu tiên<select value={active.priority ?? 'normal'} onChange={(e) => updateMetadata({ priority: e.target.value as Priority })} disabled={busy}>{priorities.map((item) => <option key={item} value={item}>{labelPriority(item)}</option>)}</select></label><label>Danh mục<select value={active.category ?? 'general'} onChange={(e) => updateMetadata({ category: e.target.value as Category })} disabled={busy}>{categories.map((item) => <option key={item} value={item}>{labelCategory(item)}</option>)}</select></label></section><section className="inspector-section customer-summary"><p className="eyebrow">NGƯỜI GỬI</p><strong>{active.customer?.name ?? 'Khách hàng'}</strong><span>{active.customer?.email ?? 'Chưa có email'}</span><span>{active.assignedAgent ? `Phụ trách: ${active.assignedAgent.name}` : 'Chưa phân công'}</span></section><section className="inspector-section internal-note"><div><p className="eyebrow">GHI CHÚ NỘI BỘ</p><small>Chỉ hiển thị cho đội hỗ trợ.</small></div><textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi bối cảnh, bước tiếp theo hoặc thông tin bàn giao…" /><button className="action note-action" disabled={busy || !note.trim()} onClick={() => { addInternalNote(note); setNote('') }}>Thêm ghi chú</button></section></aside>
}

function KnowledgeBase({ articles, articleQuery, setArticleQuery, loadArticles, editingArticle, setEditingArticle, saveArticle, deleteArticle, busy }: { articles: Article[]; articleQuery: string; setArticleQuery: (value: string) => void; loadArticles: (query?: string) => Promise<void>; editingArticle: Article | null; setEditingArticle: (article: Article | null) => void; saveArticle: (article: Omit<Article, '_id' | 'updatedAt'>, id?: string) => Promise<void>; deleteArticle: (article: Article) => Promise<void>; busy: boolean }) {
  return <section className="workspace knowledge-workspace"><section className="workspace-title"><div><p className="kicker">ADMIN CONTENT OPERATIONS</p><h1>Knowledge base</h1><p>Xây dựng câu trả lời chuẩn để hỗ trợ đội ngũ và AI assistant.</p></div><button className="action primary" onClick={() => setEditingArticle({ _id: '', title: '', content: '', tags: [], isPublished: true, updatedAt: '' })}>+ Bài viết mới</button></section><section className="knowledge-grid"><section className="article-library"><div className="library-toolbar"><input value={articleQuery} onChange={(e) => setArticleQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void loadArticles(articleQuery) }} placeholder="Tìm trong knowledge base" /><button className="action outline" onClick={() => void loadArticles(articleQuery)} disabled={busy}>Tìm</button></div><p className="library-count">{articles.length} bài viết đã xuất bản</p><div className="article-list">{articles.map((article) => <article className={editingArticle?._id === article._id ? 'article-row selected-article' : 'article-row'} key={article._id}><button onClick={() => setEditingArticle(article)}><strong>{article.title}</strong><p>{article.content.slice(0, 150)}{article.content.length > 150 ? '…' : ''}</p><div>{article.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}</div><small>Cập nhật {new Date(article.updatedAt).toLocaleDateString('vi-VN')}</small></button><button className="icon-button" aria-label={`Xóa ${article.title}`} onClick={() => void deleteArticle(article)} disabled={busy}>×</button></article>)}{!articles.length && <p className="empty">Chưa tìm thấy bài viết.</p>}</div></section><ArticleEditor key={editingArticle?._id ?? 'new'} article={editingArticle} onCancel={() => setEditingArticle(null)} onSave={saveArticle} busy={busy} /></section></section>
}

function ArticleEditor({ article, onCancel, onSave, busy }: { article: Article | null; onCancel: () => void; onSave: (article: Omit<Article, '_id' | 'updatedAt'>, id?: string) => Promise<void>; busy: boolean }) {
  const [title, setTitle] = useState(article?.title ?? '')
  const [content, setContent] = useState(article?.content ?? '')
  const [tags, setTags] = useState(article?.tags.join(', ') ?? '')
  const [isPublished, setIsPublished] = useState(article?.isPublished ?? true)
  if (!article) return <section className="article-editor empty-editor"><div><p className="eyebrow">ARTICLE EDITOR</p><h2>Chọn hoặc tạo bài viết</h2><p>Chọn bài ở danh sách bên trái để chỉnh sửa nội dung, thẻ và trạng thái xuất bản.</p></div></section>
  async function submit(event: FormEvent) { event.preventDefault(); await onSave({ title, content, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), isPublished }, article._id || undefined) }
  return <form className="article-editor" onSubmit={submit}><header><div><p className="eyebrow">ARTICLE EDITOR</p><h2>{article._id ? 'Chỉnh sửa bài viết' : 'Bài viết mới'}</h2></div><button type="button" className="icon-button" onClick={onCancel}>×</button></header><label>Tiêu đề<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required placeholder="Ví dụ: Cách cập nhật thông tin thanh toán" /></label><label>Thẻ (ngăn cách bằng dấu phẩy)<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="billing, invoice, account" /></label><label className="article-content">Nội dung<textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={10000} required placeholder="Viết hướng dẫn rõ ràng, từng bước…" /></label><label className="publish-toggle"><input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} /> Xuất bản để AI và khách hàng có thể tìm thấy</label><footer><button type="button" className="action outline" onClick={onCancel}>Hủy</button><button className="action primary" disabled={busy}>{article._id ? 'Lưu thay đổi' : 'Xuất bản bài viết'}</button></footer></form>
}

function AccountManager({ accounts, accountQuery, setAccountQuery, accountRole, setAccountRole, loadAccounts, updateAccount, user, busy }: { accounts: Account[]; accountQuery: string; setAccountQuery: (x: string) => void; accountRole: 'all' | Role; setAccountRole: (x: 'all' | Role) => void; loadAccounts: () => Promise<void>; updateAccount: (account: Account, changes: Partial<Pick<Account, 'role' | 'isActive'>>) => Promise<void>; user: User; busy: boolean }) {
  return <section className="workspace account-workspace"><section className="intro"><div><p className="kicker">ADMIN ACCOUNT CONTROL</p><h1>Quản lý customer, agent và admin.</h1><p>Thay đổi role, vô hiệu hóa tài khoản và kiểm tra hoạt động gần nhất.</p></div><div className="mode-tag">● Administrator only</div></section><section className="account-panel"><div className="account-filters"><input value={accountQuery} onChange={(e) => setAccountQuery(e.target.value)} placeholder="Tìm theo tên hoặc email" /><select value={accountRole} onChange={(e) => setAccountRole(e.target.value as 'all' | Role)}><option value="all">Tất cả role</option><option value="customer">Customer</option><option value="agent">Agent</option><option value="admin">Admin</option></select><button className="action primary" onClick={() => void loadAccounts()} disabled={busy}>Tìm tài khoản</button></div><div className="account-table"><div className="account-row account-heading"><span>Tài khoản</span><span>Role</span><span>Trạng thái</span><span>Đăng nhập gần nhất</span><span>Điều khiển</span></div>{accounts.map((account) => <div className="account-row" key={account.id}><div><strong>{account.name}</strong><small>{account.email}<br />Tạo: {new Date(account.createdAt).toLocaleDateString('vi-VN')}</small></div><select value={account.role} onChange={(e) => void updateAccount(account, { role: e.target.value as Role })} disabled={busy || account.id === user.id}><option value="customer">Customer</option><option value="agent">Agent</option><option value="admin">Admin</option></select><span className={account.isActive ? 'active-account' : 'inactive-account'}>{account.isActive ? '● Đang hoạt động' : '● Đã khóa'}</span><small>{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</small><button className="action outline" onClick={() => void updateAccount(account, { isActive: !account.isActive })} disabled={busy || account.id === user.id}>{account.isActive ? 'Khóa' : 'Kích hoạt'}</button></div>)}</div></section></section>
}

function EmptyConversation() { return <div className="empty-conversation"><p className="eyebrow">INBOX</p><h2>Chọn một ticket</h2><p>Thông tin trao đổi và điều khiển xử lý sẽ hiện ở đây.</p></div> }
function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div> }
function WelcomeMessage() { return <article className="bubble ai"><small>Support Assistant</small><p>Xin chào! Bạn đang cần hỗ trợ về vấn đề gì?</p></article> }
function MessageBubble({ message }: { message: Message }) { const internal = message.messageType === 'internal_note'; const label = internal ? 'Ghi chú nội bộ' : message.senderType === 'customer' ? 'Khách hàng' : message.senderType === 'agent' ? 'Nhân viên hỗ trợ' : message.senderType === 'system' ? 'Hệ thống' : 'Support Assistant'; return <article className={`bubble ${internal ? 'internal-note-bubble' : message.senderType}`}><small>{label}<time>{new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></small><p>{message.content}</p></article> }
function labelStatus(status: Status) { return ({ open: 'Mới mở', pending: 'Đang xử lý', resolved: 'Đã hoàn tất', closed: 'Đã đóng' })[status] }
function labelPriority(priority: Priority) { return ({ low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp' })[priority] }
function labelCategory(category: Category) { return ({ general: 'Chung', account: 'Tài khoản', billing: 'Thanh toán', technical: 'Kỹ thuật', other: 'Khác' })[category] }
function relativeTime(value: string) { const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 60 ? `${minutes} phút trước` : `${Math.floor(minutes / 60)} giờ trước` }
async function request<T>(path: string, token = '', options: RequestInit = {}): Promise<T> { const response = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } }); const data = await response.json().catch(() => ({})) as T & { message?: string }; if (!response.ok) throw new Error(data.message ?? `Lỗi ${response.status}`); return data }
function errorText(error: unknown) { return error instanceof Error ? error.message : 'Có lỗi xảy ra' }
export default App
