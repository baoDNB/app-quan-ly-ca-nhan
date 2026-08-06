import "./globals.css";

export const metadata = {
  title: "Nhà — Quản lý cá nhân",
  description: "Quản lý thời gian, ghi chú và chi tiêu cá nhân",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3eb",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
