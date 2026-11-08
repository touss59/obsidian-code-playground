import { SandpackLayout } from "@codesandbox/sandpack-react";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
} from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { ExpandableButton } from "CodePlaygroundBlock/ExpandableButton";
import { useCodeSaver, useRuntimeCodeSaver } from "CodePlaygroundBlock/useCodeSaver";
import { useFilesVisibilityOn } from "CodePlaygroundBlock/useFilesVisibilityOn";
import { usePreviewContentHeight } from "CodePlaygroundBlock/usePreviewContentHeight";
import type { PlaygroundRuntime } from "CodePlaygroundBlock/Runtime/PlaygroundRuntime";
import { RuntimeOutputPane } from "CodePlaygroundBlock/Runtime/RuntimeOutputPane";
import { useRuntimeRun, type RuntimeRun } from "CodePlaygroundBlock/Runtime/useRuntimeRun";
import {
	usePreviewLoadState,
	type PreviewLoadState,
} from "CodePlaygroundBlock/Sandpack/usePreviewLoadState";
import { SandpackEditorWrapper } from "CodePlaygroundBlock/Sandpack/SandpackEditorWrapper";
import { useEditorColumnResize } from "CodePlaygroundBlock/Sandpack/useEditorColumnResize";
import { usePanelHeightResize } from "CodePlaygroundBlock/Sandpack/usePanelHeightResize";
import { PreviewPane } from "CodePlaygroundBlock/Sandpack/PreviewPane";
import { ConsolePane } from "CodePlaygroundBlock/Sandpack/ConsolePane";
import { FullscreenModal } from "CodePlaygroundBlock/Sandpack/FullscreenModal";
import { useBlockSizes } from "CodePlaygroundBlock/Sandpack/useBlockSizes";

const HIDDEN: CSSProperties = { display: "none" };

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

/** A runtime block (e.g. Python): its shared worker runs the files. */
export function RuntimePlayground({ runtime }: { runtime: PlaygroundRuntime }) {
	const { value: global, setValue } = useAppContext();
	// No bundler has to load first: the files can save at once.
	useEffect(() => {
		if (!global.hasBeenCorrectlyLoaded) {
			setValue({ ...global, hasBeenCorrectlyLoaded: true });
		}
	}, [global, setValue]);
	useRuntimeCodeSaver();
	useFilesVisibilityOn(false);
	const { showPreview, showConsole } = global.config;
	const run = useRuntimeRun(runtime, showPreview || showConsole);

	return (
		<SandpackContent previewLoadState="loaded" isOnline={true} runtimeRun={run} />
	);
}

function SandpackContent({
	previewLoadState,
	isOnline,
	runtimeRun,
}: {
	previewLoadState: PreviewLoadState;
	isOnline: boolean;
	/** Set for runtime blocks: their output pane replaces the preview and console. */
	runtimeRun?: RuntimeRun;
}) {
	const { value: global } = useAppContext();
	const { showEditor, showPreview, showConsole: showConsoleButton } =
		global.config;
	const vertical = global.config.layout === "vertical";
	const hasPane = showPreview || showConsoleButton;
	const [outputHeight, setOutputHeight] = useState(0);

	const [showConsole, setShowConsole] = useState(
		!showPreview && showConsoleButton,
	);
	const [expanded, setExpanded] = useState(false);
	// Dragging takes over from "Show more": collapse so that hiding the
	// button (a dragged row has none) never leaves the block stuck expanded.
	const collapse = useCallback(() => setExpanded(false), []);

	const [fullscreen, setFullscreen] = useState(false);
	const closeFullscreen = useCallback(() => setFullscreen(false), []);
	// The modal opens a second preview. The block's console and height
	// read the messages of the block's preview only.
	const [inlineClientId, setInlineClientId] = useState<string>();

	const columnResize = useEditorColumnResize();
	const rowResize = usePanelHeightResize("rowHeight", collapse);
	const editorResize = usePanelHeightResize("editorHeight", collapse);
	const paneResize = usePanelHeightResize("paneHeight", collapse);
	const resizing =
		columnResize.dragging ||
		rowResize.dragging ||
		editorResize.dragging ||
		paneResize.dragging;

	const previewRef = useRef<HTMLDivElement>(null);
	const editorBoxRef = useRef<HTMLDivElement>(null);
	const previewHeight = usePreviewContentHeight(
		showPreview && !runtimeRun,
		previewRef,
		inlineClientId,
	);
	const sizes = useBlockSizes({
		expanded,
		manual: {
			row: rowResize.height,
			editor: editorResize.height,
			pane: paneResize.height,
		},
		editorBoxRef,
		contentHeight: runtimeRun ? outputHeight : previewHeight,
		contentVisible: runtimeRun ? true : showPreview && !showConsole,
	});
	const paneStyle: CSSProperties =
		sizes.paneHeight === undefined
			? { flex: "1" }
			: { flex: "none", width: "100%", height: sizes.paneHeight };
	const showColumnResizer = !vertical && hasPane;

	return (
		<>
			<SandpackLayout className={vertical ? "cp-layout-vertical" : undefined}>
				{showEditor && (
					<>
						<SandpackEditorWrapper
							boxRef={editorBoxRef}
							editorWidth={
								showColumnResizer ? columnResize.editorWidth : "auto"
							}
							sizes={sizes}
							vertical={vertical}
							onOpenFullscreen={() => setFullscreen(true)}
						/>
						{showColumnResizer && (
							<div
								className="cp-resizer"
								onPointerDown={columnResize.startResize}
							/>
						)}
						{vertical && <HeightHandle resize={editorResize} />}
					</>
				)}
				{runtimeRun ? (
					hasPane && (
						<RuntimeOutputPane
							run={runtimeRun}
							style={paneStyle}
							onContentHeight={setOutputHeight}
						/>
					)
				) : (
					<>
						{showPreview && (
							<PreviewPane
								containerRef={previewRef}
								onClientIdChange={setInlineClientId}
								style={showConsole ? HIDDEN : paneStyle}
								resizing={resizing}
								previewLoadState={previewLoadState}
								isOnline={isOnline}
								onShowConsole={
									showConsoleButton ? () => setShowConsole(true) : undefined
								}
							/>
						)}
						{showConsoleButton && (!showPreview || inlineClientId) && (
							<ConsolePane
								style={showConsole ? paneStyle : HIDDEN}
								clientId={inlineClientId}
								onShowPreview={
									showPreview ? () => setShowConsole(false) : undefined
								}
							/>
						)}
					</>
				)}
				{vertical && hasPane && <HeightHandle resize={paneResize} />}
			</SandpackLayout>
			{!vertical && <HeightHandle resize={rowResize} />}
			{sizes.showExpand && (
				<div className="cp-block-actions">
					<ExpandableButton expanded={expanded} setExpanded={setExpanded} />
				</div>
			)}
			<FullscreenModal
				open={fullscreen}
				onClose={closeFullscreen}
				previewLoadState={previewLoadState}
				isOnline={isOnline}
				runtimeRun={runtimeRun}
			/>
		</>
	);
}

/** Sets the height of the panel right above it. */
function HeightHandle({
	resize,
}: {
	resize: {
		startResize: (e: ReactPointerEvent<HTMLElement>) => void;
		reset: () => void;
	};
}) {
	return (
		<div
			className="cp-height-resizer"
			title="Drag to resize. Double-click to fit the content."
			onPointerDown={resize.startResize}
			onDoubleClick={resize.reset}
		/>
	);
}
