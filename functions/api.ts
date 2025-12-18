import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { createMedication, markDoseTaken, queryMedications, updateMedication } from "./lib/dynamodb";
import { createErrorResponse, createResponse, parseRequest } from "./lib/router";

async function handleListMedications(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const req = parseRequest(event);
    const activeOnly = req.queryParams.activeOnly !== "false";
    const medications = await queryMedications("client", activeOnly);

    // Group by medicationId and format response
    const grouped: Record<
      string,
      {
        medicationId: string;
        name: string;
        schedule: string;
        recurrence: "daily" | "weekly";
        active: boolean;
        createdAt: number;
        doses: Array<{
          doseId: string;
          takentimestamp: number;
          lastTaken?: number;
        }>;
      }
    > = {};
    medications.forEach((med) => {
      const parts = med.sortKey.split(":");
      const medicationId = parts[0];

      if (!grouped[medicationId]) {
        grouped[medicationId] = {
          medicationId,
          name: med.name,
          schedule: med.schedule,
          recurrence: med.recurrence,
          active: med.active,
          createdAt: med.createdAt,
          doses: [],
        };
      }

      if (parts.length >= 2) {
        const doseId = parts[1];
        const takentimestamp = parts.length >= 3 ? Number.parseInt(parts[2]) || 0 : 0;
        grouped[medicationId].doses.push({
          doseId,
          takentimestamp,
          lastTaken: med.lastTaken,
        });
      }
    });

    return createResponse(200, { medications: Object.values(grouped) });
  } catch (error: unknown) {
    console.error("Error listing medications:", error);
    return createErrorResponse(500, "Failed to list medications", error instanceof Error ? error.message : String(error));
  }
}

async function handleCreateMedication(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const req = parseRequest(event);
    const body = req.body as Record<string, unknown>;
    const { name, schedule, recurrence } = body;

    if (!name || !schedule || !recurrence) {
      return createErrorResponse(400, "Missing required fields: name, schedule, recurrence");
    }

    if (recurrence !== "daily" && recurrence !== "weekly") {
      return createErrorResponse(400, "Recurrence must be 'daily' or 'weekly'");
    }

    const medication = await createMedication({
      name: String(name),
      schedule: String(schedule),
      recurrence: recurrence as "daily" | "weekly",
      active: true,
      createdAt: Math.floor(Date.now() / 1000),
    });

    return createResponse(201, { medication });
  } catch (error: unknown) {
    console.error("Error creating medication:", error);
    return createErrorResponse(500, "Failed to create medication", error instanceof Error ? error.message : String(error));
  }
}

async function handleUpdateMedication(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const req = parseRequest(event);
    const { id } = req.pathParams;

    if (!id) {
      return createErrorResponse(400, "Missing medication ID");
    }

    // Find the medication by querying and matching medicationId
    const medications = await queryMedications("client", false);
    const medication = medications.find(m => m.sortKey.startsWith(`${id}:`));

    if (!medication) {
      return createErrorResponse(404, "Medication not found");
    }

    // Mark as inactive (soft delete)
    const updated = await updateMedication("client", medication.sortKey, { active: false });

    return createResponse(200, { medication: updated });
  } catch (error: unknown) {
    console.error("Error updating medication:", error);
    return createErrorResponse(500, "Failed to update medication", error instanceof Error ? error.message : String(error));
  }
}

async function handleMarkDoseTaken(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const req = parseRequest(event);
    const { id, doseId } = req.pathParams;

    if (!id || !doseId) {
      return createErrorResponse(400, "Missing medication ID or dose ID");
    }

    // Find the medication
    const medications = await queryMedications("client", false);
    const medication = medications.find(m => m.sortKey.startsWith(`${id}:`) && m.sortKey.includes(`:${doseId}:`));

    if (!medication) {
      return createErrorResponse(404, "Medication or dose not found");
    }

    const updated = await markDoseTaken("client", medication.sortKey);

    return createResponse(200, { medication: updated });
  } catch (error: unknown) {
    console.error("Error marking dose as taken:", error);
    return createErrorResponse(500, "Failed to mark dose as taken", error instanceof Error ? error.message : String(error));
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return createResponse(200, {});
  }

  const method = event.httpMethod;
  // Handle proxy path - remove /{stage} prefix if present
  let path = event.path || "";
  if (path.includes("/prod/") || path.includes("/dev/")) {
    path = path.split("/").slice(2).join("/");
  }
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  // Route based on method and path
  if (method === "GET" && path === "/medications") {
    return handleListMedications(event);
  }

  if (method === "POST" && path === "/medications") {
    return handleCreateMedication(event);
  }

  if (method === "PUT" && path.match(/^\/medications\/[^/]+$/)) {
    return handleUpdateMedication(event);
  }

  if (method === "POST" && path.match(/^\/medications\/[^/]+\/doses\/[^/]+\/taken$/)) {
    return handleMarkDoseTaken(event);
  }

  return createErrorResponse(404, "Not Found");
}
