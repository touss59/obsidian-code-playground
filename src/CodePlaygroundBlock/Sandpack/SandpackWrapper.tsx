import {
	SandpackLayout,
	SandpackPreview,
	SandpackConsole,
} from "@codesandbox/sandpack-react";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type RefObject,
} from "react";
import { useStorage } from "CodePlaygroundBlock/useStorage";
import { useThrottle } from "CodePlaygroundBlock/useThrottle";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { useCodeSaver } from "CodePlaygroundBlock/useCodeSaver";
import { useFilesVisibilityOn } from "CodePlaygroundBlock/useFilesVisibilityOn";
import {
	usePreviewLoadState,
	type PreviewLoadState,
} from "CodePlaygroundBlock/Sandpack/usePreviewLoadState";
import { PreviewUnavailableBanner } from "CodePlaygroundBlock/Sandpack/PreviewUnavailableBanner";
import { SandpackEditorWrapper } from "CodePlaygroundBlock/Sandpack/SandpackEditorWrapper";
import { ManageFilesModal } from "CodePlaygroundBlock/ManageFilesModal";
import { ExpandableButton } from "CodePlaygroundBlock/ExpandableButton";
import { RESIZER_THROTTLE_MS } from "appConstants";

export function SandpackWrapper() {
	useCodeSaver();
	useFilesVisibilityOn();
	const { previewLoadState, isOnline } = usePreviewLoadState();

	return (
		<SandpackContent
			previewLoadState={previewLoadState}
			isOnline={isOnline}
		/>
	);
}

function SandpackContent({
	previewLoadState,
	isOnline,
}: {
	previewLoadState: PreviewLoadState;
	isOnline: boolean;
}) {
	const { value: global } = useAppContext();
	const {
		showEditor,
		showPreview,
		showConsole: showConsoleButton,
		showOpenInCodeSandbox,
	} = global.config;

	const [showConsole, setShowConsole] = useState(
		!showPreview && showConsoleButton,
	);
	const [showManage, setShowManage] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const { getItem } = useStorage("editorWidth");
	const [editorWidthInPX, setEditorWidth] = useState(getItem() ?? -1);
	const [splitterSelected, setSplitterSelected] = useState(false);
	const stopResize = useCallback(() => setSplitterSelected(false), []);
	const resizerRef = useRef<HTMLDivElement | null>(null);
	useLeftColumnResizer(
		splitterSelected,
		stopResize,
		setEditorWidth,
		resizerRef,
	);

	const overlayZindex = splitterSelected ? 100 : -1;

	const hasRightPane = showPreview || showConsoleButton;
	const effectiveEditorWidth = hasRightPane ? editorWidthInPX : -1;

	const previewUnavailable =
		previewLoadState !== "loaded" &&
		(!isOnline || previewLoadState === "timedOut");

	return (
		<>
			<SandpackLayout>
				{showEditor && (
					<>
						<SandpackEditorWrapper
							editorWidthInPX={effectiveEditorWidth}
							previewVisible={showPreview && !showConsole}
							expanded={expanded}
							onManageFiles={() => setShowManage(true)}
						/>
						{hasRightPane && (
							<div
								ref={resizerRef}
								className="cp-resizer"
								onPointerDown={(e) => {
									// Capture the pointer so the drag keeps
									// tracking even when it moves over the
									// preview iframe or off the thin handle.
									e.currentTarget.setPointerCapture(
										e.pointerId,
									);
									setSplitterSelected(true);
								}}
							/>
						)}
					</>
				)}

				{showPreview && (
					<div
						style={
							showConsole ? { display: "none" } : { flex: "1" }
						}
					>
						<div
							className="cp-preview-overlay"
							style={{ zIndex: `${overlayZindex}` }}
						></div>
						<div className="cp-preview-pane">
							{previewUnavailable && (
								<PreviewUnavailableBanner isOnline={isOnline} />
							)}
							<SandpackPreview
								showOpenInCodeSandbox={showOpenInCodeSandbox}
								className="cp-preview-content"
								actionsChildren={
									<div className="cp-actions-row">
										<ExpandableButton
											expanded={expanded}
											setExpanded={setExpanded}
										/>
										{showConsoleButton && (
											<button
												onClick={() =>
													setShowConsole(true)
												}
											>
												Show console
											</button>
										)}
									</div>
								}
							/>
						</div>
					</div>
				)}
				{showConsoleButton && (
					<SandpackConsole
						style={
							showConsole ? { flex: "1" } : { display: "none" }
						}
						actionsChildren={
							<div style={{ display: "flex", gap: "5px" }}>
								<ExpandableButton
									expanded={expanded}
									setExpanded={setExpanded}
								/>
								{showPreview && (
									<button
										onClick={() => setShowConsole(false)}
									>
										Show preview
									</button>
								)}
							</div>
						}
					/>
				)}
			</SandpackLayout>
			<ManageFilesModal
				open={showManage}
				onClose={() => setShowManage(false)}
			/>
		</>
	);
}

function useLeftColumnResizer(
	canBeResized: boolean,
	stopResize: () => unknown,
	setEditorWidth: (newWidth: number) => unknown,
	resizerRef: RefObject<HTMLDivElement | null>,
) {
	const throttledSetEditorWidth = useThrottle(setEditorWidth, RESIZER_THROTTLE_MS); // ~60fps

	// Ref mirrors so the listener effect only re-runs when a drag starts or
	// ends, not on every render.
	const throttledRef = useRef(throttledSetEditorWidth);
	throttledRef.current = throttledSetEditorWidth;
	const stopResizeRef = useRef(stopResize);
	stopResizeRef.current = stopResize;

	useEffect(() => {
		if (!canBeResized) return;

		const onPointerUp = () => {
			stopResizeRef.current();
		};

		const onPointerMove = (e: PointerEvent) => {
			// Ignore secondary pointers (a second finger) mid-drag.
			if (!e.isPrimary) return;
			const resizer = resizerRef.current;
			if (!resizer?.parentElement) return;
			const containerRect = resizer.parentElement.getBoundingClientRect();
			const newLeftWidth = e.clientX - containerRect.left;
			if (newLeftWidth < 0) return;
			throttledRef.current(newLeftWidth);
		};

		// Pointer events unify mouse/touch/pen; combined with setPointerCapture
		// on the handle (see onPointerDown) the drag keeps tracking over the
		// preview iframe. Captured events still bubble to window.
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);

		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		};
	}, [canBeResized]);
}
