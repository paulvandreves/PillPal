import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "";

export type Medication = {
  client: string;
  sortKey: string; // medicationId:doseId:takentimestamp
  name: string;
  schedule: string;
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
  });

  const result = await docClient.send(command);
  let items = (result.Items || []) as Medication[];

  if (activeOnly) {
    items = items.filter(item => item.active !== false);
  }

  // Sort by createdAt descending
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return items;
}

export async function createMedication(medication: Omit<Medication, "client" | "sortKey">) {
  const medicationId = `med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const doseId = `dose-${Date.now()}`;
  const sortKey = `${medicationId}:${doseId}:0`;

  const item: Medication = {
    client: "client",
    sortKey,
    ...medication,
    createdAt: medication.createdAt || Math.floor(Date.now() / 1000),
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  });

  await docClient.send(command);
  return { ...item, medicationId, doseId };
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
  return updateMedication(clientId, sortKey, { lastTaken });
}
