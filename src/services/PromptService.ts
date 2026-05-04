export class PromptService {
	fill(template: string, vars: Record<string, string>): string {
		return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => {
			return Object.prototype.hasOwnProperty.call(vars, key)
				? vars[key]
				: "";
		});
	}
}
