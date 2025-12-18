import { beforeAll, describe, expect, it } from "vitest";

// Integration tests - calling the actual deployed API Gateway endpoint
// To run these tests, ensure you have deployed the application using ./deploy.sh
// and that the VITE_API_URL environment variable is set

describe("PillPal API Integration Tests", () => {
  let apiUrl: string;

  beforeAll(() => {
    // Get API URL from environment variable
    apiUrl = process.env.VITE_API_URL || "";
    
    if (!apiUrl) {
      throw new Error(
        "VITE_API_URL environment variable is not set. " +
        "Please deploy the application using ./deploy.sh first, " +
        "or set VITE_API_URL to your API Gateway URL."
      );
    }
    
    console.log(`Testing against API: ${apiUrl}`);
  });

  it("should successfully handle CORS preflight request", async () => {
    const response = await fetch(`${apiUrl}/medications`, {
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("should successfully GET /medications and return 200", async () => {
    const response = await fetch(`${apiUrl}/medications`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(200);
    
    // Verify CORS headers are present
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    
    const data = await response.json();
    expect(data).toHaveProperty("medications");
    expect(Array.isArray(data.medications)).toBe(true);
  });

  it("should successfully POST /medications and return 201", async () => {
    const medication = {
      name: `Test Medication ${Date.now()}`,
      schedule: "8:00 AM",
      recurrence: "daily",
    };

    const response = await fetch(`${apiUrl}/medications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(medication),
    });

    expect(response.status).toBe(201);
    
    // Verify CORS headers are present
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    
    const data = await response.json();
    expect(data).toHaveProperty("medication");
    expect(data.medication).toHaveProperty("medicationId");
  });

  it("should return 400 for POST /medications with missing fields", async () => {
    const response = await fetch(`${apiUrl}/medications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Test" }), // Missing schedule and recurrence
    });

    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  it("should return 404 for unknown routes", async () => {
    const response = await fetch(`${apiUrl}/unknown-route`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  it("should verify all responses include CORS headers", async () => {
    const response = await fetch(`${apiUrl}/medications`, {
      method: "GET",
    });

    // Check all required CORS headers
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeTruthy();
    expect(response.headers.get("Access-Control-Allow-Headers")).toBeTruthy();
  });
});
