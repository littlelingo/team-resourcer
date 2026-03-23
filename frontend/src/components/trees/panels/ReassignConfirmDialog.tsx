import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { cn } from '@/lib/utils'
import type { Node } from '@xyflow/react'

interface ReassignConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  draggedNode: Node | null
  targetNode: Node | null
  verb?: string
}

export default function ReassignConfirmDialog({
  open,
  onConfirm,
  onCancel,
  draggedNode,
  targetNode,
  verb = 'report to',
}: ReassignConfirmDialogProps) {
  const draggedName = (draggedNode?.data?.name as string | undefined) ?? 'this member'
  const targetName = (targetNode?.data?.name as string | undefined) ?? 'the target'

  return (
    <AlertDialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <AlertDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-lg bg-white p-6 shadow-xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          )}
        >
          <AlertDialog.Title className="text-lg font-semibold text-slate-900">
            Confirm Reassignment
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-slate-500">
            Move <span className="font-medium text-slate-700">{draggedName}</span> to {verb}{' '}
            <span className="font-medium text-slate-700">{targetName}</span>?
          </AlertDialog.Description>

          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button
                onClick={onCancel}
                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Cancel
              </button>
            </AlertDialog.Cancel>

            <AlertDialog.Action asChild>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  onConfirm()
                }}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Move
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
