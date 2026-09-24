import './globals.css';

export const metadata = { title: 'Order Log', description: 'Supplier receipts and prices for our restaurants' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#12304F' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@600;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🧾</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
