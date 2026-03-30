import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-client'
import { useMembers, useCreateMember, useUpdateMember } from '@/hooks/useMembers'
import { useFunctionalAreas } from '@/hooks/useFunctionalAreas'
import { useTeams } from '@/hooks/useTeams'
import { usePrograms } from '@/hooks/usePrograms'
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
  program_ids: z.array(z.string()).optional(),
})

export type MemberFormValues = z.infer<typeof memberFormSchema>

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseMemberFormOptions {
  member?: TeamMember
  onSuccess?: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function useMemberForm({ member, onSuccess, onOpenChange, open }: UseMemberFormOptions) {
  const isEdit = Boolean(member)
  const imageFileRef = useRef<File | null>(null)

  const createMember = useCreateMember()
  const updateMember = useUpdateMember()
  const { data: areas = [] } = useFunctionalAreas()
  const { data: allMembers = [] } = useMembers()
  const { data: programs = [] } = usePrograms()

  const form = useForm<MemberFormValues>({
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
      program_ids: member?.program_assignments?.map((pa) => String(pa.program_id)) ?? [],
    },
  })

  const selectedAreaId = form.watch('functional_area_id')
  const areaIdNum = selectedAreaId ? parseInt(selectedAreaId, 10) : undefined
  const { data: teams = [] } = useTeams(areaIdNum)

  // Clear team_id when functional_area_id changes, but not on initial render
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    form.setValue('team_id', null)
  }, [selectedAreaId, form.setValue])

  // Reset the first-render guard when the dialog opens/member changes
  useEffect(() => {
    isFirstRender.current = true
  }, [open, member])

  // Reset form values when dialog opens with member data (edit) or without (add)
  useEffect(() => {
    if (!open) return
    form.reset({
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
      program_ids: member?.program_assignments?.map((pa) => String(pa.program_id)) ?? [],
    })
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
          email: values.email,
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

      // Sync program assignments (diff current vs selected)
      const currentProgramIds = new Set(
        member?.program_assignments?.map((pa) => pa.program_id) ?? [],
      )
      const selectedProgramIds = new Set(
        (values.program_ids ?? []).map((id) => parseInt(id, 10)),
      )

      for (const id of selectedProgramIds) {
        if (!currentProgramIds.has(id)) {
          await apiFetch(`/api/programs/${id}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ member_uuid: memberUuid, program_id: id }),
          })
        }
      }

      for (const id of currentProgramIds) {
        if (!selectedProgramIds.has(id)) {
          await apiFetch(`/api/programs/${id}/assignments/${memberUuid}`, {
            method: 'DELETE',
          })
        }
      }

      onSuccess?.()
      onOpenChange(false)
      form.reset()
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
  const programOptions = programs.map((p) => ({ value: String(p.id), label: p.name }))

  return {
    form,
    isEdit,
    imageFileRef,
    onSubmit,
    supervisorOptions,
    areaOptions,
    teamOptions,
    programOptions,
    selectedAreaId,
  }
}
