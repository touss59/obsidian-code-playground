import { useCallback, useRef, useState } from "react";
import { useAppContext } from "CodePlaygroundBlock/AppContextProvider";
import { useDebounce } from "CodePlaygroundBlock/useDebounce";
import { useStorage } from "CodePlaygroundBlock/useStorage";
import { DRAGGED_SIZE_DEBOUNCE_MS } from "appConstants";

type SizeField =
	| "editorWidth"
	| "fullscreenEditorWidth"
	| "rowHeight"
	| "editorHeight"
	| "paneHeight";

/**
 * A size the user set by dragging a handle, saved per block. `set` rounds and
 * saves it. `reset` clears it. Nothing is saved before the block has loaded,
 * so an early drag can't overwrite the stored value.
 */
export function useSavedSize(field: SizeField) {
	const { value: global } = useAppContext();
	const { getItem, saveItem } = useStorage(field);
	const [size, setSize] = useState<number | undefined>(getItem);
	const debouncedSaveItem = useDebounce(saveItem, DRAGGED_SIZE_DEBOUNCE_MS);
	const loadedRef = useRef(global.hasBeenCorrectlyLoaded);
	loadedRef.current = global.hasBeenCorrectlyLoaded;

	const save = useCallback(
		(value: number | undefined) => {
			if (loadedRef.current) debouncedSaveItem(value);
		},
		[debouncedSaveItem],
	);

	const set = useCallback(
		(value: number) => {
			const rounded = Math.round(value);
			setSize(rounded);
			save(rounded);
		},
		[save],
	);

	const reset = useCallback(() => {
		setSize(undefined);
		save(undefined);
	}, [save]);

	return { size, set, reset };
}
