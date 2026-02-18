export const metadata = {
  title: 'Command Center',
  description: 'Project command center with Kanban task tracking',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#0d2b3e', color: '#f1f5f9' }}>
        {children}
      </body>
    </html>
  )
}
