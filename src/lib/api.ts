import type { CreateMedicationRequest, Medication } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getMedications(): Promise<{ medications: Medication[] }> {
  return request<{ medications: Medication[] }>("/medications");
}

export async function createMedication(data: CreateMedicationRequest): Promise<{ medication: Medication }> {
  return request<{ medication: Medication }>("/medications", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMedication(medicationId: string): Promise<{ medication: Medication }> {
  return request<{ medication: Medication }>(`/medications/${medicationId}`, {
    method: "PUT",
  });
}

export async function markDoseTaken(medicationId: string, doseId: string): Promise<{ medication: Medication }> {
  return request<{ medication: Medication }>(`/medications/${medicationId}/doses/${doseId}/taken`, {
    method: "POST",
  });
}
