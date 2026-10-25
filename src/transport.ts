import { isPages } from "./paths";
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (isPages) {
    const { demoRequest } = await import("./pages/demo-api");
    return demoRequest(path, init);
  }
  return fetch("/api" + path, init);
}
