import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Button, Card, Badge, Modal, Input,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  SkeletonTable,
} from '@/components/ui';
import { usePermissions } from '@/lib/permissions';
import { useTenantId, tenantQueryKey } from '@/hooks/useTenantScope';

export interface StaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

interface AssignableRole {
  role: string;
  name: string;
  isBuiltin: boolean;
}

const emptyForm = {
  email: '',
  firstName: '',
  lastName: '',
  role: 'cashier',
  password: 'Admin123!',
};

interface StaffManagerProps {
  title?: string;
  description?: string;
  listPath: string;
  createPath?: string;
  updatePath: (id: string) => string;
  includeOwner?: boolean;
  assignableRoles?: AssignableRole[];
  queryKey: readonly (string | number | boolean)[];
}

export function StaffManager({
  title = 'Staff',
  description = 'Manage team members and their roles',
  listPath,
  createPath,
  updatePath,
  includeOwner = false,
  assignableRoles: assignableRolesProp,
  queryKey,
}: StaffManagerProps) {
  const tenantId = useTenantId();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManage = can('staff.manage');

  const assignableQueryKey = tenantQueryKey(tenantId, 'roles-assignable', includeOwner);

  const { data: assignableData } = useQuery({
    queryKey: assignableQueryKey,
    queryFn: () => api.get<{ roles: AssignableRole[] }>(
      `/roles/assignable?includeOwner=${includeOwner}`,
    ),
    enabled: Boolean(tenantId) && !assignableRolesProp,
  });

  const assignableRoles = assignableRolesProp ?? assignableData?.roles ?? [];
  const roleLabelMap = Object.fromEntries(assignableRoles.map((r) => [r.role, r.name]));

  const { data: staff = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => api.get<StaffMember[]>(listPath),
    enabled: Boolean(tenantId),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post(createPath || listPath, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setModalOpen(false);
      setForm({ ...emptyForm, role: assignableRoles[0]?.role ?? 'cashier' });
      toast.success('Staff member added');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(updatePath(id), { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Staff updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getRoleLabel = (role: string) => roleLabelMap[role] ?? role;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="text-slate-500 mt-1">{description}</p>
        </div>
        {canManage && (
          <Button onClick={() => { setForm({ ...emptyForm, role: assignableRoles[0]?.role ?? 'cashier' }); setModalOpen(true); }}>
            <Plus className="h-4 w-4" />
            Add staff
          </Button>
        )}
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="p-6"><SkeletonTable /></div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center">
            <UserCog className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No staff yet</p>
            <p className="text-sm text-slate-500 mt-1">Add cashiers, managers, and gate staff.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.firstName} {member.lastName}
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant="primary">{getRoleLabel(member.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.isActive ? 'success' : 'default'}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {member.lastLoginAt ? formatDate(member.lastLoginAt) : 'Never'}
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleMutation.mutate({ id: member.id, isActive: !member.isActive })}
                      >
                        {member.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add staff member">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
            <Input
              label="Last name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Role</label>
            <select
              className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {assignableRoles.map((role) => (
                <option key={role.role} value={role.role}>
                  {role.name}{!role.isBuiltin ? ' (custom)' : ''}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Temporary password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            hint="Share securely — staff should change after first login"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Add staff</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
