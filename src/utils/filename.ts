export function generateWorkoutFilename(
	date: string,
	templateName: string | null,
	existingFilenames: string[]
): string {
	const base = templateName ?? "Workout";
	const candidate = `${date} ${base}.md`;

	if (!existingFilenames.includes(candidate)) {
		return candidate;
	}

	let counter = 2;
	while (existingFilenames.includes(`${date} ${base} ${counter}.md`)) {
		counter++;
	}
	return `${date} ${base} ${counter}.md`;
}
