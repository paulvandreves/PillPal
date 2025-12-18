import { beforeAll, describe, expect, it } from "vitest";

// Integration tests - calling the actual deployed API Gateway endpoint
// To run these tests, ensure you have deployed the application using ./deploy.sh
// and that the VITE_API_URL environment variable is set

describe("pillPal API Integration Tests", () => {
  let apiUrl: string;

  beforeAll(() => {
    // Get API URL from environment variable
    apiUrl = process.env.VITE_API_URL || "";

    if (!apiUrl) {
      throw new Error(
        "VITE_API_URL environment variable is not set. "
        + "Please deploy the application using ./deploy.sh first, "
        + "or set VITE_API_URL to your API Gateway URL.",
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
      name: `Test Medication`,
      schedule: 8, // 08:00
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
    expect(data.medication).toHaveProperty("name");
    expect(data.medication).toHaveProperty("nextDoseTime");
    expect(typeof data.medication.nextDoseTime).toBe("number");
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

  it("should create a medication and read it back from database", async () => {
    // Create a unique medication
    const uniqueName = `Integration Test Med ${Date.now()}`;
    const medication = {
      name: uniqueName,
      schedule: 9, // 09:00
      recurrence: "daily",
    };

    // Create the medication
    const createResponse = await fetch(`${apiUrl}/medications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(medication),
    });

    expect(createResponse.status).toBe(201);
    const createData = await createResponse.json();
    expect(createData.medication).toHaveProperty("name", uniqueName);
    expect(createData.medication).toHaveProperty("schedule", 9);
    expect(createData.medication).toHaveProperty("recurrence", "daily");
    expect(createData.medication).toHaveProperty("nextDoseTime");

    // Read back all medications and verify our medication exists
    const listResponse = await fetch(`${apiUrl}/medications`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(listResponse.status).toBe(200);
    const listData = await listResponse.json();
    expect(Array.isArray(listData.medications)).toBe(true);

    // Find our medication in the list
    const foundMedication = listData.medications.find(
      (m: any) => m.name === uniqueName,
    );

    expect(foundMedication).toBeDefined();
    expect(foundMedication.name).toBe(uniqueName);
    expect(foundMedication.schedule).toBe(9);
    expect(foundMedication.recurrence).toBe("daily");
    expect(foundMedication.active).toBe(true);
    expect(foundMedication).toHaveProperty("nextDoseTime");
    expect(typeof foundMedication.nextDoseTime).toBe("number");
    expect(foundMedication).toHaveProperty("doses");
    expect(Array.isArray(foundMedication.doses)).toBe(true);
    expect(foundMedication.doses[0]).toHaveProperty("nextDoseTime");
  });

  it("should automatically sort medications by upcoming dose (earliest first)", async () => {
    // Create medications with different schedules
    const now = new Date();
    const hour1 = (now.getHours() + 1) % 24;
    const hour2 = (now.getHours() + 2) % 24;
    const testTimestamp = Date.now();

    const med1Name = `Later Med ${testTimestamp}`;
    const med2Name = `Earlier Med ${testTimestamp}`;

    const med1 = {
      name: med1Name,
      schedule: hour2, // Later hour
      recurrence: "daily",
    };

    const med2 = {
      name: med2Name,
      schedule: hour1, // Earlier hour
      recurrence: "daily",
    };

    // Create both medications
    await fetch(`${apiUrl}/medications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(med1),
    });

    await fetch(`${apiUrl}/medications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(med2),
    });

    // Query medications - should be automatically sorted by nextDoseTime
    const response = await fetch(`${apiUrl}/medications`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.medications)).toBe(true);

    // Filter to only our test medications with valid nextDoseTime (> current time)
    const currentTime = Math.floor(Date.now() / 1000);
    const testMeds = data.medications.filter(
      (m: any) =>
        (m.name === med1Name || m.name === med2Name)
        && m.nextDoseTime !== undefined
        && typeof m.nextDoseTime === "number"
        && m.nextDoseTime > currentTime,
    );

    expect(testMeds.length).toBe(2);

    // Verify the earlier medication comes first
    expect(testMeds[0].name).toBe(med2Name);
    expect(testMeds[1].name).toBe(med1Name);

    // Verify nextDoseTime is properly sorted
    expect(testMeds[1].nextDoseTime).toBeGreaterThanOrEqual(testMeds[0].nextDoseTime);
  });
});
