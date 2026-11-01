import { requireCtx } from '@/lib/session';
import { ImportWizard } from '@/components/ImportWizard';
export const metadata = { title: 'Import invoices' };
export default async function ImportPage() {
  await requireCtx();
  return <><div className="page-head"><div><h1>Import invoices</h1><p>Bring in unpaid invoices from a spreadsheet. Importing the same file twice never creates duplicates.</p></div></div><ImportWizard /></>;
}
