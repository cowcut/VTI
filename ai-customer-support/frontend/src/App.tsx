import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type User = {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  createdAt?: string
  updatedAt?: string
}

type AuthResponse = {
  success: boolean
  message?: string
  token?: string
  user?: User
}

type Mode = 'login' | 'register'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000'
const TOKEN_KEY = 'ai_customer_support_token'

function App() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '')
  const [user, setUser] = useState<User | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isRegister = mode === 'register'

  const authStatus = useMemo(() => {
    if (user) return `Đang đăng nhập: ${user.name} (${user.role})`
    if (token) return 'Đã có token, đang kiểm tra phiên đăng nhập...'
    return 'Chưa đăng nhập'
  }, [token, user])

  useEffect(() => {
    if (!token) return

    const loadMe = async () => {
      try {
        const data = await apiRequest<AuthResponse>('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (data.user) setUser(data.user)
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        setToken('')
        setUser(null)
      }
    }

    loadMe()
  }, [token])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
      const payload = isRegister ? { name, email, password } : { email, password }
      const data = await apiRequest<AuthResponse>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!data.token || !data.user) {
        throw new Error('Backend không trả về token hoặc user')
      }

      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
      setPassword('')
      setMessage(data.message ?? (isRegister ? 'Đăng ký thành công' : 'Đăng nhập thành công'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setUser(null)
    setMessage('Đã đăng xuất')
    setError('')
  }

  const handleModeChange = (nextMode: Mode) => {
    setMode(nextMode)
    setMessage('')
    setError('')
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="eyebrow">AI Customer Support Platform</div>
        <h1>Frontend kết nối Backend Auth</h1>
        <p>
          Giao diện đăng ký, đăng nhập và xem thông tin tài khoản đang dùng trực tiếp
          các API <code>/api/auth/register</code>, <code>/api/auth/login</code>,{' '}
          <code>/api/auth/me</code>.
        </p>
        <div className="status-card">
          <span>Trạng thái</span>
          <strong>{authStatus}</strong>
        </div>
      </section>

      <section className="auth-layout">
        <div className="panel auth-panel">
          <div className="tabs" role="tablist" aria-label="Auth mode">
            <button
              className={mode === 'login' ? 'active' : ''}
              type="button"
              onClick={() => handleModeChange('login')}
            >
              Đăng nhập
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              type="button"
              onClick={() => handleModeChange('register')}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {isRegister && (
              <label>
                Họ tên
                <input
                  autoComplete="name"
                  minLength={2}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nguyễn Văn A"
                  required
                  value={name}
                />
              </label>
            )}

            <label>
              Email
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="customer@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            <label>
              Mật khẩu
              <input
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                required
                type="password"
                value={password}
              />
            </label>

            <button className="primary-button" disabled={loading} type="submit">
              {loading ? 'Đang xử lý...' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
            </button>
          </form>

          {message && <div className="alert success">{message}</div>}
          {error && <div className="alert error">{error}</div>}
        </div>

        <div className="panel profile-panel">
          <h2>Thông tin tài khoản</h2>
          {user ? (
            <div className="profile-card">
              <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div>
                <h3>{user.name}</h3>
                <p>{user.email}</p>
                <span>{user.role}</span>
              </div>
              <button className="ghost-button" onClick={handleLogout} type="button">
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <h3>Chưa có user</h3>
              <p>Đăng nhập hoặc đăng ký để gọi endpoint /api/auth/me.</p>
            </div>
          )}

          <div className="api-list">
            <h3>Backend đang dùng</h3>
            <code>{API_BASE_URL}</code>
            <ul>
              <li>POST /api/auth/register</li>
              <li>POST /api/auth/login</li>
              <li>GET /api/auth/me</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  const data = (await response.json().catch(() => ({}))) as T & { message?: string }

  if (!response.ok) {
    throw new Error(data.message ?? `Request failed with status ${response.status}`)
  }

  return data
}

export default App
