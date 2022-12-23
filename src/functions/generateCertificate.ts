import { APIGatewayProxyHandler } from "aws-lambda";
import { document } from "../utils/dynamodbClient";
import { compile } from "handlebars";
import { join } from "path";
import { readFileSync } from "fs";
import chromium from "chrome-aws-lambda";
import { S3 } from "aws-sdk";

interface ICreateCertificate {
	id: string;
	name: string;
	grade: string;
	date: string;
};

interface ITemplate {
	id: string;
	name: string;
	grade: string;
	medal: string;
	date: string;
};

const templateGenerator = async (data: ITemplate) => {
	const filePath = join(process.cwd(), "src", "templates", "certificate.hbs");
	const html = readFileSync(filePath, "utf-8");

	return compile(html)(data);
}

export const handler: APIGatewayProxyHandler = async (event) => {
	const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;
	const s3 = new S3();
	
	const { Items } = await document.query({
		TableName: "users-certificate",
		KeyConditionExpression: "id = :id",
		ExpressionAttributeValues: {
			":id": id
		}
	}).promise();

	if (Items[0]) {
		throw new Error("User already exists.")
	}

	await document.put({
		TableName: "users-certificate",
		Item: {
			id,
			name,
			grade,
			date: new Date().toLocaleDateString()
		},
	}).promise();

	const filePath = join(process.cwd(), "src", "templates", "selo.png");
	const medal = readFileSync(filePath, "base64");

	const data: ITemplate = {
		id,
		name,
		grade,
		medal,
		date: new Date().toLocaleDateString()
	}

	const template = await templateGenerator(data);

	const browser = await chromium.puppeteer.launch({
		args: chromium.args,
		defaultViewport: chromium.defaultViewport,
		executablePath: await chromium.executablePath,
	})

	const page = await browser.newPage();

	await page.setContent(template)

	const pdf = await page.pdf({
		format: "a4",
		landscape: true,
		printBackground: true,
		preferCSSPageSize: true,
		path: process.env.IS_OFFLINE ? "./certificate.dpf" : null
	});

	await browser.close();

	await s3.putObject({
		Bucket: "generate-certificates-bucket",
		Key: `${id}.pdf`,
		ACL: "public-read-write",
		Body: pdf,
		ContentType: "application/pdf"
	}).promise();

	return {
		statusCode: 201,
		body: JSON.stringify({
			url: `https://generate-certificates-bucket.s3.amazonaws.com/${id}.pdf`
		})
	};
}