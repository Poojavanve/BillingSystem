import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, X } from 'lucide-react';
import { branchApi, brandApi, categoryApi } from '../../api/endpoints';
import type { SimpleMaster } from '../../api/endpoints';
import { queryClient } from '../../app/queryClient';
import { BranchMultiSelect } from '../../components/common/BranchMultiSelect';
import { Button } from '../../components/ui/Button';
import { useBranch } from '../../hooks/useBranch';
import { useCreateFlowNavigation } from '../../hooks/useCreateFlowNavigation';
import { hasSelectedId, hasTrimmedText } from '../../utils/validation';

interface Props { type: 'category' | 'brand'; mode: 'create' | 'edit' }
const inputClass = 'h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50';

const splitNames = (raw: string) => raw.split(',').map((part) => part.trim()).filter(Boolean);

export const MasterFormPage: React.FC<Props> = ({ type, mode }) => {
  const isCategory = type === 'category';
  const isBulkBrandCreate = type === 'brand' && mode === 'create';
  const api = isCategory ? categoryApi : brandApi;
  const label = isCategory ? 'Category' : 'Brand';
  const id = Number(useParams<{ id: string }>().id);
  const location = useLocation();
  const { returnFromCreate } = useCreateFlowNavigation(`/items/${isCategory ? 'categories' : 'brands'}`);
  const { selectedBranchIds } = useBranch();
  const state = location.state as SimpleMaster | undefined;
  const [name, setName] = useState(mode === 'edit' ? state?.name || '' : '');
  const [description, setDescription] = useState(mode === 'edit' ? state?.description || '' : '');
  const [categoryId, setCategoryId] = useState(mode === 'edit' ? state?.categoryId || 0 : 0);
  const [branchIds, setBranchIds] = useState<number[]>(
    mode === 'edit'
      ? state?.branchIds || selectedBranchIds
      : selectedBranchIds
  );
  const [brandNames, setBrandNames] = useState<string[]>([]);
  const [nameDraft, setNameDraft] = useState('');
  const categories = useQuery({
    queryKey: ['category', 'brand-form'],
    queryFn: () => categoryApi.getAll({ page: 0, size: 100, search: '' }),
    enabled: !isCategory,
  });
  const branches = useQuery({
    queryKey: ['my-branches', 'category-form'],
    queryFn: () => branchApi.getMine(),
    enabled: isCategory,
  });

  const addDraftNames = () => {
    const parts = splitNames(nameDraft);
    if (parts.length === 0) return;
    if (isBulkBrandCreate && !categoryId) {
      toast.error('Select a category before adding brand names.');
      setNameDraft('');
      return;
    }
    setBrandNames((current) => {
      const next = [...current];
      parts.forEach((part) => {
        if (next.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
          toast.error(`"${part}" is already added.`);
        } else {
          next.push(part);
        }
      });
      return next;
    });
    setNameDraft('');
  };

  const removeBrandName = (value: string) => setBrandNames((current) => current.filter((item) => item !== value));

  const mutation = useMutation({
    mutationFn: (namesOverride?: string[]) => {
      if (isBulkBrandCreate) {
        return brandApi.createBulk({ categoryId, names: namesOverride || brandNames, description });
      }
      const payload = isCategory ? { name, description, branchIds } : { name, description, categoryId };
      return mode === 'edit' ? api.update(id, payload) : api.create(payload);
    },
    onSuccess: async () => {
      toast.success(`${label} ${mode === 'edit' ? 'updated' : 'created'} successfully`);
      await queryClient.invalidateQueries({ queryKey: [type] });
      if (isCategory) {
        await queryClient.invalidateQueries({ queryKey: ['item-form-categories'] });
        await queryClient.invalidateQueries({ queryKey: ['item-list-categories'] });
        await queryClient.invalidateQueries({ queryKey: ['category', 'brand-form'] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['item-form-brands'] });
        await queryClient.invalidateQueries({ queryKey: ['item-list-brands'] });
      }
      returnFromCreate();
    },
    onError: (error: any) => toast.error(error?.message || `Failed to ${mode} ${label.toLowerCase()}`),
  });

  const submit = () => {
    if (isBulkBrandCreate) {
      if (!categoryId) return toast.error('Category is required.');
      const merged = [...brandNames, ...splitNames(nameDraft)];
      if (merged.length === 0) return toast.error('Enter at least one brand name.');
      const seen = new Set<string>();
      const duplicates = new Set<string>();
      const finalNames: string[] = [];
      merged.forEach((entry) => {
        const key = entry.toLowerCase();
        if (seen.has(key)) {
          duplicates.add(entry);
        } else {
          seen.add(key);
          finalNames.push(entry);
        }
      });
      if (duplicates.size > 0) return toast.error(`Duplicate brand name(s): ${Array.from(duplicates).join(', ')}`);
      setBrandNames(finalNames);
      setNameDraft('');
      mutation.mutate(finalNames);
      return;
    }
    if (!name.trim()) return toast.error(`${label} name is required.`);
    if (isCategory && branchIds.length === 0) return toast.error('Select at least one branch.');
    if (!isCategory && !categoryId) return toast.error('Category is required.');
    mutation.mutate(undefined);
  };
  const canSubmit = isBulkBrandCreate
    ? hasSelectedId(categoryId) && (brandNames.length > 0 || hasTrimmedText(nameDraft))
    : hasTrimmedText(name) && (isCategory ? branchIds.length > 0 : hasSelectedId(categoryId));

  return (
    <div className="space-y-5">
      <div className="text-sm text-gray-500">Home &gt; Item &gt; {label} List &gt; {mode === 'edit' ? `Edit ${label}` : `Create ${label}`}</div>
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4"><h1 className="text-xl font-semibold text-gray-900">{isCategory ? 'Item Category Details' : 'Brand Details'}</h1></div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 p-5 md:grid-cols-2 md:items-start">
          {!isCategory && (
            <div>
              <label className="text-sm text-gray-600">Category <span className="text-red-500">*</span></label>
              <select className={`${inputClass} mt-1`} value={categoryId} disabled={categories.isLoading} onChange={(event) => setCategoryId(Number(event.target.value))}>
                <option value={0}>{categories.isLoading ? 'Loading categories...' : 'Select category'}</option>
                {(categories.data?.data?.content || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              {isBulkBrandCreate && (
                <p className="mt-1 text-xs text-gray-400">Specifies the catalog namespace under which these brands reside.</p>
              )}
            </div>
          )}
          {isCategory && (
            <BranchMultiSelect
              branches={branches.data?.data || []}
              value={branchIds}
              onChange={setBranchIds}
              isLoading={branches.isLoading}
            />
          )}
          {isBulkBrandCreate ? (
            <div>
              <label className="text-sm text-gray-600">Brand Name(s) <span className="text-red-500">*</span></label>
              <div className="relative mt-1">
                <input
                  className={`${inputClass} w-full`}
                  value={nameDraft}
                  placeholder={categoryId ? 'e.g. Nike, Puma, Adidas' : 'Select a category first'}
                  disabled={!categoryId}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addDraftNames();
                    }
                  }}
                  onBlur={addDraftNames}
                />
                {categoryId > 0 && nameDraft.trim().length > 0 && (
                  <div className="absolute left-0 top-full z-10 mt-1.5 whitespace-nowrap rounded bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
                    <div className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-gray-900" />
                    Type names separated by commas, then press <span className="font-semibold">Enter</span> — e.g. Apple, Samsung
                  </div>
                )}
              </div>
              {brandNames.length > 0 && (
                <div className="mt-1 flex justify-end">
                  <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => setBrandNames([])}>Clear all</button>
                </div>
              )}
            </div>
          ) : (
            <label className="text-sm text-gray-600">Name <span className="text-red-500">*</span><input className={`${inputClass} mt-1`} value={name} onChange={(event) => setName(event.target.value)} /></label>
          )}
          {isBulkBrandCreate && brandNames.length > 0 && (
            <div className="flex flex-wrap gap-2.5 md:col-span-2">
              {brandNames.map((brandName) => (
                <span key={brandName} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 py-1.5 pl-4 pr-3 text-sm font-medium text-blue-700">
                  {brandName}
                  <button
                    type="button"
                    onClick={() => removeBrandName(brandName)}
                    aria-label={`Remove ${brandName}`}
                    className="rounded-full p-0.5 text-blue-400 transition-colors hover:bg-blue-200/60 hover:text-blue-700"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className={isBulkBrandCreate ? 'md:col-span-2' : ''}>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Description</label>
              {isBulkBrandCreate && <span className="text-xs text-gray-400">Optional &bull; {description.length}/250 characters</span>}
            </div>
            <textarea
              className="mt-1 h-20 w-full rounded border border-gray-300 bg-white p-3 text-sm text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              value={description}
              maxLength={isBulkBrandCreate ? 250 : undefined}
              placeholder={isBulkBrandCreate ? 'Add contextual details or notes about these brand assignments...' : undefined}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {isBulkBrandCreate ? (
            <div className="flex items-center justify-end gap-3 md:col-span-2">
              <Button variant="secondary" onClick={returnFromCreate}>Close</Button>
              <Button onClick={submit} isLoading={mutation.isPending} disabled={!canSubmit || mutation.isPending} rightIcon={<Check size={16} />}>Submit</Button>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              <span className="invisible block">Description</span>
              <div className="mt-1 flex h-16 items-center gap-3">
                <Button className="flex-1" onClick={submit} isLoading={mutation.isPending} disabled={!canSubmit || mutation.isPending}>Submit</Button>
                <Button className="flex-1" variant="secondary" onClick={returnFromCreate}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
