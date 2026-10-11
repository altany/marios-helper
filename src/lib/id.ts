/** Short random id. Never contains "|" or "#", which are used in run and notification ids. */
export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
