import AWS from "aws-sdk";

// DynamoDB를 문서지향 형태로 다루는 클라이언트
const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE_MESSAGES = process.env.TABLE_MESSAGES;

export async function handler(event) {
  try {
    const roomId = event.pathParameters?.roomId;
    const limit = parseInt(event.queryStringParameters?.limit || "50", 10);
    const nextToken = event.queryStringParameters?.nextToken


    if (!roomId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing roomId" }),
      };
    }

    // DynamoDB Query
    const params = {
      TableName: TABLE_MESSAGES,
      KeyConditionExpression: "roomId = :roomId", // 해시 키가 일치할 때
      ExpressionAttributeValues: { ":roomId": roomId },
      ScanIndexForward: true, // 정렬키 오름차순 (오래된 -> 최신)
      Limit: limit,
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(
        Buffer.from(nextToken, "base64").toString("utf-8")
      );
    }

    const result = await dynamo.query(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        items: result.Items || [],
        nextToken: result.LastEvaluatedKey
          ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
          : null,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
      headers: { "Content-Type": "application/json" },
    };
  }
}
