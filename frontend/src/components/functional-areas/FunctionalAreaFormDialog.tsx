import * as Dialog from '@radix-ui/react-dialog'
import * as Label from '@radix-ui/react-label'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateFunctionalArea, useUpdateFunctionalArea } from '@/hooks/useFunctionalAreas'
import type { FunctionalArea } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface FunctionalAreaFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  area?: FunctionalArea
  onSuccess?: () => void
}

export default function FunctionalAreaFormDialog({
  open,
  onOpenChange,
  area,
  onSuccess,
}: FunctionalAreaFormDialogProps) {
  const isEdit = Boolean(area)
  const createMutation = useCreateFunctionalArea()
  const updateMutation = useUpdateFunctionalArea()
  const isPending = createMutation.isPending || updateMutation.isPending

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: area?.name ?? '',
        description: area?.description ?? '',
      })
    }
  }, [open, area, reset])

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      description: values.description || undefined,
    }

    if (isEdit && area) {
      updateMutation.mutate(
        { id: area.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Functional area updated')
            onOpenChange(false)
            onSuccess?.()
          },
          onError: (err) => {
            toast.error(err.message)
          },
        },
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Functional area created')
          onOpenChange(false)
          onSuccess?.()
        },
        onError: (err) => {
          toast.error(err.message)
        },
      })
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Edit Functional Area' : 'Add Functional Area'}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Name */}
            <div className="mb-4">
              <Label.Root
                htmlFor="area-name"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Name <span className="text-red-500">*</span>
              </Label.Root>
              <input
                id="area-name"
                type="text"
                {...register('name')}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Functional area name"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <Label.Root
                htmlFor="area-description"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Description
              </Label.Root>
              <textarea
                id="area-description"
                {...register('description')}
                rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                placeholder="Optional description"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isPending}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Create Area'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
