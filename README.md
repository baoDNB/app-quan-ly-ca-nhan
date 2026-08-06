# Nhà — App quản lý cá nhân

Ứng dụng tổng hợp ba công cụ: Nhịp (thời gian), Mây Note (ghi chú) và Ví Nhỏ (chi tiêu), chạy trên Next.js App Router.

## Chạy ứng dụng

Yêu cầu Node.js 20 trở lên. Chạy lần lượt:

```powershell
npm install
npm run dev
```

Mở `http://127.0.0.1:4320`. Trên Windows cũng có thể nhấp đúp `Chạy ứng dụng.bat` để tự cài thư viện (ở lần đầu), mở trình duyệt và chạy development server.

Để kiểm tra và chạy bản production:

```powershell
npm run build
npm start
```

## Cấu trúc

- `app/`: giao diện Next.js chính và tích hợp đăng nhập/đồng bộ Firebase.
- `public/apps/`: ba ứng dụng con hiện có, được phục vụ như static assets để giữ nguyên dữ liệu `localStorage` và hành vi cũ.

Dữ liệu được lưu trong `localStorage`. Khi đăng nhập Google, dữ liệu được đồng bộ với Firebase Realtime Database như phiên bản trước.
