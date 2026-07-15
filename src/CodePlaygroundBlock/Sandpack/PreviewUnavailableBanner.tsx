export function PreviewUnavailableBanner({ isOnline }: { isOnline: boolean }) {
	return (
		<div className="cp-preview-unavailable">
			{isOnline ? (
				<p>The preview could not load. Check your network connection.</p>
			) : (
				<>
					<p>The preview needs a network connection.</p>
					<p>
						It will reload automatically when you're back online.
						Editing and saving keep working offline.
					</p>
				</>
			)}
		</div>
	);
}
