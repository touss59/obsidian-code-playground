import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
    window.addEventListener("online", onStoreChange);
    window.addEventListener("offline", onStoreChange);
    return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
    };
}

function getSnapshot() {
    return navigator.onLine;
}

/** Live network status from the browser's online/offline events. */
export function useIsOnline() {
    return useSyncExternalStore(subscribe, getSnapshot);
}
