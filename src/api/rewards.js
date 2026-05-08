import { apiRequest } from "./http";

const rewardPictureUploadEndpoint = import.meta.env.VITE_REWARD_PICTURE_UPLOAD_ENDPOINT || "/api/upload";
const rewardPictureUploadField = import.meta.env.VITE_REWARD_PICTURE_UPLOAD_FIELD || "file";
const maxRewardPictureLength = 255;

function normalizeInteger(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) ? numericValue : fallback;
}

function normalizeActiveValue(value) {
  return value === 1 || value === "1" || value === true ? 1 : 0;
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmedValue = String(value).trim();
  return trimmedValue ? trimmedValue : null;
}

function extractRewardsList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.rewards)) {
    return payload.rewards;
  }

  if (Array.isArray(payload.data?.rewards)) {
    return payload.data.rewards;
  }

  return [];
}

function extractRewardRecord(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (payload.data && !Array.isArray(payload.data)) {
    return payload.data.reward || payload.data;
  }

  return payload.reward || payload;
}

function extractRewardsPagination(payload, fallbackParams = {}) {
  const pagination = payload?.pagination || payload?.data?.pagination || {};
  const page = normalizeInteger(pagination.page, normalizeInteger(fallbackParams.page, 1));
  const limit = normalizeInteger(pagination.limit, normalizeInteger(fallbackParams.limit, 10));
  const total = normalizeInteger(pagination.total, extractRewardsList(payload).length);
  const totalPages = normalizeInteger(
    pagination.total_pages || pagination.totalPages,
    Math.max(1, Math.ceil(total / Math.max(1, limit))),
  );

  return {
    page: Math.max(1, page),
    limit: Math.max(1, limit),
    total: Math.max(0, total),
    total_pages: Math.max(1, totalPages),
  };
}

function sanitizeRewardPayload(payload) {
  return {
    game_id: Number(payload.game_id),
    picture: normalizeOptionalText(payload.picture),
    description: normalizeOptionalText(payload.description),
    prize: String(payload.prize || "").trim(),
    holdings: Number(payload.holdings),
    is_active: normalizeActiveValue(payload.is_active),
  };
}

function extractUploadUrl(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = [
    payload.url,
    payload.path,
    payload.location,
    payload.file_url,
    payload.fileUrl,
    payload.image_url,
    payload.imageUrl,
    payload.secure_url,
    payload.secureUrl,
    payload.s3_url,
    payload.s3Url,
    payload.picture,
    payload.key,
    payload.data?.url,
    payload.data?.path,
    payload.data?.location,
    payload.data?.file_url,
    payload.data?.fileUrl,
    payload.data?.image_url,
    payload.data?.imageUrl,
    payload.data?.secure_url,
    payload.data?.secureUrl,
    payload.data?.s3_url,
    payload.data?.s3Url,
    payload.data?.picture,
    payload.data?.key,
    payload.data?.file?.url,
    payload.data?.file?.path,
    payload.data?.file?.location,
    payload.data?.file?.secure_url,
    payload.data?.file?.secureUrl,
    payload.data?.file?.key,
    payload.file?.url,
    payload.file?.path,
    payload.file?.location,
    payload.file?.secure_url,
    payload.file?.secureUrl,
    payload.file?.key,
  ];

  const normalizedCandidates = candidates
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim())
    .filter((value) => !value.startsWith("data:") && !value.startsWith("blob:"));

  return (
    normalizedCandidates.find((value) => value.length <= maxRewardPictureLength)
    || normalizedCandidates[0]
    || ""
  );
}

export async function uploadRewardPicture(file) {
  const formData = new FormData();
  formData.append(rewardPictureUploadField, file);

  const payload = await apiRequest(rewardPictureUploadEndpoint, {
    method: "POST",
    body: formData,
  });
  const uploadedUrl = extractUploadUrl(payload);

  if (!uploadedUrl) {
    throw new Error("Picture upload response did not include a URL.");
  }

  return uploadedUrl;
}

export async function getRewardsByGameCredentials({ game_id: gameId, gamesecretkey }) {
  const payload = await apiRequest("/api/rewards/", {
    method: "POST",
    body: JSON.stringify({
      game_id: String(gameId),
      gamesecretkey: String(gamesecretkey || ""),
    }),
  });

  return {
    rewards: extractRewardsList(payload),
    pagination: extractRewardsPagination(payload, { page: 1, limit: 10 }),
    raw: payload,
  };
}

export async function getRewardById(id) {
  const payload = await apiRequest(`/api/rewards/${id}`);
  return extractRewardRecord(payload);
}

export function createReward(payload) {
  return apiRequest("/api/rewards", {
    method: "POST",
    body: JSON.stringify(sanitizeRewardPayload(payload)),
  });
}

export function updateReward(id, payload) {
  return apiRequest(`/api/rewards/${id}`, {
    method: "PUT",
    body: JSON.stringify(sanitizeRewardPayload(payload)),
  });
}

export function updateRewardProbability(id, reward, probability) {
  return apiRequest(`/api/rewards/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      ...sanitizeRewardPayload(reward),
      probability: Number(probability),
    }),
  });
}

export function updateRewardStatus(id, isActive) {
  return apiRequest(`/api/rewards/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      is_active: normalizeActiveValue(isActive),
    }),
  });
}

export function deleteReward(id) {
  return apiRequest(`/api/rewards/${id}`, {
    method: "DELETE",
  });
}
