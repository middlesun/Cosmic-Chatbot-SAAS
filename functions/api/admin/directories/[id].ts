import { onRequestDelete as handleDelete, onRequestOptions } from '../directories';

export { onRequestOptions };

export async function onRequestDelete(context: { request: Request; env: any; params?: { id?: string } }) {
  return handleDelete(context);
}
