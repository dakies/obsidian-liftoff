/** Whether a vault path lies inside `folder` (at any depth). An empty folder matches nothing. */
export function isPathInFolder(path: string, folder: string): boolean {
	const prefix = folder.trim().replace(/^\/+|\/+$/g, "");
	if (!prefix) return false;
	return path.startsWith(`${prefix}/`);
}
