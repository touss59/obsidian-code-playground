import { useEffect, useRef, type CSSProperties } from "react";
import type { RuntimeRun } from "CodePlaygroundBlock/Runtime/useRuntimeRun";

/**
 * The output of a runtime block, in place of the preview iframe. A toolbar
 * shows the run status with a Run or Stop button. stderr shows in red.
 */
export function RuntimeOutputPane({
	run,
	style,
	onContentHeight,
}: {
	run: RuntimeRun;
	style: CSSProperties;
	/** Gets the height of the toolbar and output, so the block can fit it. */
	onContentHeight?: (height: number) => void;
}) {
	const contentRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const content = contentRef.current;
		if (!content || !onContentHeight) return;
		const observer = new ResizeObserver(() =>
			onContentHeight(content.offsetHeight),
		);
		observer.observe(content);
		return () => observer.disconnect();
	}, [onContentHeight]);

	const busy = run.phase === "queued" || run.phase === "running";

	return (
		<div className="cp-runtime-pane" style={style}>
			<div className="cp-runtime-scroll">
				<div ref={contentRef}>
					{/* The button comes first: Obsidian's "Edit this block" button
					    covers the top-right corner of the block. */}
					<div className="cp-runtime-toolbar">
						{busy ? (
							<button
								onClick={run.stop}
								title={`Stop this run. The next run loads ${run.engineName} again.`}
							>
								Stop
							</button>
						) : (
							<button onClick={run.rerun}>Run</button>
						)}
						<span className="cp-runtime-status">{run.status}</span>
					</div>
					{/* A div, not a pre: Obsidian and its themes style the pre
					    elements of a note. */}
					<div className="cp-runtime-output">
						{run.lines.map((line, index) => (
							<span
								key={index}
								className={
									line.stream === "stderr" ? "cp-runtime-stderr" : undefined
								}
							>
								{line.text + "\n"}
							</span>
						))}
						{run.truncated && (
							<span className="cp-runtime-stderr">
								Output truncated: later lines are not shown.
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
