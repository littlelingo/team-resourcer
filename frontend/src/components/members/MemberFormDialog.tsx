import { useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getImageUrl } from '@/lib/api-client'
import Field from '@/components/shared/Field'
import ImageUpload from '@/components/shared/ImageUpload'
import SelectField from '@/components/shared/SelectField'
import { useMembers, useCreateMember, useUpdateMember } from '@/hooks/useMembers'
import { apiFetch } from '@/lib/api-client'
import { useFunctionalAreas } from '@/hooks/useFunctionalAreas'
import { useTeams } from '@/hooks/useTeams'
import type { TeamMember } from '@/types'

// ─── Schema ──────────────────────────────────────────────────────────────────

const memberFormSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  hire_date: z.string().optional(),
  title: z.string(),
  email: z.string().email('Invalid email').or(z.literal('')),
  phone: z.string(),
  slack_handle: z.string(),
  city: z.string(),
  state: z.string(),
  functional_area_id: z.string().nullable(),
  team_id: z.string().nullable(),
  supervisor_id: z.string(),
  functional_manager_id: z.string(),
  salary: z.string(),
  bonus: z.string(),
  pto_used: z.string(),
})

type MemberFormValues = z.infer<typeof memberFormSchema>

// ─── Props ────────────────────────────────────────────────────────────────────

interface MemberFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member?: TeamMember
  onSuccess?: () => void
}

// ─── Input class ──────────────────────────────────────────────────────────────

