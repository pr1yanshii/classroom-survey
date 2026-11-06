export default function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">
      {message}
    </p>
  )
}
