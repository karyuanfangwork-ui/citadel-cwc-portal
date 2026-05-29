// frontend/src/hooks/useCrmUpdate.ts
import { useEffect, useRef } from 'react';
import { useNotifications, CrmUpdateEvent } from '../context/NotificationContext';

type EntityType = CrmUpdateEvent['entityType'];

/**
 * Calls `callback` whenever an SSE crm_update event fires for one of the
 * specified entity types. Pass an empty array to listen to all entity types.
 *
 * The callback is stable-ref'd so callers can pass an inline function.
 */
export function useCrmUpdate(entityTypes: EntityType[], callback: (event: CrmUpdateEvent) => void) {
  const { lastCrmEvent } = useNotifications();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!lastCrmEvent) return;
    if (entityTypes.length === 0 || entityTypes.includes(lastCrmEvent.entityType)) {
      callbackRef.current(lastCrmEvent);
    }
  // entityTypes array identity doesn't matter — only lastCrmEvent changes drive this
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCrmEvent]);
}