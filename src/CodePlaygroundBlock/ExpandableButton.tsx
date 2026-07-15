export function ExpandableButton({
	expanded,
	setExpanded,
}: {
	expanded: boolean;
	setExpanded: (value: boolean) => unknown;
}) {
	return !expanded ? (
		<button
			className="expandableButton"
			aria-label="Show more"
			onClick={() => setExpanded(true)}
		>
			▾
		</button>
	) : (
		<button
			className="expandableButton"
			aria-label="Show less"
			onClick={() => setExpanded(false)}
		>
			▴
		</button>
	);
}
