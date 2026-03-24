import PageHeader from '@/components/layout/PageHeader'
import ImportWizard from '@/components/import/ImportWizard'

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        title="Import Members"
        description="Upload a CSV or Excel file, or connect a Google Sheet to bulk-import members."
      />
      <ImportWizard />
    </div>
  )
}
