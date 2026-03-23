import * as Dialog from '@radix-ui/react-dialog'
import * as Label from '@radix-ui/react-label'
import * as Select from '@radix-ui/react-select'
import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateTeam, useUpdateTeam } from '@/hooks/useTeams'
import { useFunctionalAreas } from '@/hooks/useFunctionalAreas'
import { useMembers } from '@/hooks/useMembers'
import type { Team } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  functional_area_id: z.coerce.number().min(1, 'Functional area is required'),
  description: z.string().optional(),
  lead_id: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface TeamFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team?: Team
  onSuccess?: () => void
}

export default function TeamFormDialog({
  open,
  onOpenChange,
  team,
  onSuccess,
}: TeamFormDialogProps) {
  const isEdit = Boolean(team)

  const areasQuery = useFunctionalAreas()
  const membersQuery = useMembers()

  // Area ID is determined at submit time from form values
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      functional_area_id: 0,
      description: '',
      lead_id: '',
    },
  })

  const selectedAreaId = watch('functional_area_id')

  // Create/update hooks — areaId is determined at submit time. We initialise
  // with a placeholder; the real call uses the form value.
  const createMutation = useCreateTeam(selectedAreaId)
  const updateMutation = useUpdateTeam(team?.functional_area_id ?? selectedAreaId)

  const isPending = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (open) {
      reset({
        name: team?.name ?? '',
        functional_area_id: team?.functional_area_id ?? 0,
        description: team?.description ?? '',
        lead_id: team?.lead_id ?? '',
      })
    }
  }, [open, team, reset])

  function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      lead_id: values.lead_id || undefined,
    }

    if (isEdit && team) {
      updateMutation.mutate(
        { id: team.id, data: payload },
        {
          onSuccess: () => {
            toast.success('Team updated')
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
          toast.success('Team created')
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
              {isEdit ? 'Edit Team' : 'Add Team'}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Name */}
            <div className="mb-4">
              <Label.Root
                htmlFor="team-name"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Name <span className="text-red-500">*</span>
              </Label.Root>
              <input
                id="team-name"
                type="text"
                {...register('name')}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Team name"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Functional Area */}
            <div className="mb-4">
              <Label.Root
                htmlFor="team-area"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Functional Area <span className="text-red-500">*</span>
              </Label.Root>
              <Controller
                name="functional_area_id"
                control={control}
                render={({ field }) => (
                  <Select.Root
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(val) => field.onChange(Number(val))}
                  >
                    <Select.Trigger
                      id="team-area"
                      className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 data-[placeholder]:text-slate-400"
                    >
                      <Select.Value placeholder="Select functional area" />
                      <Select.Icon>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        sideOffset={4}
                        className="z-[60] max-h-60 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md"
                      >
                        <Select.Viewport className="p-1">
                          {areasQuery.data?.map((area) => (
                            <Select.Item
                              key={area.id}
                              value={String(area.id)}
                              className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100"
                            >
                              <Select.ItemText>{area.name}</Select.ItemText>
                              <Select.ItemIndicator className="ml-auto">
                                <Check className="h-3.5 w-3.5" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                )}
              />
              {errors.functional_area_id && (
                <p className="mt-1 text-xs text-red-600">{errors.functional_area_id.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="mb-4">
              <Label.Root
                htmlFor="team-description"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Description
              </Label.Root>
              <textarea
                id="team-description"
                {...register('description')}
                rows={3}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                placeholder="Optional description"
              />
            </div>

            {/* Lead */}
            <div className="mb-6">
              <Label.Root
                htmlFor="team-lead"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Team Lead
              </Label.Root>
              <Controller
                name="lead_id"
                control={control}
                render={({ field }) => (
                  <Select.Root
                    value={field.value ?? ''}
                    onValueChange={(val) => field.onChange(val === '__none__' ? '' : val)}
                  >
                    <Select.Trigger
                      id="team-lead"
                      className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 data-[placeholder]:text-slate-400"
                    >
                      <Select.Value placeholder="Select team lead (optional)" />
                      <Select.Icon>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        sideOffset={4}
                        className="z-[60] max-h-60 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md"
                      >
                        <Select.Viewport className="p-1">
                          <Select.Item
                            value="__none__"
                            className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-slate-400 outline-none hover:bg-slate-100 focus:bg-slate-100"
                          >
                            <Select.ItemText>None</Select.ItemText>
                          </Select.Item>
                          {membersQuery.data?.map((member) => (
                            <Select.Item
                              key={member.uuid}
                              value={member.uuid}
                              className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100"
                            >
                              <Select.ItemText>{member.name}</Select.ItemText>
                              <Select.ItemIndicator className="ml-auto">
                                <Check className="h-3.5 w-3.5" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                )}
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
                {isEdit ? 'Save Changes' : 'Create Team'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