const inputCls = cn(
  'flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm',
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

// ─── Main component ───────────────────────────────────────────────────────────

export default function MemberFormDialog({
  open,
  onOpenChange,
  member,
  onSuccess,
}: MemberFormDialogProps) {
  const isEdit = Boolean(member)

  // Store the picked image file in a ref so it's accessible in onSubmit
  const imageFileRef = useRef<File | null>(null)

  const createMember = useCreateMember()
  const updateMember = useUpdateMember()
  const { data: areas = [] } = useFunctionalAreas()
  const { data: allMembers = [] } = useMembers()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      employee_id: member?.employee_id ?? '',
      first_name: member?.first_name ?? '',
      last_name: member?.last_name ?? '',
      hire_date: member?.hire_date ?? '',
      title: member?.title ?? '',
      email: member?.email ?? '',
      phone: member?.phone ?? '',
      slack_handle: member?.slack_handle ?? '',
      city: member?.city ?? '',
      state: member?.state ?? '',
      functional_area_id:
        member?.functional_area_id != null ? String(member.functional_area_id) : null,
      team_id: member?.team_id != null ? String(member.team_id) : null,
      supervisor_id: member?.supervisor_id ?? '',
      functional_manager_id: member?.functional_manager_id ?? '',
      salary: member?.salary ?? '',
      bonus: member?.bonus ?? '',
      pto_used: member?.pto_used ?? '',
    },
  })

  const selectedAreaId = watch('functional_area_id')
  const areaIdNum = selectedAreaId ? parseInt(selectedAreaId, 10) : undefined
  const { data: teams = [] } = useTeams(areaIdNum)

  // Clear team_id when functional_area_id changes, but not on initial render
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setValue('team_id', null)
  }, [selectedAreaId, setValue])

  // Reset the first-render guard when the dialog opens/member changes
  useEffect(() => {
    isFirstRender.current = true
  }, [open, member])

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function onSubmit(values: MemberFormValues) {
    try {
      let memberUuid: string
      if (isEdit && member) {
        const updated = await updateMember.mutateAsync({
          uuid: member.uuid,
          data: {
            employee_id: values.employee_id,
            first_name: values.first_name,
            last_name: values.last_name,
            hire_date: values.hire_date || undefined,
            title: values.title || undefined,
            email: values.email || undefined,
            phone: values.phone || undefined,
            slack_handle: values.slack_handle || undefined,
            city: values.city || undefined,
            state: values.state || undefined,
            functional_area_id: values.functional_area_id
              ? parseInt(values.functional_area_id, 10)
              : undefined,
            team_id: values.team_id ? parseInt(values.team_id, 10) : undefined,
            supervisor_id: values.supervisor_id || undefined,
            functional_manager_id: values.functional_manager_id || undefined,
            salary: values.salary || undefined,
            bonus: values.bonus || undefined,
            pto_used: values.pto_used || undefined,
          },
        })
        memberUuid = updated.uuid
        toast.success('Member updated')
      } else {
        const created = await createMember.mutateAsync({
          employee_id: values.employee_id,
          first_name: values.first_name,
          last_name: values.last_name,
          hire_date: values.hire_date || undefined,
          title: values.title || undefined,
          email: values.email || '',
          phone: values.phone || undefined,
          slack_handle: values.slack_handle || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
          functional_area_id: values.functional_area_id
            ? parseInt(values.functional_area_id, 10)
            : undefined,
          team_id: values.team_id ? parseInt(values.team_id, 10) : undefined,
          supervisor_id: values.supervisor_id || undefined,
          functional_manager_id: values.functional_manager_id || undefined,
          salary: values.salary || undefined,
          bonus: values.bonus || undefined,
          pto_used: values.pto_used || undefined,
        })
        memberUuid = created.uuid
        toast.success('Member created')
      }

      // Upload image if one was selected
      if (imageFileRef.current) {
        const formData = new FormData()
        formData.append('file', imageFileRef.current)
        await apiFetch(`/api/members/${memberUuid}/image`, {
          method: 'POST',
          body: formData,
        })
      }

      onSuccess?.()
      onOpenChange(false)
      reset()
      imageFileRef.current = null
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  // Supervisor options: all members except self
  const supervisorOptions = allMembers
    .filter((m) => !member || m.uuid !== member.uuid)
    .map((m) => ({ value: m.uuid, label: `${m.first_name} ${m.last_name}` }))

  const areaOptions = areas.map((a) => ({ value: String(a.id), label: a.name }))
  const teamOptions = teams.map((t) => ({ value: String(t.id), label: t.name }))

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          imageFileRef.current = null
        }
        onOpenChange(o)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
            'rounded-lg bg-white shadow-xl',
            'flex flex-col max-h-[90vh]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              {isEdit ? 'Edit Member' : 'Add Member'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable body */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
              {/* Photo */}
              <Field label="Photo">
                <ImageUpload
                  value={getImageUrl(member?.image_path)}
                  onChange={(file) => {
                    imageFileRef.current = file
                  }}
                />
              </Field>

              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" required error={errors.first_name?.message}>
                  <input
                    {...register('first_name')}
                    className={inputCls}
                    placeholder="First name"
                  />
                </Field>
                <Field label="Last Name" required error={errors.last_name?.message}>
                  <input
                    {...register('last_name')}
                    className={inputCls}
                    placeholder="Last name"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Hire Date" error={errors.hire_date?.message}>
                  <input
                    {...register('hire_date')}
                    type="date"
                    className={inputCls}
                  />
                </Field>
                <Field label="Employee ID" required error={errors.employee_id?.message}>
                  <input
                    {...register('employee_id')}
                    className={inputCls}
                    placeholder="EMP-001"
                  />
                </Field>
              </div>

              <Field label="Title" error={errors.title?.message}>
                <input {...register('title')} className={inputCls} placeholder="Job title" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" error={errors.email?.message}>
                  <input
                    {...register('email')}
                    type="email"
                    className={inputCls}
                    placeholder="email@example.com"
                  />
                </Field>
                <Field label="Phone" error={errors.phone?.message}>
                  <input
                    {...register('phone')}
                    className={inputCls}
                    placeholder="+1 555 0100"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="City" error={errors.city?.message}>
                  <input
                    {...register('city')}
                    className={inputCls}
                    placeholder="Austin"
                  />
                </Field>
                <Field label="State" error={errors.state?.message}>
                  <input
                    {...register('state')}
                    className={inputCls}
                    placeholder="TX"
                  />
                </Field>
              </div>

              <Field label="Slack Handle" error={errors.slack_handle?.message}>
                <input
                  {...register('slack_handle')}
                  className={inputCls}
                  placeholder="@handle"
                />
              </Field>

              {/* Organization */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Functional Area">
                  <Controller
                    control={control}
                    name="functional_area_id"
                    render={({ field }) => (
                      <SelectField
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="Select area"
                        options={areaOptions}
                      />
                    )}
                  />
                </Field>
                <Field label="Team">
                  <Controller
                    control={control}
                    name="team_id"
                    render={({ field }) => (
                      <SelectField
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="Select team"
                        options={teamOptions}
                        disabled={!selectedAreaId}
                      />
                    )}
                  />
                </Field>
              </div>

              <Field label="Direct Manager">
                <Controller
                  control={control}
                  name="supervisor_id"
                  render={({ field }) => (
                    <SelectField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select direct manager"
                      options={supervisorOptions}
                    />
                  )}
                />
              </Field>

              <Field label="Functional Manager">
                <Controller
                  control={control}
                  name="functional_manager_id"
                  render={({ field }) => (
                    <SelectField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select functional manager"
                      options={supervisorOptions}
                    />
                  )}
                />
              </Field>

              {/* Compensation */}
              <div className="grid grid-cols-3 gap-3">
                <Field label="Salary" error={errors.salary?.message}>
                  <input
                    {...register('salary')}
                    type="number"
                    step="0.01"
                    className={inputCls}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Bonus" error={errors.bonus?.message}>
                  <input
                    {...register('bonus')}
                    type="number"
                    step="0.01"
                    className={inputCls}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="PTO Used (hrs)" error={errors.pto_used?.message}>
                  <input
                    {...register('pto_used')}
                    type="number"
                    step="0.01"
                    className={inputCls}
                    placeholder="0.00"
                  />
                </Field>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 flex-shrink-0">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
