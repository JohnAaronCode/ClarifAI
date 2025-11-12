export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-background border-t border-border mt-16">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-center text-sm text-muted-foreground">
          Developed by John Aaron Tumangan© {currentYear} ClarifAI. All rights reserved.
        </p>
      </div>
    </footer>
  )
}