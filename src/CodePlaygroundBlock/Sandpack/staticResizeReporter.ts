/**
 * The runtime bundler reports the preview document height with "resize"
 * messages, but Sandpack's static client (template "static") never does, so
 * content-based pane sizing always saw 0. This script mirrors the bundler's
 * reporter: measure the same way and send only on change. It re-checks when
 * the DOM changes or the document resizes, at most once per frame, so an
 * animated page doesn't force a layout on every mutation.
 *
 * `codesandbox: true` makes SandpackStatic forward the message to listeners.
 */
const STATIC_RESIZE_REPORTER_SCRIPT = `(function () {
	var last = 0, frame = 0;
	function send() {
		frame = 0;
		var body = document.body, html = document.documentElement;
		if (!body) return;
		var height = Math.max(body.scrollHeight, body.offsetHeight, html.offsetHeight);
		if (height === last) return;
		last = height;
		parent.postMessage({ type: "resize", height: height, codesandbox: true }, "*");
	}
	function schedule() {
		if (!frame) frame = requestAnimationFrame(send);
	}
	function start() {
		send();
		new MutationObserver(schedule).observe(document, { attributes: true, childList: true, subtree: true });
		var resizeObserver = new ResizeObserver(schedule);
		resizeObserver.observe(document.documentElement);
		if (document.body) resizeObserver.observe(document.body);
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
	else start();
})();`;

/**
 * The script as a Sandpack external resource. SandpackStatic picks the tag
 * from the URL's extension, so the `#.js` fragment makes it emit a <script>;
 * browsers ignore the fragment when loading a data URL.
 */
export const STATIC_RESIZE_REPORTER_URL = `data:text/javascript;base64,${btoa(
	STATIC_RESIZE_REPORTER_SCRIPT,
)}#.js`;
