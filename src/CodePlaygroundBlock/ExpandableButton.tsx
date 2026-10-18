export function ExpandableButton({
	expanded,
	setExpanded,
}: {
	expanded: boolean;
	setExpanded: (value: boolean) => unknown;
}) {
	return !expanded ? (
		<button className="expandableButton" onClick={() => setExpanded(true)}>
			▾ Show more
		</button>
	) : (
		<button className="expandableButton" onClick={() => setExpanded(false)}>
			▴ Show less
		</button>
	);
}
