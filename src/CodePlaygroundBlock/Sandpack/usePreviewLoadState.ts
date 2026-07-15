import { useEffect, useRef, useState } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { useIsOnline } from "CodePlaygroundBlock/useIsOnline";
import { useSandpack } from "@codesandbox/sandpack-react";
import { APP_LOAD_TIMEOUT_MS } from "appConstants";

export type PreviewLoadState = "loading" | "loaded" | "timedOut";

/**
 * Tracks whether the Sandpack bundler actually loaded (its "done" message
 * arrived) and exposes the outcome so the preview pane can show an explicit
 * "needs a network connection" state instead of failing silently.
 *
 * With initMode "user-visible", offscreen blocks never start bundling
 * (status stays "initial"/"idle"), so the load timer judges a bundling
 * ATTEMPT, not the mount: it arms when the provider transitions into
 * "running" and disarms when the attempt is torn down.
 *
 * The 3s timeout still force-sets `hasBeenCorrectlyLoaded` in the app
 * context — every save path is gated on that flag, so it must become true
 * even when the CDN-hosted bundler is unreachable (offline editing).
 */
export function usePreviewLoadState() {
    const { listen, sandpack } = useSandpack();
    const { value: global, setValue } = useAppContext();
    const isOnline = useIsOnline();

    const [previewLoadState, setPreviewLoadState] = useState<PreviewLoadState>(
        () => (global.hasBeenCorrectlyLoaded ? "loaded" : "loading"),
    );

    const globalRef = useRef(global);
    globalRef.current = global;
    const sandpackRef = useRef(sandpack);
    sandpackRef.current = sandpack;
    const loadStateRef = useRef(previewLoadState);
    loadStateRef.current = previewLoadState;
    const timerRef = useRef<number | undefined>(undefined);

    const armLoadTimer = () =>
        window.setTimeout(() => {
            const g = globalRef.current;
            if (!g.hasBeenCorrectlyLoaded) {
                setValue({ ...g, hasBeenCorrectlyLoaded: true });
            }
            setPreviewLoadState((prev) => (prev === "loaded" ? prev : "timedOut"));
        }, APP_LOAD_TIMEOUT_MS);

    useEffect(() => {
        if (globalRef.current.hasBeenCorrectlyLoaded) return;

        // Stays subscribed after the timeout: a late "done" (slow
        // connection, reconnect retry) must clear the timedOut state.
        const unsubscribe = listen((message) => {
            if (message.type === "done") {
                clearTimeout(timerRef.current);
                setValue({ ...globalRef.current, hasBeenCorrectlyLoaded: true });
                setPreviewLoadState("loaded");
                unsubscribe();
            }
        });

        return () => {
            unsubscribe();
            clearTimeout(timerRef.current);
        };
    }, []);

    // Arm the timer only when bundling actually starts ("running" covers
    // first visibility, scroll-back-in, and DOM reattach), and disarm it
    // when the attempt is torn down ("idle" on scroll-out/detach) so an
    // offscreen block is never flagged as timedOut.
    const prevStatusRef = useRef<typeof sandpack.status | undefined>(undefined);
    useEffect(() => {
        const prevStatus = prevStatusRef.current;
        prevStatusRef.current = sandpack.status;
        if (sandpack.status === prevStatus) return;

        if (sandpack.status === "running") {
            if (loadStateRef.current === "loaded") return;
            // A fresh attempt supersedes a previous timeout verdict:
            // without this, scrolling back to a once-timed-out block
            // would flash the banner over a load that is in progress.
            setPreviewLoadState("loading");
            clearTimeout(timerRef.current);
            timerRef.current = armLoadTimer();
        } else if (prevStatus === "running") {
            clearTimeout(timerRef.current);
        }
    }, [sandpack.status]);

    const prevOnlineRef = useRef(isOnline);
    useEffect(() => {
        const wasOnline = prevOnlineRef.current;
        prevOnlineRef.current = isOnline;
        if (wasOnline || !isOnline || loadStateRef.current === "loaded") return;

        // Only retry attempts that actually started while visible:
        // "running" (clients live, CDN load failed silently) or "timeout"
        // (Sandpack's own bundler timeout destroyed them — no observer
        // event will ever fire again for it). For "initial"/"idle" the
        // block is offscreen; the intersection observer calls runSandpack
        // itself on re-entry and the status watcher arms the timer then.
        const status = sandpackRef.current.status;
        if (status !== "running" && status !== "timeout") return;

        // Back online with the preview never loaded: Sandpack does not
        // retry the CDN load by itself, runSandpack() re-creates the
        // clients from the registered iframes (same call as its own
        // "Try again" button).
        setPreviewLoadState("loading");
        clearTimeout(timerRef.current);
        timerRef.current = armLoadTimer();
        void sandpackRef.current.runSandpack();
    }, [isOnline]);

    return { previewLoadState, isOnline };
}
