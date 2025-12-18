import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export type RouteHandler = {
  (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>;
};

export type ParsedRequest = {
  method: string;
  path: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
};

export function parseRequest(event: APIGatewayProxyEvent): ParsedRequest {
  const method = event.httpMethod;
  const path = event.path || "";
  const pathParams: Record<string, string> = {};
  if (event.pathParameters) {
    for (const [key, value] of Object.entries(event.pathParameters)) {
      if (value) {
        pathParams[key] = value;
      }
    }
  }
  const queryParams: Record<string, string> = {};
  if (event.queryStringParameters) {
    for (const [key, value] of Object.entries(event.queryStringParameters)) {
      if (value) {
        queryParams[key] = value;
      }
    }
  }
  const headers: Record<string, string> = {};
  if (event.headers) {
    for (const [key, value] of Object.entries(event.headers)) {
      if (value) {
        headers[key] = value;
      }
    }
  }

  let body: unknown = null;
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      // Body might not be JSON
      body = event.body;
    }
  }

  return {
    method,
    path,
    pathParams,
    queryParams,
    body,
    headers,
  };
}

export function createResponse(statusCode: number, body: unknown, headers: Record<string, string> = {}): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export function createErrorResponse(statusCode: number, message: string, error?: unknown): APIGatewayProxyResult {
  const body: Record<string, unknown> = {
    error: message,
  };
  if (error) {
    body.details = error;
  }
  return createResponse(statusCode, body);
}
