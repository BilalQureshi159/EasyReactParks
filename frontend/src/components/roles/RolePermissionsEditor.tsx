import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw, Save, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button, Card, Badge, Modal, Input } from '@/components/ui';

export interface RoleDefinition {
  role: string;
  name: string;
  description?: string | null;
  isBuiltin: boolean;
  permissions: string[];
  isCustomized: boolean;
}

interface RolePermissionsEditorProps {
  roles: RoleDefinition[];
  groups: Record<string, { key: string; label: string }[]>;
  updatePath: (role: string) => string;
  resetPath: (role: string) => string;
  queryKey: readonly (string | number | boolean)[];
  readOnly?: boolean;
  canManage?: boolean;
}

const LOCKED_FOR_OWNER = ['roles.view', 'roles.manage', 'staff.manage'];

export function RolePermissionsEditor({
  roles,
  groups,
  updatePath,
  resetPath,
  queryKey,
  readOnly = false,
  canManage = !readOnly,
}: RolePermissionsEditorProps) {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState(roles[0]?.role || 'manager');
  const [draft, setDraft] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });

  const current = roles.find((r) => r.role === selectedRole);
  const roleLabel = current?.name ?? selectedRole;

  useEffect(() => {
    if (roles.length === 0) return;
    if (!roles.some((r) => r.role === selectedRole)) {
      setSelectedRole(roles[0].role);
    }
  }, [roles, selectedRole]);

  useEffect(() => {
    const def = roles.find((r) => r.role === selectedRole);
    setDraft(def?.permissions ?? []);
    setDirty(false);
  }, [selectedRole, roles]);

  const saveMutation = useMutation({
    mutationFn: () => api.put(updatePath(selectedRole), { permissions: draft }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDirty(false);
      toast.success(`${roleLabel} permissions saved`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: () => api.post(resetPath(selectedRole)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Role reset to defaults');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<{ role: string; name: string }>('/roles/custom', {
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      permissions: [],
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      setCreateOpen(false);
      setCreateForm({ name: '', description: '' });
      setSelectedRole(data.role);
      toast.success(`Role "${data.name}" created`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (slug: string) => api.delete(`/roles/custom/${slug}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Custom role deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggle = (perm: string) => {
    if (readOnly) return;
    if (selectedRole === 'park_owner' && LOCKED_FOR_OWNER.includes(perm)) return;
    setDraft((prev) => {
      const next = prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm];
      setDirty(true);
      return next;
    });
  };

  if (roles.length === 0) {
    return (
      <Card className="text-center py-12">
        <p className="text-slate-500">No roles configured.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {roles.map((r) => (
          <button
            key={r.role}
            type="button"
            onClick={() => setSelectedRole(r.role)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              selectedRole === r.role
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {r.name}
            {!r.isBuiltin && (
              <span className="ml-2 text-[10px] uppercase text-violet-600">custom</span>
            )}
            {r.isBuiltin && r.isCustomized && (
              <span className="ml-2 text-[10px] uppercase text-amber-600">edited</span>
            )}
          </button>
        ))}
        {canManage && (
          <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New role
          </Button>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-brand-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 truncate">{roleLabel} permissions</h3>
              <p className="text-sm text-slate-500">{draft.length} permissions enabled</p>
              {current?.description && (
                <p className="text-xs text-slate-400 mt-0.5">{current.description}</p>
              )}
            </div>
          </div>
          {!readOnly && (
            <div className="flex gap-2 shrink-0">
              {current && !current.isBuiltin && canManage && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => deleteMutation.mutate(selectedRole)}
                  loading={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
              {current?.isBuiltin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => resetMutation.mutate()}
                  loading={resetMutation.isPending}
                  disabled={!current?.isCustomized}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset defaults
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                loading={saveMutation.isPending}
                disabled={!dirty}
              >
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {Object.entries(groups).map(([group, perms]) => (
            <div key={group}>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">{group}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {perms.map((perm) => {
                  const enabled = draft.includes(perm.key);
                  const locked = selectedRole === 'park_owner' && LOCKED_FOR_OWNER.includes(perm.key);
                  return (
                    <label
                      key={perm.key}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        enabled ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200 hover:bg-slate-50'
                      } ${locked || readOnly ? 'opacity-70 cursor-default' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={locked || readOnly}
                        onChange={() => toggle(perm.key)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">{perm.label}</p>
                        <p className="text-xs text-slate-400 font-mono">{perm.key}</p>
                      </div>
                      {locked && <Badge variant="warning">Locked</Badge>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create custom role">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!createForm.name.trim()) {
              toast.error('Role name is required');
              return;
            }
            createMutation.mutate();
          }}
        >
          <Input
            label="Role name"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder="e.g. VIP Host, Sales Lead"
            required
          />
          <Input
            label="Description"
            value={createForm.description}
            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            placeholder="Optional — what this role is for"
          />
          <p className="text-xs text-slate-500">
            You can set permissions after creating the role. Staff can be assigned to it from the Staff page.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create role</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
