import { Component, ErrorInfo, ReactNode } from "react";

type Props = {
	children: ReactNode;
};

type State = {
	error: Error | null;
};

/**
 * Catches render/runtime errors thrown anywhere inside the playground tree so a
 * single broken block renders a friendly inline message instead of bubbling the
 * throw up into Obsidian's markdown post-processor.
 */
export class PlaygroundErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		console.error("[CodePlayground] Playground crashed:", error, info);
	}

	render(): ReactNode {
		if (this.state.error) {
			return (
				<div className="cp-error">
					<strong>This playground failed to render.</strong>
					<p>{this.state.error.message}</p>
				</div>
			);
		}
		return this.props.children;
	}
}
