export const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

export function isObjectIdString(value: string): boolean {
  return OBJECT_ID_REGEX.test(value);
}
