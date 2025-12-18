import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "";

export type Medication = {
  client: string;
  sortKey: string; // nextDoseTime:name
  name: string;
  schedule: number; // Hour in 24-hour format (0-23)
  recurrence: "daily" | "weekly";
  active: boolean;
  createdAt: number;
  lastTaken?: number;
};

export async function queryMedications(clientId: string = "client", activeOnly: boolean = true) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "client = :client",
    ExpressionAttributeValues: {
      ":client": clientId,
    },
    ScanIndexForward: true, // Ascending order - earliest dose first (since sortKey starts with nextDoseTime)
  });

  const result = await docClient.send(command);
  let items = (result.Items || []) as Medication[];

  if (activeOnly) {
    items = items.filter(item => item.active !== false);
  }

  // Items are already sorted by nextDoseTime (from sortKey) due to DynamoDB's natural ordering
  return items;
}

export async function createMedication(medication: Omit<Medication, "client" | "sortKey">) {
  const createdAt = medication.createdAt || Math.floor(Date.now() / 1000);

  // Calculate next dose time
  const nextDoseTime = calculateNextDoseTime(
    medication.schedule,
    medication.recurrence,
  );

  // New sortKey format: nextDoseTime:name
  // Zero-pad nextDoseTime to ensure proper lexicographic sorting
  const sortKey = `${String(nextDoseTime).padStart(15, "0")}:${medication.name}`;

  const item: Medication = {
    client: "client",
    sortKey,
    ...medication,
    createdAt,
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  });

  await docClient.send(command);
  return { ...item, nextDoseTime };
}

export async function updateMedication(clientId: string, sortKey: string, updates: Partial<Medication>) {
  const updateExpression: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    if (key !== "client" && key !== "sortKey") {
      updateExpression.push(`#attr${index} = :val${index}`);
      expressionAttributeNames[`#attr${index}`] = key;
      expressionAttributeValues[`:val${index}`] = value;
    }
  });

  if (updateExpression.length === 0) {
    throw new Error("No valid fields to update");
  }

  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      client: clientId,
      sortKey,
    },
    UpdateExpression: `SET ${updateExpression.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  });

  const result = await docClient.send(command);
  return result.Attributes as Medication;
}

export async function markDoseTaken(clientId: string, sortKey: string) {
  const lastTaken = Math.floor(Date.now() / 1000);

  // First, get the current medication to access its properties
  const medications = await queryMedications(clientId, false);
  const medication = medications.find(m => m.sortKey === sortKey);

  if (!medication) {
    throw new Error("Medication not found");
  }

  // Calculate new next dose time after taking this dose
  const newNextDoseTime = calculateNextDoseTime(
    medication.schedule,
    medication.recurrence,
    lastTaken,
  );

  // Parse current sortKey to get the name
  const parts = sortKey.split(":");
  const name = parts[1];

  // Create new sortKey with updated nextDoseTime
  const newSortKey = `${String(newNextDoseTime).padStart(15, "0")}:${name}`;

  // Delete old item
  const deleteCommand = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      client: clientId,
      sortKey,
    },
  });

  await docClient.send(deleteCommand);

  // Create new item with updated sortKey and lastTaken
  const newItem: Medication = {
    ...medication,
    sortKey: newSortKey,
    lastTaken,
  };

  const putCommand = new PutCommand({
    TableName: TABLE_NAME,
    Item: newItem,
  });

  await docClient.send(putCommand);

  return newItem;
}

/**
 * Validates schedule format
 * Expected: A number between 0-23 representing the hour in 24-hour format
 */
export function validateScheduleFormat(schedule: number): boolean {
  return typeof schedule === "number" && schedule >= 0 && schedule <= 23 && Number.isInteger(schedule);
}

/**
 * Calculate the next dose time based on schedule and recurrence
 * Returns Unix timestamp in seconds
 */
export function calculateNextDoseTime(
  schedule: number,
  recurrence: "daily" | "weekly",
  _lastTaken?: number,
): number {
  const now = new Date();
  const nowInSeconds = Math.floor(now.getTime() / 1000);

  // Create a date for today at the scheduled hour
  const scheduledTimeToday = new Date(now);
  scheduledTimeToday.setHours(schedule, 0, 0, 0);
  const scheduledTimeTodayInSeconds = Math.floor(scheduledTimeToday.getTime() / 1000);

  // If the scheduled time today hasn't passed yet, return it
  if (scheduledTimeTodayInSeconds > nowInSeconds) {
    return scheduledTimeTodayInSeconds;
  }

  // Otherwise, add the recurrence period
  if (recurrence === "daily") {
    // Return scheduled time tomorrow
    return scheduledTimeTodayInSeconds + (24 * 60 * 60);
  }
  else {
    // Weekly - return scheduled time next week
    return scheduledTimeTodayInSeconds + (7 * 24 * 60 * 60);
  }
}
