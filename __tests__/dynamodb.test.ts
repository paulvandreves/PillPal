import { beforeEach, describe, expect, it, vi } from "vitest";

// Import after mocks are set up
import { calculateNextDoseTime, createMedication, markDoseTaken, queryMedications, validateScheduleFormat } from "../functions/lib/dynamodb";

// Create a mock send function at module level
const mockSendFn = vi.fn();

// Mock AWS SDK
vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class {
    constructor() {}
  },
}));

vi.mock("@aws-sdk/lib-dynamodb", () => {
  return {
    DynamoDBDocumentClient: {
      from: () => ({
        send: (...args: any[]) => mockSendFn(...args),
      }),
    },
    PutCommand: class {
      constructor(public input: any) {}
    },
    QueryCommand: class {
      constructor(public input: any) {}
    },
    UpdateCommand: class {
      constructor(public input: any) {}
    },
    DeleteCommand: class {
      constructor(public input: any) {}
    },
  };
});

describe("dynamodb - validateScheduleFormat", () => {
  it("should accept valid hours (0-23)", () => {
    expect(validateScheduleFormat(0)).toBe(true);
    expect(validateScheduleFormat(8)).toBe(true);
    expect(validateScheduleFormat(12)).toBe(true);
    expect(validateScheduleFormat(23)).toBe(true);
  });

  it("should reject invalid hours", () => {
    expect(validateScheduleFormat(-1)).toBe(false);
    expect(validateScheduleFormat(24)).toBe(false);
    expect(validateScheduleFormat(25)).toBe(false);
  });

  it("should reject non-integer values", () => {
    expect(validateScheduleFormat(8.5)).toBe(false);
    expect(validateScheduleFormat(12.3)).toBe(false);
  });

  it("should reject non-number input", () => {
    expect(validateScheduleFormat(null as any)).toBe(false);
    expect(validateScheduleFormat(undefined as any)).toBe(false);
    expect(validateScheduleFormat("8" as any)).toBe(false);
  });
});

describe("dynamodb - calculateNextDoseTime", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
  });

  it("should calculate next dose time for a daily dose in the future", () => {
    const now = new Date();
    // Set a time 2 hours in the future
    const futureHour = (now.getHours() + 2) % 24;

    const nextDoseTime = calculateNextDoseTime(futureHour, "daily");

    expect(nextDoseTime).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(typeof nextDoseTime).toBe("number");
    expect(Number.isNaN(nextDoseTime)).toBe(false);
  });

  it("should return tomorrow's dose when today's dose has passed", () => {
    const now = new Date();
    // Use an hour that has definitely passed (current hour - 2)
    const pastHour = (now.getHours() - 2 + 24) % 24;

    const nextDoseTime = calculateNextDoseTime(pastHour, "daily");

    const nowInSeconds = Math.floor(Date.now() / 1000);
    expect(nextDoseTime).toBeGreaterThan(nowInSeconds);
    expect(typeof nextDoseTime).toBe("number");
    expect(Number.isNaN(nextDoseTime)).toBe(false);

    // Should be approximately 22 hours from now (24h - 2h)
    const expectedTime = nowInSeconds + (22 * 60 * 60);
    expect(Math.abs(nextDoseTime - expectedTime)).toBeLessThan(3600); // Within 1 hour margin
  });

  it("should handle midnight (hour 0) correctly", () => {
    const schedule = 0;
    const nextDoseTime = calculateNextDoseTime(schedule, "daily");

    expect(typeof nextDoseTime).toBe("number");
    expect(Number.isNaN(nextDoseTime)).toBe(false);
    expect(nextDoseTime).toBeGreaterThan(0);
  });

  it("should handle noon (hour 12) correctly", () => {
    const schedule = 12;
    const nextDoseTime = calculateNextDoseTime(schedule, "daily");

    expect(typeof nextDoseTime).toBe("number");
    expect(Number.isNaN(nextDoseTime)).toBe(false);
    expect(nextDoseTime).toBeGreaterThan(0);
  });

  it("should calculate next week's dose for weekly recurrence when dose has passed", () => {
    const now = new Date();
    const pastHour = (now.getHours() - 2 + 24) % 24;

    const nextDoseTime = calculateNextDoseTime(pastHour, "weekly");

    const nowInSeconds = Math.floor(Date.now() / 1000);
    expect(nextDoseTime).toBeGreaterThan(nowInSeconds);
    expect(typeof nextDoseTime).toBe("number");
    expect(Number.isNaN(nextDoseTime)).toBe(false);

    // Should be approximately 7 days - 2 hours from now
    const expectedTime = nowInSeconds + (7 * 24 * 60 * 60) - (2 * 60 * 60);
    expect(Math.abs(nextDoseTime - expectedTime)).toBeLessThan(3600); // Within 1 hour margin
  });

  it("should return today's dose if scheduled time hasn't passed yet", () => {
    const now = new Date();
    const futureHour = (now.getHours() + 1) % 24;

    const nextDoseTime = calculateNextDoseTime(futureHour, "daily");

    const scheduledTimeToday = new Date(now);
    scheduledTimeToday.setHours(futureHour, 0, 0, 0);
    const expectedTime = Math.floor(scheduledTimeToday.getTime() / 1000);

    // Should be within a few seconds of the expected time
    expect(Math.abs(nextDoseTime - expectedTime)).toBeLessThan(5);
  });
});

