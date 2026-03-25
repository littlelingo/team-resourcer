interface FieldProps {
  label: string
  error?: string
  children: React.ReactNode
  required?: boolean
}

export default function Field({ label, error, children, required }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
