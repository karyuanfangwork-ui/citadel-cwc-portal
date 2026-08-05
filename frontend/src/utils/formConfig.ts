/**
 * Safely parse formConfig which may come from the API as a JSON string
 * or already be parsed as an array.
 */
export function parseFormConfig(formConfig: unknown): any[] {
    if (!formConfig) return [];
    if (Array.isArray(formConfig)) return formConfig;
    if (typeof formConfig === 'string') {
        try {
            const parsed = JSON.parse(formConfig);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}