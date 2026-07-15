import type { App } from "obsidian";
import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ResolvedCodePlaygroundConfig } from "config";
import type { SidecarStore } from "storage/SidecarStore";

type AppContext = {
    config: ResolvedCodePlaygroundConfig;
    ObsidianApp: App;
    hasBeenCorrectlyLoaded: boolean;
    store: SidecarStore;
};

type AppContextType = {
    value: AppContext;
    setValue: (value: AppContext) => void;
}

const AppReactContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
    const context = useContext(AppReactContext);

    if(!context) {
        throw new Error("useAppContext must be used within an AppContextProvider");
    }
    return context;
}

export function AppContextProvider({children, value}: {children: React.ReactNode, value: AppContext}) {

    const [contextValue, setContextValue] = useState(value);

    useEffect(() => {
        // A new `value` identity means the plugin re-rendered the block with
        // a new merged config (e.g. a settings change) — the Sandpack
        // instance underneath stays mounted, so it will NOT emit another
        // "done" message. Keep the loaded flag once set, otherwise every
        // save path (gated on hasBeenCorrectlyLoaded) stays silently
        // disabled forever.
        setContextValue((prev) => ({
            ...value,
            hasBeenCorrectlyLoaded:
                prev.hasBeenCorrectlyLoaded || value.hasBeenCorrectlyLoaded,
        }));
    }, [value]);

    const providerValue = useMemo(
        () => ({ value: contextValue, setValue: setContextValue }),
        [contextValue],
    );

    return (
        <AppReactContext.Provider value={providerValue}>
            {children}
        </AppReactContext.Provider>
    );
}