describe("dynamodb - createMedication", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
    mockSendFn.mockResolvedValue({});

    // Set the TABLE_NAME environment variable
    process.env.TABLE_NAME = "test-table";
  });

  it("should create a medication with valid nextDoseTime", async () => {
    const medication = {
      name: "Aspirin",
      schedule: 8, // 08:00
      recurrence: "daily" as const,
      active: true,
      createdAt: Math.floor(Date.now() / 1000),
    };

    const result = await createMedication(medication);

    expect(result).toHaveProperty("name", "Aspirin");
    expect(result).toHaveProperty("schedule", 8);
    expect(result).toHaveProperty("recurrence", "daily");
    expect(result).toHaveProperty("nextDoseTime");
    expect(result).toHaveProperty("sortKey");
    expect(result).toHaveProperty("client", "client");

    // Verify nextDoseTime is a valid number and not NaN
    expect(typeof result.nextDoseTime).toBe("number");
    expect(Number.isNaN(result.nextDoseTime)).toBe(false);
    expect(result.nextDoseTime).toBeGreaterThan(0);

    // Verify sortKey format: nextDoseTime:name:takentimestamp
    expect(result.sortKey).toMatch(/^\d{15}:Aspirin:0$/);

    // Verify DynamoDB was called
    expect(mockSendFn).toHaveBeenCalledTimes(1);
  });

  it("should create a medication with morning dose time", async () => {
    const medication = {
      name: "Vitamin D",
      schedule: 9, // 09:00
      recurrence: "daily" as const,
      active: true,
      createdAt: Math.floor(Date.now() / 1000),
    };

    const result = await createMedication(medication);

    expect(result).toHaveProperty("name", "Vitamin D");
    expect(result).toHaveProperty("schedule", 9);
    expect(result).toHaveProperty("nextDoseTime");
    expect(typeof result.nextDoseTime).toBe("number");
    expect(Number.isNaN(result.nextDoseTime)).toBe(false);
    expect(result.sortKey).toMatch(/^\d{15}:Vitamin D:0$/);
  });

  it("should create a weekly medication", async () => {
    const medication = {
      name: "Weekly Supplement",
      schedule: 10, // 10:00
      recurrence: "weekly" as const,
      active: true,
      createdAt: Math.floor(Date.now() / 1000),
    };

    const result = await createMedication(medication);

    expect(result).toHaveProperty("recurrence", "weekly");
    expect(result).toHaveProperty("schedule", 10);
    expect(result).toHaveProperty("nextDoseTime");
    expect(typeof result.nextDoseTime).toBe("number");
    expect(Number.isNaN(result.nextDoseTime)).toBe(false);
  });

  it("should pad nextDoseTime in sortKey to 15 digits for proper sorting", async () => {
    const medication = {
      name: "Test Med",
      schedule: 8, // 08:00
      recurrence: "daily" as const,
      active: true,
      createdAt: Math.floor(Date.now() / 1000),
    };

    const result = await createMedication(medication);

    // Extract the nextDoseTime portion from sortKey
    const sortKeyParts = result.sortKey.split(":");
    const paddedTime = sortKeyParts[0];

    expect(paddedTime.length).toBe(15);
    expect(paddedTime).toMatch(/^\d{15}$/);
  });
});

