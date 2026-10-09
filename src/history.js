import { getOfflineCache, saveOfflineCache } from "./offline";

async function readError(response) {
  try {
    const body = await response.json();
    if (typeof body.detail === "string") return body.detail;
  } catch {}
  return `इतिहास सेव नहीं हुआ (HTTP ${response.status})`;
}

export async function getCropHistory(farmerId) {
  const key = `history:${farmerId}`;
  try {
    const response = await fetch(`/api/history?farmer_id=${encodeURIComponent(farmerId)}`);
    if (!response.ok) throw new Error(await readError(response));
    const result = await response.json();
    await saveOfflineCache(key, result.records);
    return { records: result.records, stale: false };
  } catch (error) {
    const cached = await getOfflineCache(key);
    if (cached) return { records: cached.value, stale: true };
    throw error;
  }
}

export async function updateCropHistory(recordId, update) {
  const response = await fetch(`/api/history/${encodeURIComponent(recordId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}
