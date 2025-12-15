export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-background border-t border-border mt-16 py-6 flex items-center">
      <div className="max-w-4xl mx-auto px-4 w-full">
        <p className="text-center text-sm text-muted-foreground">
          © {currentYear} ClarifAI. Developed by{' '}
          <span className="font-semibold text-blue-500">
            John Aaron Tumangan
          </span>
          .
        </p>
      </div>
    </footer>
  )
}