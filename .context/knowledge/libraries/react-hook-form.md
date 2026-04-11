# React Hook Form

> Last updated: 2026-04-09
> Source: Discovered during feature 045 (edit member form prefill).

## Quirks & Gotchas

### Duplicated `defaultValues` between `useForm({ defaultValues })` and `form.reset(...)`

When a form uses both `useForm({ defaultValues })` for initial state AND a `useEffect` with `form.reset(...)` for re-initialization when props change (the standard "edit existing entity" pattern), the values object gets duplicated verbatim in two places. Missing a single field in one location causes silent bugs:

- If missing from `useForm({ defaultValues })`: the form doesn't prefill on first open, but resets correctly on subsequent opens. Confusing.
- If missing from `form.reset(...)`: the form prefills on first open but doesn't update when the edited entity changes. Also confusing.

### Fix: extract `buildDefaultValues`

```ts
function buildDefaultValues(entity?: Entity): FormValues {
  return {
    name: entity?.name ?? "",
    email: entity?.email ?? "",
    // … every field, in one place …
  }
}

const form = useForm({
  defaultValues: buildDefaultValues(initialEntity),
})

useEffect(() => {
  form.reset(buildDefaultValues(entity))
}, [entity, form])
```

Now both code paths go through the same helper. Adding a field means editing one function, not two. Missing-field bugs become impossible.

## Patterns We Use

- **Always pair with Zod**: `zodResolver` from `@hookform/resolvers/zod` for schema-driven validation. Schema lives next to the form component, not in a shared types file.
- **`buildDefaultValues` helper**: applies whenever a form can both create and edit an entity. See `frontend/src/components/members/useMemberForm.ts` and the edit pattern established in feature 045.
- **Form state colocated with the dialog**: dialog components own the form instance and pass only the submit callback to parents. No "lifted form state" — it lives where it's rendered.

## Version Notes

Using `react-hook-form ^7.72.0` with `@hookform/resolvers ^5.x` and `zod ^3.25.76`. No v6 migration issues encountered.
