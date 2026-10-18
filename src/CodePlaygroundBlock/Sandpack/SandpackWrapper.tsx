import { SandpackLayout } from "@codesandbox/sandpack-react";
import {
	useCallback,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
} from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { ExpandableButton } from "CodePlaygroundBlock/ExpandableButton";
import { useCodeSaver } from "CodePlaygroundBlock/useCodeSaver";
import { useFilesVisibilityOn } from "CodePlaygroundBlock/useFilesVisibilityOn";
import {
	usePreviewLoadState,
	type PreviewLoadState,
} from "CodePlaygroundBlock/Sandpack/usePreviewLoadState";
import { SandpackEditorWrapper } from "CodePlaygroundBlock/Sandpack/SandpackEditorWrapper";
import { useEditorColumnResize } from "CodePlaygroundBlock/Sandpack/useEditorColumnResize";
import { usePanelHeightResize } from "CodePlaygroundBlock/Sandpack/usePanelHeightResize";
import { PreviewPane } from "CodePlaygroundBlock/Sandpack/PreviewPane";
import { ConsolePane } from "CodePlaygroundBlock/Sandpack/ConsolePane";
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

function SandpackContent({
	previewLoadState,
	isOnline,
}: {
	previewLoadState: PreviewLoadState;
	isOnline: boolean;
}) {
	const { value: global } = useAppContext();
	const { showEditor, showPreview, showConsole: showConsoleButton } =
		global.config;
	const vertical = global.config.layout === "vertical";
	const hasPane = showPreview || showConsoleButton;

	const [showConsole, setShowConsole] = useState(
		!showPreview && showConsoleButton,
	);
	const [expanded, setExpanded] = useState(false);
	// Dragging takes over from "Show more": collapse so that hiding the
	// button (a dragged row has none) never leaves the block stuck expanded.
	const collapse = useCallback(() => setExpanded(false), []);

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
	const sizes = useBlockSizes({
		expanded,
		consoleShown: showConsole,
		manual: {
			row: rowResize.height,
			editor: editorResize.height,
			pane: paneResize.height,
		},
		previewRef,
		editorBoxRef,
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
				{showPreview && (
					<PreviewPane
						containerRef={previewRef}
						style={showConsole ? HIDDEN : paneStyle}
						resizing={resizing}
						previewLoadState={previewLoadState}
						isOnline={isOnline}
						onShowConsole={
							showConsoleButton ? () => setShowConsole(true) : undefined
						}
					/>
				)}
				{showConsoleButton && (
					<ConsolePane
						style={showConsole ? paneStyle : HIDDEN}
						onShowPreview={
							showPreview ? () => setShowConsole(false) : undefined
						}
					/>
				)}
				{vertical && hasPane && <HeightHandle resize={paneResize} />}
			</SandpackLayout>
			{!vertical && <HeightHandle resize={rowResize} />}
			{sizes.showExpand && (
				<div className="cp-block-actions">
					<ExpandableButton expanded={expanded} setExpanded={setExpanded} />
				</div>
			)}
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
