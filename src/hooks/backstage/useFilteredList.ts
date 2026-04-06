"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ActiveFilter, FilterDef } from "@/components/backstage/FilterChipBar";
import type { QuickViewTab } from "@/components/backstage/QuickViewTabs";

export interface TabPreset {
  tab: QuickViewTab;
  params: Record<string, string>;
}

interface UseFilteredListConfig<T> {
  tabPresets: TabPreset[];
  filterDefs: FilterDef[];
  urlPath: string;
  /** Keys used for search fields, e.g. ["title"] or ["name", "gameTitle"] */
  searchParamKeys: string[];
  /** Called with the final URLSearchParams — return fetched items */
  fetchFn: (params: URLSearchParams) => Promise<T[]>;
  /**
   * One-time overrides applied on mount only (e.g. ?game=<id>).
   * These are added to the API params but NOT synced to the URL.
   */
  initialOverrides?: Record<string, string>;
}

interface UseFilteredListReturn<T> {
  searchValues: Record<string, string>;
  handleSearchChange: (key: string, value: string) => void;
  activeTab: string;
  handleTabChange: (tab: string) => void;
  activeFilters: ActiveFilter[];
  effectiveFilters: ActiveFilter[];
  handleFilterChange: (key: string, value: string) => void;
  resetFilters: () => void;
  items: T[];
  isLoading: boolean;
  hasSearched: boolean;
  fetchError: string | null;
  error: string | null;
  refetch: () => Promise<void>;
}

function deriveTabFromParams(
  sp: URLSearchParams,
  tabPresets: TabPreset[],
  filterDefs: FilterDef[],
): string {
  const filterKeys = new Set(filterDefs.map((d) => d.key));
  const urlFilterKeys = [...sp.keys()].filter((k) => filterKeys.has(k));

  for (const preset of tabPresets) {
    if (preset.tab.value === "all") continue;
    const presetKeys = Object.keys(preset.params);
    if (presetKeys.length !== urlFilterKeys.length) continue;
    const matches =
      presetKeys.every((k) => sp.get(k) === preset.params[k]) &&
      urlFilterKeys.every((k) => k in preset.params);
    if (matches) return preset.tab.value;
  }
  return "all";
}

function deriveFiltersFromParams(
  sp: URLSearchParams,
  tabPresets: TabPreset[],
  filterDefs: FilterDef[],
): ActiveFilter[] {
  const tab = deriveTabFromParams(sp, tabPresets, filterDefs);
  if (tab !== "all") return [];

  const filters: ActiveFilter[] = [];
  for (const def of filterDefs) {
    const val = sp.get(def.key);
    if (val && def.options.some((o) => o.value === val)) {
      filters.push({ key: def.key, value: val });
    }
  }
  return filters;
}

function buildParams(
  searchValues: Record<string, string>,
  tab: string,
  filters: ActiveFilter[],
  tabPresets: TabPreset[],
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchValues)) {
    if (value.trim()) params.set(key, value.trim());
  }

  const preset = tabPresets.find((p) => p.tab.value === tab);
  if (preset) {
    for (const [k, v] of Object.entries(preset.params)) {
      params.set(k, v);
    }
  }

  for (const f of filters) {
    params.set(f.key, f.value);
  }

  return params;
}

export function useFilteredList<T>(config: UseFilteredListConfig<T>): UseFilteredListReturn<T> {
  const { tabPresets, filterDefs, urlPath, searchParamKeys, fetchFn, initialOverrides } = config;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValues, setSearchValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const key of searchParamKeys) {
      initial[key] = searchParams.get(key) ?? "";
    }
    return initial;
  });

  const [activeTab, setActiveTab] = useState(() =>
    deriveTabFromParams(searchParams, tabPresets, filterDefs),
  );
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() =>
    deriveFiltersFromParams(searchParams, tabPresets, filterDefs),
  );

  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usedInitialOverrides = useRef(false);

  const doFetch = useCallback(
    async (overrides?: {
      searchValues?: Record<string, string>;
      tab?: string;
      filters?: ActiveFilter[];
      skipUrlSync?: boolean;
    }) => {
      const sv = overrides?.searchValues ?? searchValues;
      const t = overrides?.tab ?? activeTab;
      const f = overrides?.filters ?? activeFilters;

      setIsLoading(true);
      setFetchError(null);

      const params = buildParams(sv, t, f, tabPresets);

      // Apply one-time initial overrides on first fetch
      if (initialOverrides && !usedInitialOverrides.current) {
        usedInitialOverrides.current = true;
        for (const [k, v] of Object.entries(initialOverrides)) {
          params.set(k, v);
        }
      }

      // Sync URL (without initial overrides)
      if (!overrides?.skipUrlSync) {
        const urlParams = buildParams(sv, t, f, tabPresets);
        router.replace(`${urlPath}${urlParams.size ? `?${urlParams}` : ""}`, { scroll: false });
      }

      try {
        const data = await fetchFn(params);
        setItems(data);
        setHasSearched(true);
      } catch (err) {
        console.error(`[useFilteredList] fetch failed:`, err);
        setFetchError("Failed to load data. Try again.");
        setHasSearched(true);
      } finally {
        setIsLoading(false);
      }
    },
    [
      searchValues,
      activeTab,
      activeFilters,
      tabPresets,
      urlPath,
      fetchFn,
      initialOverrides,
      router,
    ],
  );

  // Mount-only: doFetch captures filter/search state that changes after mount.
  // Including deps would cause unwanted refetches on every state transition.
  useEffect(() => {
    Promise.resolve().then(() => doFetch(initialOverrides ? { skipUrlSync: true } : undefined));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchChange(key: string, value: string) {
    const next = { ...searchValues, [key]: value };
    setSearchValues(next);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doFetch({ searchValues: next });
    }, 300);
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    setActiveFilters([]);
    doFetch({ tab, filters: [] });
  }

  function handleFilterChange(key: string, value: string) {
    let next: ActiveFilter[];
    if (value === "") {
      next = activeFilters.filter((f) => f.key !== key);
    } else {
      const existing = activeFilters.find((f) => f.key === key);
      if (existing) {
        next = activeFilters.map((f) => (f.key === key ? { ...f, value } : f));
      } else {
        next = [...activeFilters, { key, value }];
      }
    }
    setActiveFilters(next);
    setActiveTab("all");
    doFetch({ tab: "all", filters: next });
  }

  function resetFilters() {
    setActiveFilters([]);
    setActiveTab("all");
    doFetch({ tab: "all", filters: [] });
  }

  const effectiveFilters: ActiveFilter[] = (() => {
    const preset = tabPresets.find((p) => p.tab.value === activeTab);
    const merged = new Map(activeFilters.map((f) => [f.key, f.value]));
    if (preset) {
      for (const [k, v] of Object.entries(preset.params)) {
        if (!merged.has(k)) merged.set(k, v);
      }
    }
    return [...merged.entries()].map(([key, value]) => ({ key, value }));
  })();

  return {
    searchValues,
    handleSearchChange,
    activeTab,
    handleTabChange,
    activeFilters,
    effectiveFilters,
    handleFilterChange,
    resetFilters,
    items,
    isLoading,
    hasSearched,
    fetchError,
    error: fetchError,
    refetch: () => doFetch(),
  };
}
