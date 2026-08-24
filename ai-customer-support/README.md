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

## Knowledge Base và quản lý ticket

- Public FAQ/Knowledge Base: `GET /api/knowledge-base` và `GET /api/knowledge-base/search?q=<query>`.
- Chỉ admin được tạo, sửa và xóa bài viết Knowledge Base qua `POST`, `PATCH /:id`, `DELETE /:id` trên `/api/knowledge-base`.
- Khi customer nhắn tin trong AI mode, backend tìm tối đa ba bài Knowledge Base đã publish liên quan và đưa chúng vào Gemini prompt.
- Agent đã nhận ticket (hoặc admin) có thể cập nhật `priority` (`low`, `normal`, `high`, `urgent`) và `category` (`general`, `account`, `billing`, `technical`, `other`) qua `PATCH /api/conversations/:id/metadata`.
- Internal note dùng `POST /api/conversations/:id/internal-notes`; note chỉ hiển thị cho agent/admin, không trả về cho customer và không được gửi vào Gemini prompt.

## Test layout

Backend unit tests nằm trong:

```text
backend/tests/unit/
```

Test build source TypeScript vào `backend/dist/` trước, rồi chạy Node built-in test runner. `dist/`, frontend build output và TypeScript cache là generated artifacts; không cần lưu vào Git.

## Triển khai Render

Blueprint `render.yaml` đã khai báo API và static frontend với chung root dependency installation. Khi tạo Blueprint từ repository `VTI`, chọn đường dẫn `ai-customer-support/render.yaml`.

- API: `https://api.suptid.fun` với health check `/api/health`.
- Frontend: `https://support.suptid.fun`.
- Giá trị bí mật `MONGODB_URI`, `JWT_SECRET` và `GEMINI_API_KEY` được để `sync: false`; nhập trực tiếp trong Render, không đưa vào Git.
- Kiểm tra biến `CORS_ORIGINS=https://support.suptid.fun` và build lại frontend nếu thay đổi `VITE_API_BASE_URL`.

