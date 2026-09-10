'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createBrowserEngagement, EMPTY_ENGAGEMENT, type EngagementMode } from '@/lib/engagement';

type Controller = ReturnType<typeof createBrowserEngagement>;
let shared: Controller | undefined;
function getController() {
  if (typeof window === 'undefined') return undefined;
  return shared ??= createBrowserEngagement();
}
const serverSnapshot = () => EMPTY_ENGAGEMENT;
const noopSubscribe = () => () => {};

export function useEngagement(mode: EngagementMode) {
  const controller = getController();
  const mount = useRef<ReturnType<Controller['mount']> | null>(null);
  const latestMode = useRef(mode);
  useEffect(() => { latestMode.current = mode; }, [mode]);
  const engagement = useSyncExternalStore(controller?.subscribe ?? noopSubscribe,
    controller?.getSnapshot ?? serverSnapshot, serverSnapshot);
  useEffect(() => {
    if (!controller) return;
    mount.current = controller.mount(latestMode.current);
    return () => { mount.current?.dispose(); mount.current = null; };
  }, [controller]);
  useEffect(() => { mount.current?.setMode(mode); }, [mode]);
  return { engagement, finish: (status: 'dismissed' | 'submitted') => controller?.finish(status) };
}
