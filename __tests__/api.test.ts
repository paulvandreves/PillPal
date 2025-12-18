import type { APIGatewayProxyEvent } from "aws-lambda";

import { describe, expect, it, vi } from "vitest";

import { handler } from "../functions/api";

// Mock DynamoDB
vi.mock("../functions/lib/dynamodb", () => ({
  queryMedications: vi.fn().mockResolvedValue([]),
  createMedication: vi.fn().mockResolvedValue({ medicationId: "test-123" }),
  updateMedication: vi.fn().mockResolvedValue({}),
  markDoseTaken: vi.fn().mockResolvedValue({}),
}));

describe("api handler", () => {
  const createEvent = (method: string, path: string, body?: unknown, pathParams?: Record<string, string>): APIGatewayProxyEvent => ({
    httpMethod: method,
    path,
    body: body ? JSON.stringify(body) : undefined,
    pathParameters: pathParams || null,
    queryStringParameters: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    requestContext: {} as APIGatewayProxyEvent["requestContext"],
    resource: "",
    stageVariables: null,
    multiValueQueryStringParameters: null,
  });

  it("should handle OPTIONS request", async () => {
    const event = createEvent("OPTIONS", "/medications");
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
  });

  it("should handle GET /medications", async () => {
    const event = createEvent("GET", "/medications");
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
  });

  it("should handle POST /medications", async () => {
    const event = createEvent("POST", "/medications", {
      name: "Test Medication",
      schedule: "8:00 AM",
      recurrence: "daily",
    });
    const response = await handler(event);
    expect(response.statusCode).toBe(201);
  });

  it("should return 404 for unknown routes", async () => {
    const event = createEvent("GET", "/unknown");
    const response = await handler(event);
    expect(response.statusCode).toBe(404);
  });
});