describe("dynamodb - markDoseTaken", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
    process.env.TABLE_NAME = "test-table";
  });

  it("should update medication with new nextDoseTime after marking dose as taken", async () => {
    const clientId = "client";
    const medication = {
      client: clientId,
      sortKey: "000001734537600:Aspirin:0",
      name: "Aspirin",
      schedule: 8, // 08:00
      recurrence: "daily" as const,
      active: true,
      createdAt: Math.floor(Date.now() / 1000) - 86400, // Created yesterday
    };

    // Mock the query to return the medication
    mockSendFn
      .mockResolvedValueOnce({
        Items: [medication],
      })
      .mockResolvedValueOnce({}) // Delete operation
      .mockResolvedValueOnce({}); // Put operation

    const result = await markDoseTaken(clientId, medication.sortKey);

    expect(result).toHaveProperty("lastTaken");
    expect(result).toHaveProperty("sortKey");
    expect(result.lastTaken).toBeGreaterThan(medication.createdAt);

    // Verify the sortKey was updated
    expect(result.sortKey).not.toBe(medication.sortKey);

    // Verify the taken counter was incremented
    const newSortKeyParts = result.sortKey.split(":");
    const takenCount = Number.parseInt(newSortKeyParts[2]);
    expect(takenCount).toBe(1);

    // Verify DynamoDB operations were called (Query, Delete, Put)
    expect(mockSendFn).toHaveBeenCalledTimes(3);
  });

  it("should increment taken counter when marking dose as taken multiple times", async () => {
    const clientId = "client";
    const medication = {
      client: clientId,
      sortKey: "000001734537600:Aspirin:5", // Already taken 5 times
      name: "Aspirin",
      schedule: 8, // 08:00
      recurrence: "daily" as const,
      active: true,
      createdAt: Math.floor(Date.now() / 1000) - 86400,
    };

    mockSendFn
      .mockResolvedValueOnce({
        Items: [medication],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const result = await markDoseTaken(clientId, medication.sortKey);

    const newSortKeyParts = result.sortKey.split(":");
    const takenCount = Number.parseInt(newSortKeyParts[2]);
    expect(takenCount).toBe(6);
  });

  it("should calculate correct next dose time after taking current dose", async () => {
    const clientId = "client";
    const now = new Date();
    const currentHour = now.getHours();

    // Schedule for +2 hours from now
    const scheduleHour = (currentHour + 2) % 24;

    const medication = {
      client: clientId,
      sortKey: "000001734537600:DailyMed:0",
      name: "DailyMed",
      schedule: scheduleHour,
      recurrence: "daily" as const,
      active: true,
      createdAt: Math.floor(Date.now() / 1000) - 86400,
    };

    mockSendFn
      .mockResolvedValueOnce({
        Items: [medication],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const result = await markDoseTaken(clientId, medication.sortKey);

    // Extract new nextDoseTime from sortKey
    const newSortKeyParts = result.sortKey.split(":");
    const newNextDoseTime = Number.parseInt(newSortKeyParts[0]);

    // Should be a valid timestamp
    expect(newNextDoseTime).toBeGreaterThan(0);
    expect(Number.isNaN(newNextDoseTime)).toBe(false);

    // Should be in the future
    const currentTime = Math.floor(Date.now() / 1000);
    expect(newNextDoseTime).toBeGreaterThan(currentTime);
  });

  it("should throw error when medication is not found", async () => {
    const clientId = "client";
    const sortKey = "000001734537600:NonExistent:0";

    mockSendFn.mockResolvedValueOnce({
      Items: [], // No medication found
    });

    await expect(markDoseTaken(clientId, sortKey)).rejects.toThrow("Medication not found");
  });
});

describe("dynamodb - queryMedications", () => {
  beforeEach(() => {
    mockSendFn.mockReset();
    process.env.TABLE_NAME = "test-table";
  });

  it("should return only active medications when activeOnly is true", async () => {
    const medications = [
      {
        client: "client",
        sortKey: "000001734537600:Med1:0",
        name: "Med1",
        schedule: 8, // 08:00
        recurrence: "daily",
        active: true,
        createdAt: 1734537600,
      },
      {
        client: "client",
        sortKey: "000001734537700:Med2:0",
        name: "Med2",
        schedule: 9, // 09:00
        recurrence: "daily",
        active: false,
        createdAt: 1734537600,
      },
    ];

    mockSendFn.mockResolvedValueOnce({
      Items: medications,
    });

    const result = await queryMedications("client", true);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Med1");
    expect(result[0].active).toBe(true);
  });

  it("should return all medications when activeOnly is false", async () => {
    const medications = [
      {
        client: "client",
        sortKey: "000001734537600:Med1:0",
        name: "Med1",
        schedule: 8, // 08:00
        recurrence: "daily",
        active: true,
        createdAt: 1734537600,
      },
      {
        client: "client",
        sortKey: "000001734537700:Med2:0",
        name: "Med2",
        schedule: 9, // 09:00
        recurrence: "daily",
        active: false,
        createdAt: 1734537600,
      },
    ];

    mockSendFn.mockResolvedValueOnce({
      Items: medications,
    });

    const result = await queryMedications("client", false);

    expect(result).toHaveLength(2);
  });

  it("should return medications sorted by nextDoseTime (from sortKey)", async () => {
    const medications = [
      {
        client: "client",
        sortKey: "000001734537600:Med1:0", // Earlier time
        name: "Med1",
        schedule: 8, // 08:00
        recurrence: "daily",
        active: true,
        createdAt: 1734537600,
      },
      {
        client: "client",
        sortKey: "000001734537800:Med2:0", // Later time
        name: "Med2",
        schedule: 9, // 09:00
        recurrence: "daily",
        active: true,
        createdAt: 1734537600,
      },
    ];

    mockSendFn.mockResolvedValueOnce({
      Items: medications,
    });

    const result = await queryMedications("client", true);

    expect(result[0].name).toBe("Med1");
    expect(result[1].name).toBe("Med2");
  });
});
