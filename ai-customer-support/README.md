# AI Customer Support Platform

Ứng dụng hỗ trợ khách hàng gồm React/Vite frontend, Express/TypeScript backend, MongoDB, JWT và Gemini AI. Toàn bộ dependencies được cài một lần tại root `node_modules/`.

## Cấu trúc

```text
ai-customer-support/
├── backend/
│   ├── src/
│   └── tests/
│       └── unit/
├── frontend/
│   └── src/
├── node_modules/
├── package.json
└── package-lock.json
```

## Cài đặt

```bash
npm install
```

Tạo `backend/.env` từ mẫu `backend/.env.example`, sau đó điền MongoDB, JWT và Gemini API key thật. Không commit file `.env`.

## Chạy local

Terminal 1:

```bash
npm run dev:backend
```

Terminal 2:

```bash
npm run dev:frontend
```

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:3000/api/health`

## Scripts

```bash
npm run build          # Build backend + frontend
npm test               # Unit tests backend + frontend lint
npm run clean          # Xóa build output/cache có thể tạo lại
npm run create:admin   # Tạo/cập nhật admin (xem biến môi trường bên dưới)
```

Tạo admin an toàn bằng biến môi trường (không đưa mật khẩu vào source):

```bash
cd backend
ADMIN_NAME="System Admin" \
ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="a-strong-password" \
npm run create:admin
```

## Roles

- `customer`: tạo và theo dõi ticket của chính mình.
- `agent`: xử lý ticket chưa gán hoặc được gán cho họ.
- `admin`: quản lý ticket và tab quản lý tài khoản; có thể đổi role/khóa/mở khóa account.

## Test layout

Backend unit tests nằm trong:

```text
backend/tests/unit/
```

Test build source TypeScript vào `backend/dist/` trước, rồi chạy Node built-in test runner. `dist/`, frontend build output và TypeScript cache là generated artifacts; không cần lưu vào Git.

