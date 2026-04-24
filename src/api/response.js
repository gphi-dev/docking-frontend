const USERMOBILE_COLLECTION_KEYS = ["items", "records", "usermobile", "usersmobile"];

function extractFirstArray(source, keys) {
  if (!source || typeof source !== "object") {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(source[key])) {
      return source[key];
    }
  }

  return [];
}

export function extractUsermobileRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  const nestedRecords = extractFirstArray(payload.data, USERMOBILE_COLLECTION_KEYS);
  if (nestedRecords.length > 0) {
    return nestedRecords;
  }

  return extractFirstArray(payload, USERMOBILE_COLLECTION_KEYS);
}
