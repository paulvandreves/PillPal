import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import type { Medication } from "./dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "";

/**
 * Query medications taken after a given timestamp
 * Uses GSI: timestamp-index
 */
export async function queryMedicationsTakenAfter(docClient: DynamoDBDocumentClient, clientId: string, timestamp: number): Promise<Medication[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "timestamp-index",
    KeyConditionExpression: "client = :client AND lastTaken > :timestamp",
    ExpressionAttributeValues: {
      ":client": clientId,
      ":timestamp": timestamp,
    },
  });

  const result = await docClient.send(command);
  return (result.Items || []) as Medication[];
}

/**
 * Query medications taken before a given timestamp
 * Uses GSI: timestamp-index
 */
export async function queryMedicationsTakenBefore(docClient: DynamoDBDocumentClient, clientId: string, timestamp: number): Promise<Medication[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "timestamp-index",
    KeyConditionExpression: "client = :client AND lastTaken < :timestamp",
    ExpressionAttributeValues: {
      ":client": clientId,
      ":timestamp": timestamp,
    },
  });

  const result = await docClient.send(command);
  return (result.Items || []) as Medication[];
}

/**
 * Query medications taken between two timestamps
 * Uses GSI: timestamp-index
 */
export async function queryMedicationsTakenBetween(docClient: DynamoDBDocumentClient, clientId: string, startTimestamp: number, endTimestamp: number): Promise<Medication[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "timestamp-index",
    KeyConditionExpression: "client = :client AND lastTaken BETWEEN :start AND :end",
    ExpressionAttributeValues: {
      ":client": clientId,
      ":start": startTimestamp,
      ":end": endTimestamp,
    },
  });

  const result = await docClient.send(command);
  return (result.Items || []) as Medication[];
}
