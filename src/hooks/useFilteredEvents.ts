'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import type { PipelineEvent } from '@/lib/events/pipeline-schema';

interface UseFilteredEventsResult {
  filteredEvents: PipelineEvent[];
  currentPath: string;
}

const DEMO_PREFIXES = ['/demo/ecommerce', '/demo/subscription', '/demo/leadgen'];

function getRoutePrefix(path: string): string {
  for (const prefix of DEMO_PREFIXES) {
    if (path.startsWith(prefix)) return prefix;
  }
  return path;
}

export function useFilteredEvents(
  events: PipelineEvent[],
  filterByRoute: boolean = false,
): UseFilteredEventsResult {
  const currentPath = usePathname();

  const filteredEvents = useMemo(() => {
    if (!filterByRoute) return events;
    const prefix = getRoutePrefix(currentPath);
    return events.filter((event) => event.page_path.startsWith(prefix));
  }, [events, filterByRoute, currentPath]);

  return { filteredEvents, currentPath };
}
