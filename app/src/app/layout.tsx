import "./globals.css";
export const metadata = { title: "Gaurberg", description: "Company pages and ecosystem maps for independent analysts" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
