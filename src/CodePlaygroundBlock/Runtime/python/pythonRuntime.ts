import type { PlaygroundRuntime } from "CodePlaygroundBlock/Runtime/PlaygroundRuntime";

/** Pyodide release loaded from the CDN. */
const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/";

/** Pyodide folder of a block's files, while it runs. */
const BLOCKS_DIR = "/home/pyodide/playgrounds";

/**
 * Python helpers that the worker defines once. `_cp_prepare` writes a
 * block's files to its folder and makes the folder importable.
 * `_cp_cleanup` forgets the block's modules, so the next run imports the
 * edited files.
 */
const PYTHON_HELPERS = `
import importlib
import os
import shutil
import sys

# The default backend draws into the page, and the worker has none.
os.environ.setdefault("MPLBACKEND", "Agg")
_cp_home = os.getcwd()


def _cp_prepare(folder, files):
    shutil.rmtree(folder, ignore_errors=True)
    os.makedirs(folder)
    root = os.path.realpath(folder) + os.sep
    for path, code in files.items():
        full = os.path.realpath(os.path.join(folder, path.lstrip("/")))
        if not full.startswith(root):
            continue
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as file:
            file.write(code)
    importlib.invalidate_caches()
    os.chdir(folder)
    sys.path.insert(0, folder)


def _cp_cleanup(folder):
    sys.stdout.flush()
    sys.stderr.flush()
    prefix = folder + os.sep
    for name, module in list(sys.modules.items()):
        if (getattr(module, "__file__", None) or "").startswith(prefix):
            del sys.modules[name]
    while folder in sys.path:
        sys.path.remove(folder)
    os.chdir(_cp_home)
`;

/**
 * Each run has fresh globals, with `__name__` set to "__main__". Packages
 * and other modules stay loaded between runs and blocks.
 */
const WORKER_SOURCE = `
const INDEX_URL = ${JSON.stringify(PYODIDE_INDEX_URL)};
const BLOCKS_DIR = ${JSON.stringify(BLOCKS_DIR)};
const HELPERS = ${JSON.stringify(PYTHON_HELPERS)};

async function load() {
	importScripts(INDEX_URL + "pyodide.js");
	const pyodide = await loadPyodide({ indexURL: INDEX_URL });
	// A "write" handler, not "batched": batched keeps a line without a
	// newline until a later run prints one, so it shows in that run.
	pyodide.setStdout({ write: (buffer) => output.bytes("stdout", buffer) });
	pyodide.setStderr({ write: (buffer) => output.bytes("stderr", buffer) });
	// The output pane has no keyboard input: input() raises an error.
	pyodide.setStdin({ error: true });
	pyodide.runPython(HELPERS);
	return {
		pyodide,
		prepare: pyodide.globals.get("_cp_prepare"),
		cleanup: pyodide.globals.get("_cp_cleanup"),
	};
}

async function execute({ pyodide, prepare, cleanup }, job) {
	const folder = BLOCKS_DIR + "/" + job.blockId;
	const entry = folder + ENTRY;

	job.status("Loading packages...");
	await job.time("packages", async () => {
		for (const [path, code] of Object.entries(job.files)) {
			if (!path.endsWith(".py")) continue;
			await pyodide.loadPackagesFromImports(code, {
				messageCallback: job.status,
				errorCallback: (text) => output.text("stderr", text + "\\n"),
			});
		}
	});

	job.startCode();
	job.status("Running...");
	const pyFiles = pyodide.toPy(job.files);
	const globals = pyodide.toPy({ __name__: "__main__", __file__: entry });
	try {
		prepare(folder, pyFiles);
		await job.time("run", () =>
			pyodide.runPythonAsync(job.files[ENTRY], { globals, filename: entry }),
		);
	} finally {
		try {
			cleanup(folder);
		} catch (caught) {
			console.error("[CodePlayground] Python cleanup failed:", caught);
		}
		pyFiles.destroy();
		globals.destroy();
	}
}
`;

export const pythonRuntime: PlaygroundRuntime = {
	template: "python",
	engineName: "Pyodide",
	entry: "/main.py",
	starterFiles: {
		"/main.py": {
			code: `# Runs in Pyodide. All Python blocks share one interpreter,
# but each run gets fresh globals.
import sys

print("Hello from Python", sys.version.split()[0])
`,
		},
	},
	workerSource: WORKER_SOURCE,
	formatError: (message, blockId) =>
		cleanTraceback(message, `${BLOCKS_DIR}/${blockId}/`),
};

/**
 * Drops Pyodide's own frames from a Python traceback, so that it starts at
 * the block's code, and removes `folder` from file paths. Other messages
 * come back unchanged.
 */
export function cleanTraceback(message: string, folder: string): string {
	const lines: string[] = [];
	let inPyodideFrame = false;
	for (const line of message.split("\n")) {
		if (line.startsWith("  File ")) {
			inPyodideFrame = line.includes("/_pyodide/");
		} else if (!line.startsWith("    ")) {
			inPyodideFrame = false;
		}
		if (!inPyodideFrame) lines.push(line.split(folder).join(""));
	}
	return lines.join("\n").trimEnd();
}
