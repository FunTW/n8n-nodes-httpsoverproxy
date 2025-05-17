import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import axios, { AxiosRequestConfig } from 'axios';
import * as https from 'https';
import * as http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { IDataObject } from 'n8n-workflow';

/**
 * 聲明式 HttpsOverProxy 節點
 * 通過 HTTP 代理發送 HTTPS 請求，解決常見的 400 錯誤
 */
export class HttpsOverProxyDeclarative implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HTTPS Over Proxy',
		name: 'httpsOverProxy',
		icon: 'file:HttpsOverProxy/images/globeProxy.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["method"] + ": " + $parameter["url"]}}',
		description: 'Make HTTPS requests through HTTP proxy',
		defaults: {
			name: 'HTTPS Over Proxy',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'httpBasicAuth',
				required: false,
				displayOptions: {
					show: {
						authentication: ['basicAuth'],
					},
				},
			},
			{
				name: 'httpDigestAuth',
				required: false,
				displayOptions: {
					show: {
						authentication: ['digestAuth'],
					},
				},
			},
			{
				name: 'httpHeaderAuth',
				required: false,
				displayOptions: {
					show: {
						authentication: ['headerAuth'],
					},
				},
			},
			{
				name: 'httpQueryAuth',
				required: false,
				displayOptions: {
					show: {
						authentication: ['queryAuth'],
					},
				},
			},
			{
				name: 'oAuth1Api',
				required: false,
				displayOptions: {
					show: {
						authentication: ['oAuth1'],
					},
				},
			},
			{
				name: 'oAuth2Api',
				required: false,
				displayOptions: {
					show: {
						authentication: ['oAuth2'],
					},
				},
			},
		],
		properties: [
			{
				displayName: '',
				name: 'curlImport',
				type: 'curlImport',
				default: '',
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'options',
				options: [
					{
						name: 'DELETE',
						value: 'DELETE',
					},
					{
						name: 'GET',
						value: 'GET',
					},
					{
						name: 'HEAD',
						value: 'HEAD',
					},
					{
						name: 'OPTIONS',
						value: 'OPTIONS',
					},
					{
						name: 'PATCH',
						value: 'PATCH',
					},
					{
						name: 'POST',
						value: 'POST',
					},
					{
						name: 'PUT',
						value: 'PUT',
					},
				],
				default: 'GET',
				description: 'The request method to use',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				placeholder: 'https://example.com',
				description: 'The URL to make the request to',
				required: true,
			},
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'None',
						value: 'none',
					},
					{
						name: 'Basic Auth',
						value: 'basicAuth',
					},
					{
						name: 'Digest Auth',
						value: 'digestAuth',
					},
					{
						name: 'Header Auth',
						value: 'headerAuth',
					},
					{
						name: 'OAuth1',
						value: 'oAuth1',
					},
					{
						name: 'OAuth2',
						value: 'oAuth2',
					},
					{
						name: 'Query Auth',
						value: 'queryAuth',
					},
				],
				default: 'none',
				description: 'The authentication to use',
			},
			{
				displayName: 'Send Query Parameters',
				name: 'sendQuery',
				type: 'boolean',
				default: false,
				description: 'Whether the request has query params or not',
			},
			{
				displayName: 'Specify Query Parameters',
				name: 'specifyQuery',
				type: 'options',
				displayOptions: {
					show: {
						sendQuery: [true],
					},
				},
				options: [
					{
						name: 'Using Fields Below',
						value: 'keypair',
					},
					{
						name: 'Using JSON',
						value: 'json',
					},
				],
				default: 'keypair',
			},
			{
				displayName: 'Query Parameters',
				name: 'queryParameters',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						sendQuery: [true],
						specifyQuery: ['keypair'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Parameter',
				default: {
					parameters: [
						{
							name: '',
							value: '',
						},
					],
				},
				options: [
					{
						name: 'parameters',
						displayName: 'Parameters',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Query Parameters (JSON)',
				name: 'queryParametersJson',
				type: 'json',
				displayOptions: {
					show: {
						sendQuery: [true],
						specifyQuery: ['json'],
					},
				},
				default: '',
				description: 'Query parameters as JSON (flat object). Pair of key and value.',
			},
			{
				displayName: 'Send Headers',
				name: 'sendHeaders',
				type: 'boolean',
				default: false,
				description: 'Whether the request has headers or not',
			},
			{
				displayName: 'Specify Headers',
				name: 'specifyHeaders',
				type: 'options',
				displayOptions: {
					show: {
						sendHeaders: [true],
					},
				},
				options: [
					{
						name: 'Using Fields Below',
						value: 'keypair',
					},
					{
						name: 'Using JSON',
						value: 'json',
					},
				],
				default: 'keypair',
			},
			{
				displayName: 'Header Parameters',
				name: 'headerParameters',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						sendHeaders: [true],
						specifyHeaders: ['keypair'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Header',
				default: {
					parameters: [
						{
							name: '',
							value: '',
						},
					],
				},
				options: [
					{
						name: 'parameters',
						displayName: 'Parameters',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Headers (JSON)',
				name: 'headersJson',
				type: 'json',
				displayOptions: {
					show: {
						sendHeaders: [true],
						specifyHeaders: ['json'],
					},
				},
				default: '',
				description: 'Header parameters as JSON (flat object). Pair of key and value.',
			},
			{
				displayName: 'Send Body',
				name: 'sendBody',
				type: 'boolean',
				default: false,
				description: 'Whether the request has a body or not',
			},
			{
				displayName: 'Content Type',
				name: 'contentType',
				type: 'options',
				displayOptions: {
					show: {
						sendBody: [true],
					},
				},
				options: [
					{
						name: 'Form-Data Multipart',
						value: 'multipart-form-data',
					},
					{
						name: 'Form-Encoded',
						value: 'form-urlencoded',
					},
					{
						name: 'JSON',
						value: 'json',
					},
					{
						name: 'RAW',
						value: 'raw',
					},
					{
						name: 'Binary',
						value: 'binary',
					},
				],
				default: 'json',
				description: 'Content-Type to use for the request',
			},
			{
				displayName: 'Specify Body',
				name: 'specifyBody',
				type: 'options',
				displayOptions: {
					show: {
						sendBody: [true],
						contentType: ['json', 'form-urlencoded'],
					},
				},
				options: [
					{
						name: 'Using Fields Below',
						value: 'keypair',
					},
					{
						name: 'Using JSON',
						value: 'json',
					},
				],
				default: 'keypair',
			},
			{
				displayName: 'Body Parameters',
				name: 'bodyParameters',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						sendBody: [true],
						contentType: ['json', 'form-urlencoded'],
						specifyBody: ['keypair'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Parameter',
				default: {
					parameters: [
						{
							name: '',
							value: '',
						},
					],
				},
				options: [
					{
						name: 'parameters',
						displayName: 'Parameters',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Body Parameters (JSON)',
				name: 'bodyParametersJson',
				type: 'json',
				displayOptions: {
					show: {
						sendBody: [true],
						contentType: ['json', 'form-urlencoded'],
						specifyBody: ['json'],
					},
				},
				default: '',
				description: 'Body parameters as JSON.',
			},
			{
				displayName: 'Body',
				name: 'rawBody',
				type: 'string',
				displayOptions: {
					show: {
						sendBody: [true],
						contentType: ['raw'],
					},
				},
				default: '',
				description: 'The request body',
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						sendBody: [true],
						contentType: ['binary'],
					},
				},
				description: 'The name of the binary property which contains the data for the request',
			},
			{
				displayName: 'Form Data',
				name: 'formData',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						sendBody: [true],
						contentType: ['multipart-form-data'],
					},
				},
				typeOptions: {
					multipleValues: true,
				},
				placeholder: 'Add Form Field',
				default: {
					fields: [
						{
							type: 'text',
							name: '',
							value: '',
						},
					],
				},
				options: [
					{
						name: 'fields',
						displayName: 'Fields',
						values: [
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								options: [
									{
										name: 'Text',
										value: 'text',
									},
									{
										name: 'File',
										value: 'file',
									},
								],
								default: 'text',
								description: 'The type of form field',
							},
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'The name of form field',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										type: ['text'],
									},
								},
								description: 'The value of form field',
							},
							{
								displayName: 'Input Binary Field',
								name: 'binaryPropertyName',
								type: 'string',
								default: 'data',
								displayOptions: {
									show: {
										type: ['file'],
									},
								},
								description: 'The name of the binary property which contains the data for the request',
							},
						],
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Proxy',
						name: 'proxy',
						type: 'collection',
						placeholder: 'Add Proxy Config',
						default: {},
						options: [
							{
								displayName: 'Proxy Settings',
								name: 'settings',
								type: 'collection',
								placeholder: 'Add Proxy Setting',
								default: {},
								options: [
									{
										displayName: 'Proxy URL',
										name: 'proxyUrl',
										type: 'string',
										default: '',
										placeholder: 'http://myproxy:3128',
										description: 'HTTP proxy server URL (can be with or without protocol)',
									},
									{
										displayName: 'Proxy Authentication',
										name: 'proxyAuth',
										type: 'boolean',
										default: false,
										description: 'Whether the proxy requires authentication',
									},
									{
										displayName: 'Proxy Username',
										name: 'proxyUsername',
										type: 'string',
										default: '',
										displayOptions: {
											show: {
												proxyAuth: [true],
											},
										},
										description: 'Proxy username',
									},
									{
										displayName: 'Proxy Password',
										name: 'proxyPassword',
										type: 'string',
										default: '',
										typeOptions: {
											password: true,
										},
										displayOptions: {
											show: {
												proxyAuth: [true],
											},
										},
										description: 'Proxy password',
									},
								],
							},
						],
					},
					{
						displayName: 'Allow Unauthorized Certificates',
						name: 'allowUnauthorizedCerts',
						type: 'boolean',
						default: false,
						description: 'Whether to connect even if SSL certificate validation is not possible',
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						type: 'options',
						options: [
							{
								name: 'Autodetect',
								value: 'autodetect',
							},
							{
								name: 'String',
								value: 'string',
							},
							{
								name: 'JSON',
								value: 'json',
							},
						],
						default: 'autodetect',
						description: 'The format in which the data gets returned from the URL',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						default: 30000,
						description: 'Time in ms to wait for the server to send response headers before aborting the request',
					},
					{
						displayName: 'Redirect',
						name: 'redirect',
						type: 'options',
						options: [
							{
								name: 'Follow Redirects',
								value: 'followRedirects',
							},
							{
								name: 'No Redirects',
								value: 'noRedirects',
							},
						],
						default: 'followRedirects',
						description: 'Follow or not 301/302 location header redirect',
					},
					{
						displayName: 'Maximum Redirects',
						name: 'maxRedirects',
						type: 'number',
						default: 5,
						displayOptions: {
							show: {
								redirect: ['followRedirects'],
							},
						},
						description: 'Maximum number of redirects to follow',
					},
					{
						displayName: 'Never Error',
						name: 'neverError',
						type: 'boolean',
						default: false,
						description: 'Returns response even when status code is not 2xx',
					},
					{
						displayName: 'Full Response',
						name: 'fullResponse',
						type: 'boolean',
						default: false,
						description: 'Returns the full response data instead of only the body',
					},
					{
						displayName: 'Lowercase Headers',
						name: 'lowercaseHeaders',
						type: 'boolean',
						default: true,
						description: 'Whether to lowercase response header keys',
					},
					{
						displayName: 'Output Field Name',
						name: 'outputFieldName',
						type: 'string',
						default: 'data',
						description: 'Name of the binary field to output the data to',
						displayOptions: {
							show: {
								responseFormat: ['string'],
							},
						},
					},
					{
						displayName: 'Batching',
						name: 'batching',
						type: 'collection',
						placeholder: 'Add Batching Options',
						default: {},
						options: [
							{
								displayName: 'Batch Size',
								name: 'batch',
								type: 'collection',
								placeholder: 'Configure Batch',
								default: {},
								options: [
									{
										displayName: 'Batch Size',
										name: 'batchSize',
										type: 'number',
										default: 1,
										description: 'Number of items to process at once',
									},
									{
										displayName: 'Batch Interval',
										name: 'batchInterval',
										type: 'number',
										default: 0,
										description: 'Time (in milliseconds) between each batch of requests',
									},
								],
							},
						],
					},
				],
			},
		],
	};

	// 最低限度的骨架實現，稍後會進行重構
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];

		// 記錄節點執行
		console.log('===== HTTPS Over Proxy 聲明式節點執行 =====');

		// 批處理設置
		const batchSize = this.getNodeParameter('options.batching.batch.batchSize', 0, 1) as number;
		const batchInterval = this.getNodeParameter('options.batching.batch.batchInterval', 0, 0) as number;

		// 分批處理項目
		const processBatch = async (startIndex: number): Promise<INodeExecutionData[]> => {
			const batchItems: INodeExecutionData[] = [];
			const endIndex = Math.min(startIndex + batchSize, items.length);

			for (let itemIndex = startIndex; itemIndex < endIndex; itemIndex++) {
				let timeoutId: NodeJS.Timeout | undefined;

				try {
					// 獲取請求方法和 URL
					const requestMethod = this.getNodeParameter('method', itemIndex) as string;
					const url = this.getNodeParameter('url', itemIndex) as string;

					// 獲取選項設置
					const options = this.getNodeParameter('options', itemIndex, {}) as {
						allowUnauthorizedCerts?: boolean;
						fullResponse?: boolean;
						responseFormat?: string;
						outputFieldName?: string;
						timeout?: number;
						lowercaseHeaders?: boolean;
						redirect?: string;
						maxRedirects?: number;
						neverError?: boolean;
						proxy?: {
							settings?: {
								proxyUrl?: string;
								proxyAuth?: boolean;
								proxyUsername?: string;
								proxyPassword?: string;
							}
						}
					};

					// 檢查代理設置
					const proxySettings = options.proxy?.settings;
					const useProxy = !!(proxySettings && proxySettings.proxyUrl && proxySettings.proxyUrl.trim() !== '');

					if (useProxy && (!proxySettings?.proxyUrl)) {
						throw new NodeOperationError(
							this.getNode(),
							'使用代理時，必須提供有效的代理 URL。格式為 http://myproxy:3128',
							{ itemIndex },
						);
					}

					// 處理代理 URL
					let proxyHost = '';
					let proxyPort = 8080; // 預設埠號

					if (useProxy && proxySettings?.proxyUrl) {
						try {
							// 嘗試解析代理 URL
							const proxyUrlObj = new URL(proxySettings.proxyUrl);
							proxyHost = proxyUrlObj.hostname;
							proxyPort = parseInt(proxyUrlObj.port || '8080', 10);
						} catch (_error) {
							// 如果 URL 解析失敗，嘗試直接分割
							const urlParts = proxySettings.proxyUrl.split(':');
							if (urlParts.length === 2) {
								proxyHost = urlParts[0];
								proxyPort = parseInt(urlParts[1], 10) || 8080;
							} else {
								// 不正確的格式
								throw new NodeOperationError(
									this.getNode(),
									`代理 URL 格式不正確: ${proxySettings.proxyUrl}。正確格式應為 http://myproxy:3128 或 myproxy:3128`,
									{ itemIndex },
								);
							}
						}
					}

					// 移除代理主機中可能的協議前綴
					let cleanProxyHost = '';
					if (proxyHost) {
						cleanProxyHost = proxyHost.replace(/^(http|https):\/\//, '');
					}

					// 構建請求選項
					const requestOptions: AxiosRequestConfig = {
						method: requestMethod,
						url,
						headers: {},
						timeout: options.timeout || 30000,
						proxy: false, // 禁用 axios 內建代理處理
					};

					// 使用 AbortController 來控制超時
					const controller = new AbortController();
					requestOptions.signal = controller.signal;

					// 設定超時計時器
					const timeoutMs = options.timeout || 30000;
					timeoutId = setTimeout(() => {
						const timeoutError = new Error(`請求因超時(${timeoutMs}ms)被取消。如果需要更多時間，請增加超時設定值。`);
						const customError = timeoutError as Error & { code: string };
						customError.code = 'TIMEOUT';
						controller.abort(customError as any);
					}, timeoutMs);

					// 處理代理認證
					let proxyAuthHeader = '';
					if (useProxy && proxySettings?.proxyAuth && proxySettings.proxyUsername) {
						const authStr = `${proxySettings.proxyUsername}:${proxySettings.proxyPassword || ''}`;
						proxyAuthHeader = `Basic ${Buffer.from(authStr).toString('base64')}`;
					}

					// 設置 HTTPS 代理代理
					if (useProxy && cleanProxyHost) {
						// 創建 HTTPS 代理代理
						const httpsAgent = new HttpsProxyAgent({
							host: cleanProxyHost,
							port: proxyPort,
							headers: proxyAuthHeader ? { 'Proxy-Authorization': proxyAuthHeader } : undefined,
						});

						// 設置 HTTPS 代理
						requestOptions.httpsAgent = httpsAgent;

						// 設置 HTTP 代理 (用於 HTTP 請求)
						if (url.startsWith('http:')) {
							const httpAgent = new http.Agent();
							requestOptions.httpAgent = httpAgent;
						}
					}

					// 處理未授權證書
					if (options.allowUnauthorizedCerts === true) {
						requestOptions.httpsAgent = new https.Agent({
							rejectUnauthorized: false,
						});
					}

					// 處理重定向
					if (options.redirect === 'followRedirects') {
						requestOptions.maxRedirects = options.maxRedirects || 5;
					} else if (options.redirect === 'noRedirects') {
						requestOptions.maxRedirects = 0;
					}

					// 處理身份驗證
					const authentication = this.getNodeParameter('authentication', itemIndex, 'none') as string;
					let httpBasicAuth: string | undefined;
					let httpDigestAuth: string | undefined;
					let httpHeaderAuth: string | undefined;
					let oAuth1Api: string | undefined;
					let oAuth2Api: string | undefined;

					try {
						if (authentication === 'basicAuth') {
							httpBasicAuth = await this.getCredentials('httpBasicAuth', itemIndex);
						} else if (authentication === 'digestAuth') {
							httpDigestAuth = await this.getCredentials('httpDigestAuth', itemIndex);
						} else if (authentication === 'headerAuth') {
							httpHeaderAuth = await this.getCredentials('httpHeaderAuth', itemIndex);
						} else if (authentication === 'oAuth1') {
							oAuth1Api = await this.getCredentials('oAuth1Api', itemIndex);
						} else if (authentication === 'oAuth2') {
							oAuth2Api = await this.getCredentials('oAuth2Api', itemIndex);
						}
					} catch (error) {
						// 處理無法獲取憑證的情況
						throw new NodeOperationError(this.getNode(), `無法獲取身份驗證憑證: ${error.message}`, { itemIndex });
					}

					// 處理標頭
					const sendHeaders = this.getNodeParameter('sendHeaders', itemIndex, false) as boolean;
					if (sendHeaders) {
						const specifyHeaders = this.getNodeParameter('specifyHeaders', itemIndex, 'keypair') as string;
						
						if (specifyHeaders === 'keypair') {
							const headerParameters = this.getNodeParameter('headerParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
							
							for (const header of headerParameters) {
								if (header.name === '') {
									continue;
								}
								requestOptions.headers![header.name] = header.value;
							}
						} else {
							// JSON 格式的標頭
							const headersJson = this.getNodeParameter('headersJson', itemIndex, '{}') as string;
							
							try {
								const headersObject = JSON.parse(headersJson);
								Object.assign(requestOptions.headers!, headersObject);
							} catch (error) {
								throw new NodeOperationError(this.getNode(), `標頭 JSON 無效: ${error.message}`, { itemIndex });
							}
						}
					}

					// 處理查詢參數
					const sendQuery = this.getNodeParameter('sendQuery', itemIndex, false) as boolean;
					if (sendQuery) {
						const specifyQuery = this.getNodeParameter('specifyQuery', itemIndex, 'keypair') as string;
						let queryParams: IDataObject = {};
						
						if (specifyQuery === 'keypair') {
							const queryParameters = this.getNodeParameter('queryParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
							
							for (const param of queryParameters) {
								if (param.name === '') {
									continue;
								}
								queryParams[param.name] = param.value;
							}
						} else {
							// JSON 格式的查詢參數
							const queryJson = this.getNodeParameter('queryParametersJson', itemIndex, '{}') as string;
							
							try {
								queryParams = JSON.parse(queryJson);
							} catch (error) {
								throw new NodeOperationError(this.getNode(), `查詢參數 JSON 無效: ${error.message}`, { itemIndex });
							}
						}
						
						requestOptions.params = queryParams;
					}

					// 處理請求主體
					const sendBody = this.getNodeParameter('sendBody', itemIndex, false) as boolean;
					if (sendBody) {
						const contentType = this.getNodeParameter('contentType', itemIndex, 'json') as string;
						
						if (contentType === 'json' || contentType === 'form-urlencoded') {
							const specifyBody = this.getNodeParameter('specifyBody', itemIndex, 'keypair') as string;
							let body: IDataObject = {};
							
							if (specifyBody === 'keypair') {
								const bodyParameters = this.getNodeParameter('bodyParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
								
								for (const param of bodyParameters) {
									if (param.name === '') {
										continue;
									}
									body[param.name] = param.value;
								}
							} else {
								// JSON 格式的主體
								const bodyJson = this.getNodeParameter('bodyParametersJson', itemIndex, '{}') as string;
								
								try {
									body = JSON.parse(bodyJson);
								} catch (error) {
									throw new NodeOperationError(this.getNode(), `主體 JSON 無效: ${error.message}`, { itemIndex });
								}
							}
							
							if (contentType === 'json') {
								requestOptions.headers!['Content-Type'] = 'application/json';
								requestOptions.data = body;
							} else {
								requestOptions.headers!['Content-Type'] = 'application/x-www-form-urlencoded';
								const qs = new URLSearchParams();
								
								for (const key of Object.keys(body)) {
									qs.append(key, body[key] as string);
								}
								
								requestOptions.data = qs.toString();
							}
						} else if (contentType === 'raw') {
							const rawBody = this.getNodeParameter('rawBody', itemIndex, '') as string;
							requestOptions.data = rawBody;
						} else if (contentType === 'binary') {
							const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex, 'data') as string;
							const binaryData = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
							
							requestOptions.data = binaryData;
							requestOptions.headers!['Content-Length'] = String(binaryData.length);
						} else if (contentType === 'multipart-form-data') {
							const formData = this.getNodeParameter('formData.fields', itemIndex, []) as Array<{
								type: string;
								name: string;
								value?: string;
								binaryPropertyName?: string;
							}>;
							
							// 創建 FormData 物件
							const formDataObj = new FormData();
							
							for (const field of formData) {
								if (field.name === '') {
									continue;
								}
								
								if (field.type === 'text') {
									formDataObj.append(field.name, field.value || '');
								} else if (field.type === 'file' && field.binaryPropertyName) {
									const binaryData = await this.helpers.getBinaryDataBuffer(itemIndex, field.binaryPropertyName);
									const fileName = items[itemIndex].binary?.[field.binaryPropertyName]?.fileName || 'file';
									
									formDataObj.append(field.name, binaryData, fileName);
								}
							}
							
							requestOptions.data = formDataObj;
						}
					}

					// 發送請求
					let response;
					
					try {
						response = await axios(requestOptions);
					} catch (error) {
						if (error.code === 'TIMEOUT') {
							throw new NodeOperationError(this.getNode(), `請求超時: ${error.message}`, { itemIndex });
						}
						
						// 如果設置了 neverError，即使請求失敗也返回響應
						if (options.neverError === true && error.response) {
							response = error.response;
						} else {
							// 獲取錯誤詳情以提供更有用的錯誤訊息
							if (error.response) {
								// 服務器返回了錯誤狀態碼
								throw new NodeOperationError(
									this.getNode(),
									`請求失敗: 狀態碼 ${error.response.status} - ${error.response.statusText}`,
									{ itemIndex },
								);
							} else if (error.request) {
								// 請求已發送但未收到響應
								throw new NodeOperationError(
									this.getNode(),
									`無法收到響應: ${error.message}。請檢查代理設置和目標服務器是否可用。`,
									{ itemIndex },
								);
							} else {
								// 處理請求設置時發生錯誤
								throw new NodeOperationError(
									this.getNode(),
									`請求設置錯誤: ${error.message}`,
									{ itemIndex },
								);
							}
						}
					} finally {
						if (timeoutId) {
							clearTimeout(timeoutId);
						}
					}

					// 處理響應
					let responseData;
					
					// 根據選項決定如何處理響應
					if (options.fullResponse === true) {
						// 返回完整響應
						let headers = response.headers;
						
						// 將標頭鍵名轉換為小寫
						if (options.lowercaseHeaders === true) {
							headers = Object.keys(headers).reduce(
								(acc, key) => {
									acc[key.toLowerCase()] = headers[key];
									return acc;
								},
								{} as Record<string, string>,
							);
						}
						
						responseData = {
							status: response.status,
							statusText: response.statusText,
							headers,
							config: response.config,
							request: response.request,
							data: response.data,
						};
					} else {
						// 只返回響應主體
						responseData = response.data;
					}

					// 根據響應格式處理數據
					const responseFormat = options.responseFormat || 'autodetect';
					let newItem: INodeExecutionData;
					
					if (responseFormat === 'autodetect') {
						// 自動檢測響應格式
						if (typeof responseData === 'string') {
							try {
								responseData = JSON.parse(responseData);
								newItem = {
									json: responseData,
									pairedItem: { item: itemIndex },
								};
							} catch (error) {
								// 如果不是有效的 JSON，則當作字符串處理
								newItem = {
									json: {
										data: responseData,
									},
									pairedItem: { item: itemIndex },
								};
							}
						} else {
							// 已經是物件或數組
							newItem = {
								json: responseData,
								pairedItem: { item: itemIndex },
							};
						}
					} else if (responseFormat === 'string') {
						// 將響應作為字符串處理
						const outputPropertyName = options.outputFieldName || 'data';
						
						if (Buffer.isBuffer(responseData)) {
							// 處理二進制數據
							newItem = {
								json: {
									[outputPropertyName]: responseData.toString('utf-8'),
								},
								pairedItem: { item: itemIndex },
							};
						} else if (typeof responseData === 'object') {
							// 將物件轉換為字符串
							newItem = {
								json: {
									[outputPropertyName]: JSON.stringify(responseData),
								},
								pairedItem: { item: itemIndex },
							};
						} else {
							// 其他情況作為字符串處理
							newItem = {
								json: {
									[outputPropertyName]: String(responseData),
								},
								pairedItem: { item: itemIndex },
							};
						}
					} else {
						// JSON 格式
						if (typeof responseData === 'string') {
							try {
								responseData = JSON.parse(responseData);
							} catch (error) {
								throw new NodeOperationError(
									this.getNode(),
									`響應不是有效的 JSON: ${error.message}`,
									{ itemIndex },
								);
							}
						}
						
						newItem = {
							json: responseData,
							pairedItem: { item: itemIndex },
						};
					}
					
					batchItems.push(newItem);
				} catch (error) {
					// 清除超時計時器
					if (timeoutId) {
						clearTimeout(timeoutId);
					}
					
					// 錯誤處理
					if (this.continueOnFail()) {
						batchItems.push({
							json: {
								error: error.message,
							},
							pairedItem: { item: itemIndex },
						});
						continue;
					}
					throw error;
				}
			}
			
			return batchItems;
		};

		// 處理所有批次
		try {
			for (let i = 0; i < items.length; i += batchSize) {
				if (i !== 0 && batchInterval > 0) {
					// 在批次之間等待指定的時間間隔
					await new Promise(resolve => setTimeout(resolve, batchInterval));
				}
				
				const batchItems = await processBatch(i);
				returnItems.push(...batchItems);
			}
		} catch (error) {
			if (this.continueOnFail()) {
				return [items];
			}
			throw error;
		}

		return [returnItems];
	}
} 