import { useCallback, useMemo } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import type { PlaygroundSidecar } from "storage/SidecarStore";

export type StorageField = keyof Omit<PlaygroundSidecar, "version">;

export function useStorage<K extends StorageField>(field: K) {
    const { value: global } = useAppContext();
    const { store, config } = global;
    const id = config.id;

    const getItem = useCallback(
        (): PlaygroundSidecar[K] | undefined => store.get(id)?.[field],
        [store, id, field],
    );

    const saveItem = useCallback(
        (value: PlaygroundSidecar[K]) => {
            store.patch(id, { [field]: value } as Partial<
                Omit<PlaygroundSidecar, "version">
            >);
        },
        [store, id, field],
    );

    return useMemo(() => ({ getItem, saveItem }), [getItem, saveItem]);
}
