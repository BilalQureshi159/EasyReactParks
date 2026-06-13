import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Modal, Input } from '@/components/ui';

export interface CreateParkForm {
  name: string;
  slug: string;
  description: string;
  type: string;
  timezone: string;
  customDomain: string;
  seedDefaults: boolean;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPassword: string;
}

const initialForm: CreateParkForm = {
  name: '',
  slug: '',
  description: '',
  type: 'waterpark',
  timezone: 'America/New_York',
  customDomain: '',
  seedDefaults: true,
  ownerEmail: '',
  ownerFirstName: '',
  ownerLastName: '',
  ownerPassword: 'Admin123!',
};

const steps = ['Park details', 'Owner account', 'Setup'];

interface CreateParkWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: CreateParkForm) => void;
  loading?: boolean;
}

export function CreateParkWizard({ open, onClose, onSubmit, loading }: CreateParkWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateParkForm>(initialForm);

  const slugify = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const reset = () => {
    setStep(0);
    setForm(initialForm);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canNext = () => {
    if (step === 0) return form.name && form.slug;
    if (step === 1) return form.ownerEmail && form.ownerFirstName && form.ownerLastName;
    return true;
  };

  return (
    <Modal open={open} onClose={handleClose} title="Onboard new park">
      <div className="flex items-center gap-2 mb-6">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <Input
            label="Park name"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => ({ ...f, name, slug: f.slug || slugify(name) }));
            }}
            required
          />
          <Input
            label="URL slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
            hint="Public booking: /book/your-slug"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Input
            label="Custom domain (optional)"
            placeholder="tickets.yourpark.com"
            value={form.customDomain}
            onChange={(e) => setForm({ ...form, customDomain: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Park type</label>
              <select
                className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="waterpark">Waterpark</option>
                <option value="amusement_park">Amusement Park</option>
              </select>
            </div>
            <Input
              label="Timezone"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Creates the park owner account. They can sign in directly or you can use Login as admin.</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First name"
              value={form.ownerFirstName}
              onChange={(e) => setForm({ ...form, ownerFirstName: e.target.value })}
              required
            />
            <Input
              label="Last name"
              value={form.ownerLastName}
              onChange={(e) => setForm({ ...form, ownerLastName: e.target.value })}
              required
            />
          </div>
          <Input
            label="Owner email"
            type="email"
            value={form.ownerEmail}
            onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
            required
          />
          <Input
            label="Temporary password"
            value={form.ownerPassword}
            onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Seed starter catalog so the park is ready to sell on day one.</p>
          <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={form.seedDefaults}
              onChange={(e) => setForm({ ...form, seedDefaults: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <div>
              <p className="font-medium text-slate-900">Add default ticket types & memberships</p>
              <p className="text-sm text-slate-500 mt-1">
                Waterpark: Adult, Child, Senior, Family passes. Amusement: General admission bundles. Plus season passes and a welcome coupon.
              </p>
            </div>
          </label>
          <div className="p-4 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-800">
            <p className="font-medium">{form.name || 'New park'}</p>
            <p className="mt-1 opacity-90">/{form.slug || 'slug'} · Owner: {form.ownerEmail || '—'}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-slate-100">
        <Button
          type="button"
          variant="secondary"
          onClick={() => (step === 0 ? handleClose() : setStep(step - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" disabled={!canNext()} onClick={() => setStep(step + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            loading={loading}
            onClick={() => onSubmit(form)}
          >
            Create park
          </Button>
        )}
      </div>
    </Modal>
  );
}
