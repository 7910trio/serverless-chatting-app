const AWS = require("aws-sdk");

const dynamo = new AWS.DynamoDB.DocumentClient();
// 채팅 메시지 저장 테이블
const TABLE_MESSAGES = process.env.TABLE_MESSAGES || "ChatMessages";
// WebSocket 연결 정보 테이블
const TABLE_CONNECTIONS = process.env.TABLE_CONNECTIONS || "Connections";
// WebSocket API Gateway 엔드포인트
const apigw = new AWS.ApiGatewayManagementApi({
  apiVersion: "2018-11-29",
  endpoint: event.requestContext.domainName + "/" + event.requestContext.stage,
});

module.exports.handler = async function(event) {
  const { requestContext, body } = event;
  const connectionId = requestContext.connectionId; // 웹소켓 열결 고유 ID
  const routeKey = requestContext.routeKey; // 웹소켓 이벤트 타입 : $connect, $disconnect, default

  try {
    // 클라이언트가 웹소켓 서버와 TCP 연결을 맺음
    // 앱만 켜고 아직 어떤 채팅방에도 참여하지 않은 상태
    if (routeKey === "$connect") {
        // 연결되었을 때 별도의 DB 등록은 하지 않고 로그만 남김
        console.log("Connect:", connectionId);
        return { statusCode: 200 };
    }

    if (routeKey === "$disconnect") {
        // 연결 종료 시 DB Connections 테이블에서 해당 connectionId 제거
        await removeConnection(connectionId);
        console.log("Disconnect:", connectionId);
        return { statusCode: 200 };
    }

    // default route : 메시지 처리
    const payload = JSON.parse(body);
    const { action, roomId, text, nickname } = payload;

    // 채팅방 참여
    if (action === "join") {
        // 연결과 방 매핑을 DB에 저장
        // 이후 메시지 브로드캐스트 시 해당 roomId의 연결만 조회
        await addConnection(roomId, connectionId);
        console.log(`${nickname} joined room ${roomId}`);
        return { statusCode: 200 };
    }

    // 메시지 전송
    if (action === "sendMessage") {
        const timestamp = Date.now();
        const item = { roomId, timestamp, nickname, text, type: "message" };
        // 1. 메시지를 DB ChatMessages 테이블에 저장
        await dynamo.put({ TableName: TABLE_MESSAGES, Item: item }).promise();

        // 2. 해당 방(roomId)에 연결된 클라이언트 목록 조회
        const connections = await getConnections(roomId); 

        // 3. 모든 방 참여자에게 메시지 브로드캐스트
        const sendPromises = connections.map((conn) =>
        apigw
            .postToConnection({ ConnectionId: conn.connectionId, Data: JSON.stringify(item) })
            .promise()
            .catch(async (err) => {
            console.warn("Send failed, removing connection", conn.connectionId, err.message);
            // 브로드캐스트 실패 시 연결 제거
            await removeConnection(conn.connectionId);
            })
        );
        await Promise.all(sendPromises);

        return { statusCode: 200 };
    }

    return { statusCode: 400, body: "Unknown action" };
    } catch (err) {
      console.error(err);
      return { statusCode: 500, body: err.message };
  }
}

// 연결 관리 함수

// 연결 + 방 매핑 저장
async function addConnection(roomId, connectionId) {
  await dynamo
    .put({ TableName: TABLE_CONNECTIONS, Item: { roomId, connectionId } })
    .promise();
}

// 연결 제거
async function removeConnection(connectionId) {
  // Connection 테이블에서 connectionId를 가진 항목 삭제
  const scanRes = await dynamo
    .scan({ TableName: TABLE_CONNECTIONS, FilterExpression: "connectionId = :c", ExpressionAttributeValues: { ":c": connectionId } })
    .promise();

  const deletePromises = scanRes.Items.map((item) =>
    dynamo
      .delete({ TableName: TABLE_CONNECTIONS, Key: { roomId: item.roomId, connectionId: item.connectionId } })
      .promise()
  );
  await Promise.all(deletePromises);
}


// 방(roomId)에 연결된 모든 클라이언트 조회
async function getConnections(roomId) {
  const res = await dynamo
    .query({ TableName: TABLE_CONNECTIONS, KeyConditionExpression: "roomId = :r", ExpressionAttributeValues: { ":r": roomId } })
    .promise();
  return res.Items || [];
}
