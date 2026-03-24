import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { Upload, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadFile, fetchGoogleSheet } from '@/api/importApi'

interface SourceStepProps {
  onSuccess: (
    sessionId: string,
    headers: string[],
    previewRows: Record<string, unknown>[],
    totalRowCount: number,
  ) => void
}

export default function SourceStep({ onSuccess }: SourceStepProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'sheets'>('file')
  const [isDragging, setIsDragging] = useState(false)
  const [sheetInput, setSheetInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── File upload mutation ──────────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(file),
    onSuccess: (data) => {
      onSuccess(data.session_id, data.headers, data.preview_rows, data.total_row_count)
    },
  })

  // ─── Google Sheets mutation ────────────────────────────────────────────────

  const sheetsMutation = useMutation({
    mutationFn: (urlOrId: string) => fetchGoogleSheet(urlOrId),
    onSuccess: (data) => {
      onSuccess(data.session_id, data.headers, data.preview_rows, data.total_row_count)
    },
  })

  // ─── File handlers ─────────────────────────────────────────────────────────

  function handleFile(file: File) {
    uploadMutation.reset()
    uploadMutation.mutate(file)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // ─── Sheets handler ────────────────────────────────────────────────────────

  function handleFetchSheet(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = sheetInput.trim()
    if (!trimmed) return
    sheetsMutation.reset()
    sheetsMutation.mutate(trimmed)
  }

  return (
    <div>
      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'file' | 'sheets')}
      >
        <Tabs.List className="flex gap-0 border-b border-slate-200 mb-6">
          <Tabs.Trigger
            value="file"
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'file'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            File Upload
          </Tabs.Trigger>
          <Tabs.Trigger
            value="sheets"
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'sheets'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            Google Sheets
          </Tabs.Trigger>
        </Tabs.List>

        {/* ── File Upload Tab ──────────────────────────────────────────── */}
        <Tabs.Content value="file">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 border-dashed cursor-pointer p-12 transition-colors',
              isDragging
                ? 'border-slate-700 bg-slate-50'
                : 'border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100',
              uploadMutation.isPending && 'pointer-events-none opacity-70',
            )}
          >
            {uploadMutation.isPending ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                <p className="text-sm text-slate-500">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                  <Upload className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Drag and drop a file, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Supports .csv and .xlsx files
                  </p>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            onChange={handleFileInputChange}
          />

          {uploadMutation.isError && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">
                {uploadMutation.error instanceof Error
                  ? uploadMutation.error.message
                  : 'Upload failed. Please try again.'}
              </p>
            </div>
          )}
        </Tabs.Content>

        {/* ── Google Sheets Tab ────────────────────────────────────────── */}
        <Tabs.Content value="sheets">
          <form onSubmit={handleFetchSheet} className="space-y-4">
            <div>
              <label
                htmlFor="sheet-input"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Sheet URL or ID
              </label>
              <input
                id="sheet-input"
                type="text"
                value={sheetInput}
                onChange={(e) => setSheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... or sheet ID"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                disabled={sheetsMutation.isPending}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Paste the full Google Sheets URL or just the sheet ID.
              </p>
            </div>

            <button
              type="submit"
              disabled={!sheetInput.trim() || sheetsMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {sheetsMutation.isPending ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Fetching...
                </>
              ) : (
                'Fetch Sheet'
              )}
            </button>

            {sheetsMutation.isError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-700">
                  {sheetsMutation.error instanceof Error
                    ? sheetsMutation.error.message
                    : 'Failed to fetch sheet. Please try again.'}
                </p>
              </div>
            )}
          </form>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
