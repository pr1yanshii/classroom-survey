export default function Loading({ message }: { message: string }) {
  return (
    <p role="status" className="p-8 text-center text-slate-600">
      {message}
    </p>
  )
}
