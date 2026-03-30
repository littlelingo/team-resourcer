import { Controller } from 'react-hook-form'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getImageUrl } from '@/lib/api-client'
import Field from '@/components/shared/Field'
import ImageUpload from '@/components/shared/ImageUpload'
import SelectField from '@/components/shared/SelectField'
import { useMemberForm } from '@/components/members/useMemberForm'
import type { TeamMember } from '@/types'

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
  const {
    form,
    isEdit,
    imageFileRef,
    onSubmit,
    supervisorOptions,
    areaOptions,
    teamOptions,
    selectedAreaId,
  } = useMemberForm({ member, onSuccess, onOpenChange, open })

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = form

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
