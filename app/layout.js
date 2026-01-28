export const metadata = {
  title: 'Ariel Status Board',
  description: 'Kanban-style task tracking',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#0f172a', color: '#f1f5f9' }}>
        {children}
      </body>
    </html>
  )
}
