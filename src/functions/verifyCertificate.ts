import { APIGatewayProxyHandler } from "aws-lambda";
import { document } from "../utils/dynamodbClient";

export const handler: APIGatewayProxyHandler = async (event) => {
	const { id } = event.pathParameters;

	const { Items } = await document.query({
		TableName: "users-certificate",
		KeyConditionExpression: "id = :id",
		ExpressionAttributeValues: {
			":id": id
		}
	}).promise();

	if (!Items[0]) {
		return {
			statusCode: 404,
			body: JSON.stringify({
				message: "Certificate not found."
			})
		}
	};

	return {
		statusCode: 201,
		body: JSON.stringify({
			message: "Certificate is valid.",
			url: `https://generate-certificates-bucket.s3.amazonaws.com/${id}.pdf`
		})
	}
};
