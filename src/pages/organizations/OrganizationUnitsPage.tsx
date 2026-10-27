import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { organizationApi, unitApi } from '../../api/endpoints';
import type { Organization, OrganizationUnit, Unit } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { Button } from '../../components/ui/Button';
import { Loader } from '../../components/ui/Loader';
import { getOrganizationId } from './organization.utils';
import { PERMISSIONS } from '../../auth/permissions';
import { useAuth } from '../../hooks/useAuth';

const unitLabel = (unit: Unit) => `${unit.name}${unit.shortName ? ` (${unit.shortName})` : ''}`;

export const OrganizationUnitsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission(PERMISSIONS.ORGANIZATION_UPDATE);
  const id = Number(useParams<{ id: string }>().id);
  const state = location.state as Organization | undefined;
  const initializedRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');

  const organizationQuery = useQuery({
    queryKey: ['organization-units', id],
    queryFn: () => organizationApi.getById(id),
    enabled: Number.isFinite(id) && id > 0 && !state,
  });

  const assignedUnitsQuery = useQuery({
    queryKey: ['organization-assigned-units', id],
    queryFn: () => organizationApi.getUnits(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const unitsQuery = useQuery({
    queryKey: ['organization-unit-options'],
    queryFn: () => unitApi.getAll({ page: 0, size: 500, search: '' }),
  });

  const organization = useMemo(() => {
    if (state && getOrganizationId(state) === id) return state;
    return organizationQuery.data?.data || state;
  }, [id, organizationQuery.data?.data, state]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    const assigned = assignedUnitsQuery.data?.data || [];
    if (assignedUnitsQuery.isSuccess) {
      setSelectedIds(assigned.map((unit: OrganizationUnit) => unit.id));
      initializedRef.current = true;
    }
  }, [assignedUnitsQuery.data, assignedUnitsQuery.isSuccess]);

  const allUnits = unitsQuery.data?.data?.content || [];
  const filteredUnits = allUnits.filter((unit) => {
    if (!search.trim()) return true;
    const pattern = search.trim().toLowerCase();
    return unit.name.toLowerCase().includes(pattern) || unit.shortName?.toLowerCase().includes(pattern);
  });

  const mutation = useMutation({
    mutationFn: () => organizationApi.assignUnits(id, { unitIds: selectedIds }),
    onSuccess: async () => {
      toast.success('Organization units updated successfully');
      await queryClient.invalidateQueries({ queryKey: ['organization-assigned-units', id] });
      await queryClient.invalidateQueries({ queryKey: ['organization-units', id] });
      await queryClient.invalidateQueries({ queryKey: ['units'] });
      navigate(`/organizations/${id}`, { state: organization });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update organization units'),
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <p className="text-sm text-gray-600">Organization id is missing.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate('/organizations')}>Close</Button>
      </div>
    );
  }

  if ((organizationQuery.isLoading && !state) || unitsQuery.isLoading || assignedUnitsQuery.isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader size="lg" /></div>;
  }

  const toggleUnit = (unitId: number) => {
    setSelectedIds((current) => current.includes(unitId) ? current.filter((idValue) => idValue !== unitId) : [...current, unitId]);
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Organization &gt; Organization List &gt; Assign Units</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Assign Units</h1>
          <p className="mt-1 text-sm text-gray-500">{organization?.name || 'Selected organization'}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            Search:
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 rounded border border-gray-300 px-3"
              placeholder="Search units..."
            />
          </label>
          <div className="text-sm text-gray-500">
            {selectedIds.length} selected of {allUnits.length}
          </div>
        </div>

        <div className="p-5">
          {filteredUnits.length === 0 ? (
            <div className="rounded border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
              No units available
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredUnits.map((unit) => {
                const checked = selectedIds.includes(unit.id);
                return (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => toggleUnit(unit.id)}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                      checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-gray-900">{unitLabel(unit)}</div>
                      <div className="text-xs text-gray-500">Unit ID: {unit.id}</div>
                    </div>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${checked ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-300 text-transparent'}`}>
                      <Check size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t p-5">
          <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending} disabled={!canUpdate}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/organizations/${id}`, { state: organization })}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
