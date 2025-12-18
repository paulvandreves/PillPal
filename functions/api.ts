import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { createMedication, markDoseTaken, queryMedications, updateMedication, validateScheduleFormat } from "./lib/dynamodb";
import { createErrorResponse, createResponse, parseRequest } from "./lib/router";

async function handleListMedications(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const req = parseRequest(event);
    const activeOnly = req.queryParams.activeOnly !== "false";

    // Query medications - they're now automatically sorted by nextDoseTime due to sortKey structure
    const medications = await queryMedications("client", activeOnly);

    // Group by medication name and format response
    // New sortKey format: nextDoseTime:name
    const grouped: Record<
      string,
      {
        name: string;
        schedule: number;
        recurrence: "daily" | "weekly";
        active: boolean;
        createdAt: number;
        nextDoseTime: number;
        doses: Array<{
          nextDoseTime: number;
          lastTaken?: number;
        }>;
      }
    > = {};
    medications.forEach((med) => {
      const parts = med.sortKey.split(":");
      const nextDoseTime = Number.parseInt(parts[0]) || 0;
      const name = parts[1];

      if (!grouped[name]) {
        grouped[name] = {
          name: med.name,
          schedule: med.schedule,
          recurrence: med.recurrence,
          active: med.active,
          createdAt: med.createdAt,
          nextDoseTime,
          doses: [],
        };
      }

      grouped[name].doses.push({
        nextDoseTime,
        lastTaken: med.lastTaken,
      });
    });

    return createResponse(200, { medications: Object.values(grouped) });
  }
  catch (error: unknown) {
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

    // Validate schedule format
    const scheduleNum = Number(schedule);
    if (!validateScheduleFormat(scheduleNum)) {
      return createErrorResponse(
        400,
        "Invalid schedule format. Expected a number between 0-23 representing the hour in 24-hour format.",
      );
    }

    const result = await createMedication({
      name: String(name),
      schedule: scheduleNum,
      recurrence: recurrence as "daily" | "weekly",
      active: true,
      createdAt: Math.floor(Date.now() / 1000),
    });

    // Format response to match frontend expectations
    const medication = {
      name: result.name,
      schedule: result.schedule,
      recurrence: result.recurrence,
      active: result.active,
      createdAt: result.createdAt,
      nextDoseTime: result.nextDoseTime,
      doses: [{
        nextDoseTime: result.nextDoseTime,
      }],
    };

    return createResponse(201, { medication });
  } catch (error: unknown) {
    console.error("Error creating medication:", error);
    return createErrorResponse(500, "Failed to create medication", error instanceof Error ? error.message : String(error));
  }
}

async function handleUpdateMedication(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Extract medication name from path: /medications/{name}
    let path = event.path || "";
    if (path.includes("/prod/") || path.includes("/dev/")) {
      path = path.split("/").slice(2).join("/");
    }
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }

    const match = path.match(/^\/medications\/([^/]+)$/);
    const id = match ? decodeURIComponent(match[1]) : null;

    if (!id) {
      return createErrorResponse(400, "Missing medication name");
    }

    // Find the medication by querying and matching medication name
    // sortKey format: nextDoseTime:name
    const medications = await queryMedications("client", false);
    const medication = medications.find((m) => {
      const parts = m.sortKey.split(":");
      return parts[1] === id;
    });

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
    // Extract medication name and dose ID from path: /medications/{name}/doses/{doseId}/taken
    let path = event.path || "";
    if (path.includes("/prod/") || path.includes("/dev/")) {
      path = path.split("/").slice(2).join("/");
    }
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }

    const match = path.match(/^\/medications\/([^/]+)\/doses\/([^/]+)\/taken$/);
    const id = match ? decodeURIComponent(match[1]) : null;
    const nextDoseTimeStr = match ? match[2] : null;

    if (!id || !nextDoseTimeStr) {
      return createErrorResponse(400, "Missing medication name or next dose time");
    }

    // Find the medication by name and nextDoseTime
    // sortKey format: nextDoseTime:name
    const medications = await queryMedications("client", false);
    const medication = medications.find((m) => {
      const parts = m.sortKey.split(":");
      const nextDoseTime = parts[0];
      const name = parts[1];
      return name === id && nextDoseTime === String(Number.parseInt(nextDoseTimeStr)).padStart(15, "0");
    });

    if (!medication) {
      return createErrorResponse(404, "Medication or dose not found");
    }

    const updated = await markDoseTaken("client", medication.sortKey);

    return createResponse(200, { medication: updated });
  }
  catch (error: unknown) {
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
