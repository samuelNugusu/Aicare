/**
 * Service to handle communication with the backend API
 */

export async function post(path: string, data: any) {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `API error: ${response.statusText}`);
  }

  return result;
}
