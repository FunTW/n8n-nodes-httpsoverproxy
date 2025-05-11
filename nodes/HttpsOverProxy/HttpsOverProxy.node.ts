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

export class HttpsOverProxy implements INodeType {
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
						displayName: 'Parameter',
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
			},
			{
				displayName: 'Send Body',
				name: 'sendBody',
				type: 'boolean',
				default: true,
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
						name: 'JSON',
						value: 'json',
					},
					{
						name: 'Form-Urlencoded',
						value: 'form-urlencoded',
					},
					{
						name: 'Form-Data (Multipart)',
						value: 'multipart-form-data',
					},
					{
						name: 'Raw',
						value: 'raw',
					},
				],
				default: 'json',
				description: 'Content-Type to use to send body parameters',
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
						displayName: 'Parameter',
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
			},
			{
				displayName: 'Body',
				name: 'body',
				type: 'string',
				displayOptions: {
					show: {
						sendBody: [true],
						contentType: ['raw', 'multipart-form-data'],
					},
				},
				default: '',
				description: 'The raw body to send',
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
				displayName: 'Headers',
				name: 'headers',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				displayOptions: {
					show: {
						sendHeaders: [true],
						specifyHeaders: ['keypair'],
					},
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
						displayName: 'Header',
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
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Allow Internal Network Access',
						name: 'allowInternalNetworkAccess',
						type: 'boolean',
						default: false,
						description: '是否允許訪問內部網絡地址 (localhost, 127.0.0.1, 192.168.x.x 等)。出於安全考慮，預設禁止訪問內部網絡。',
					},
					{
						displayName: 'Batching',
						name: 'batching',
						placeholder: 'Add Batching',
						type: 'fixedCollection',
						default: {
							batch: {},
						},
						options: [
							{
								name: 'batch',
								displayName: 'Batch',
								values: [
									{
										displayName: 'Items per Batch',
										name: 'batchSize',
										type: 'number',
										typeOptions: {
											minValue: 1,
										},
										default: 1,
										description: 'Number of items to process at once',
									},
									{
										displayName: 'Batch Interval',
										name: 'batchInterval',
										type: 'number',
										typeOptions: {
											minValue: 0,
										},
										default: 0,
										description:
											'Time (in milliseconds) between each batch of requests. 0 for no delay.',
									},
								],
							},
						],
					},
					{
						displayName: 'Proxy',
						name: 'proxy',
						type: 'fixedCollection',
						placeholder: 'Add Proxy Config',
						default: {
							settings: {},
						},
						options: [
							{
								name: 'settings',
								displayName: 'Settings',
								values: [
									{
										displayName: 'Use Proxy',
										name: 'useProxy',
										type: 'boolean',
										default: true,
										description: 'Whether to use a proxy server',
									},
									{
										displayName: 'Proxy Host',
										name: 'proxyHost',
										type: 'string',
										displayOptions: {
											show: {
												useProxy: [true],
											},
										},
										default: '',
										placeholder: 'localhost',
										description:
											'Proxy Host (without http:// or https://)',
									},
									{
										displayName: 'Proxy Port',
										name: 'proxyPort',
										type: 'number',
										displayOptions: {
											show: {
												useProxy: [true],
											},
										},
										default: 8080,
										description: 'Proxy Port',
									},
									{
										displayName: 'Proxy Authentication',
										name: 'proxyAuth',
										type: 'boolean',
										displayOptions: {
											show: {
												useProxy: [true],
											},
										},
										default: false,
										description: 'Whether the proxy requires authentication',
									},
									{
										displayName: 'Proxy Username',
										name: 'proxyUsername',
										type: 'string',
										displayOptions: {
											show: {
												useProxy: [true],
												proxyAuth: [true],
											},
										},
										default: '',
										description: 'Username for proxy authentication',
									},
									{
										displayName: 'Proxy Password',
										name: 'proxyPassword',
										type: 'string',
										displayOptions: {
											show: {
												useProxy: [true],
												proxyAuth: [true],
											},
										},
										default: '',
										description: 'Password for proxy authentication',
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
						displayName: 'Lowercase Headers',
						name: 'lowercaseHeaders',
						type: 'boolean',
						default: true,
						description: 'Whether to lowercase header names',
					},
					{
						displayName: 'Redirects',
						name: 'redirect',
						type: 'options',
						options: [
							{
								name: 'Follow Redirects',
								value: 'follow',
							},
							{
								name: 'Don\'t Follow Redirects',
								value: 'doNotFollow',
							},
						],
						default: 'follow',
						description: 'Whether to follow redirects or not',
					},
					{
						displayName: 'Max Redirects',
						name: 'maxRedirects',
						type: 'number',
						displayOptions: {
							show: {
								redirect: [
									'follow',
								],
							},
						},
						default: 21,
						description: 'Max number of redirects to follow',
					},
					{
						displayName: 'Full Response',
						name: 'fullResponse',
						type: 'boolean',
						default: false,
						description: 'Whether to return the full response data instead of only the body',
					},
					{
						displayName: 'Never Error',
						name: 'neverError',
						type: 'boolean',
						default: false,
						description: 'Whether to return success even if the request returns an error code (4xx or 5xx)',
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
								name: 'File',
								value: 'file',
							},
							{
								name: 'JSON',
								value: 'json',
							},
							{
								name: 'Text',
								value: 'text',
							},
						],
						default: 'autodetect',
						description: 'The format in which the data gets returned from the URL',
					},
					{
						displayName: 'Put Output in Field',
						name: 'outputFieldName',
						type: 'string',
						displayOptions: {
							show: {
								responseFormat: [
									'file',
									'text',
								],
							},
						},
						default: 'data',
						description: 'The name of the output field to put the binary file data or text in',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 1,
						},
						default: 30000,
						description: '請求超時時間（毫秒）。如果代理或目標網站較慢，請增加此值',
					},
					{
						displayName: 'Pagination',
						name: 'pagination',
						placeholder: 'Add Pagination',
						type: 'fixedCollection',
						default: {},
						options: [
							{
								name: 'paginate',
								displayName: 'Paginate',
								values: [
									{
										displayName: 'Pagination Mode',
										name: 'paginationMode',
										type: 'options',
										options: [
											{
												name: 'Off',
												value: 'off',
											},
											{
												name: 'Update a Parameter in Each Request',
												value: 'updateAParameter',
											},
											{
												name: 'Response Contains Next URL',
												value: 'responseContainsNextUrl',
											},
										],
										default: 'off',
										description: 'How to paginate',
									},
									{
										displayName: 'Parameter Name',
										name: 'parameterName',
										type: 'string',
										displayOptions: {
											show: {
												paginationMode: ['updateAParameter'],
											},
										},
										default: '',
										description: 'The name of the parameter to update with the next page number',
									},
									{
										displayName: 'Parameter Initial Value',
										name: 'initialParameterValue',
										type: 'number',
										displayOptions: {
											show: {
												paginationMode: ['updateAParameter'],
											},
										},
										default: 0,
										description: 'The initial value to set the parameter to',
									},
									{
										displayName: 'Parameter Increment By',
										name: 'incrementBy',
										type: 'number',
										displayOptions: {
											show: {
												paginationMode: ['updateAParameter'],
											},
										},
										default: 1,
										description: 'The amount to increment the parameter by for each page',
									},
									{
										displayName: 'Next URL Expression',
										name: 'nextUrl',
										type: 'string',
										displayOptions: {
											show: {
												paginationMode: ['responseContainsNextUrl'],
											},
										},
										default: '',
										description: 'Expression to extract the next URL from the response. For example: $response.body.next_page_url',
									},
									{
										displayName: 'Max Pages',
										name: 'maxPages',
										type: 'number',
										displayOptions: {
											show: {
												paginationMode: ['updateAParameter', 'responseContainsNextUrl'],
											},
										},
										default: 100,
										description: 'Maximum number of pages to fetch. 0 means unlimited.',
									},
									{
										displayName: 'Stop When Empty Response',
										name: 'stopOnEmpty',
										type: 'boolean',
										displayOptions: {
											show: {
												paginationMode: ['updateAParameter', 'responseContainsNextUrl'],
											},
										},
										default: true,
										description: 'Whether to stop when the response is empty',
									},
								],
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];

		// batching
		const batchSize = this.getNodeParameter('options.batching.batch.batchSize', 0, 1) as number;
		const batchInterval = this.getNodeParameter('options.batching.batch.batchInterval', 0, 0) as number;

		// Process items in batches
		const processBatch = async (startIndex: number): Promise<INodeExecutionData[]> => {
			const returnData: INodeExecutionData[] = [];
			
			const endIndex = Math.min(startIndex + batchSize, items.length);
			
			for (let itemIndex = startIndex; itemIndex < endIndex; itemIndex++) {
				try {
					// 檢查代理設置是否存在
					const proxySettings = this.getNodeParameter('options.proxy.settings', itemIndex, null) as {
						useProxy?: boolean;
						proxyHost?: string;
						proxyPort?: number;
						proxyAuth?: boolean;
						proxyUsername?: string;
						proxyPassword?: string;
					} | null;
					
					if (proxySettings && proxySettings.useProxy && (!proxySettings.proxyHost || !proxySettings.proxyPort)) {
						throw new NodeOperationError(
							this.getNode(),
							'When using a proxy, both host and port must be provided. Please configure the proxy settings in the Options section.',
							{ itemIndex },
						);
					}
					
					// Get parameters for current item
					const requestMethod = this.getNodeParameter('method', itemIndex) as string;
					const url = this.getNodeParameter('url', itemIndex) as string;
					const sendQuery = this.getNodeParameter('sendQuery', itemIndex, false) as boolean;
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
					};
					
					// 移除代理主機中可能的協議前綴
					let cleanProxyHost = '';
					if (proxySettings && proxySettings.proxyHost) {
						cleanProxyHost = proxySettings.proxyHost.replace(/^(http|https):\/\//, '');
					}
					
					// Build request options
					const requestOptions: AxiosRequestConfig = {
						method: requestMethod,
						url,
						headers: {},
						timeout: options.timeout || 30000,
						proxy: false, // 禁用 axios 內建代理處理
					};
					
					// Proxy authentication if needed
					let proxyAuthHeader = '';
					let proxyAuth = '';
					if (proxySettings && proxySettings.proxyAuth) {
						if (proxySettings.proxyUsername && proxySettings.proxyPassword) {
							// 使用更安全的方式處理密碼 - 避免直接在字符串中暴露密碼
							const username = String(proxySettings.proxyUsername);
							const password = String(proxySettings.proxyPassword);
							const auth = Buffer.from(`${username}:${password}`).toString('base64');
							proxyAuthHeader = `Basic ${auth}`;
							proxyAuth = `${username}:${password}`;
							
							// 使用後立即清除密碼變量
							// 注意：這不能完全防止密碼在內存中的存在，但可以減少暴露時間
							setTimeout(() => {
								password.replace(/./g, '*');
							}, 0);
						}
					}
					
					// 驗證URL以防止SSRF攻擊
					try {
						const parsedUrl = new URL(url);
						
						// 檢查是否為內部IP或本地主機
						const hostname = parsedUrl.hostname.toLowerCase();
						if (
							hostname === 'localhost' || 
							hostname === '127.0.0.1' || 
							hostname === '::1' ||
							hostname.startsWith('192.168.') || 
							hostname.startsWith('10.') || 
							(hostname.startsWith('172.') && 
								(parseInt(hostname.split('.')[1], 10) >= 16 && 
								parseInt(hostname.split('.')[1], 10) <= 31))
						) {
							// 如果是內部地址，檢查是否明確允許訪問內部網絡
							const allowInternalNetworkAccess = this.getNodeParameter(
								'options.allowInternalNetworkAccess',
								itemIndex,
								false
							) as boolean;
							
							if (!allowInternalNetworkAccess) {
								throw new Error(
									`安全限制：不允許訪問內部網絡地址 "${hostname}"。如果確實需要訪問內部網絡，請在選項中啟用"允許訪問內部網絡"。`
								);
							}
						}
					} catch (error) {
						if (error.code === 'ERR_INVALID_URL') {
							throw new NodeOperationError(this.getNode(), `無效的URL: ${url}`, { itemIndex });
						}
						throw error;
					}
					
					// Add query parameters if any
					if (sendQuery) {
						const specifyQuery = this.getNodeParameter('specifyQuery', itemIndex, 'keypair') as string;
						if (specifyQuery === 'keypair') {
							const queryParameters = this.getNodeParameter('queryParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
							if (queryParameters.length) {
								const queryParams: Record<string, string> = {};
								for (const parameter of queryParameters) {
									// 確保參數名稱不為空
									if (parameter.name && parameter.name.trim() !== '') {
										queryParams[parameter.name] = parameter.value;
									}
								}
								requestOptions.params = queryParams;
							}
						} else {
							// JSON parameters
							const queryJson = this.getNodeParameter('queryParametersJson', itemIndex, '{}') as string;
							try {
								requestOptions.params = JSON.parse(queryJson);
							} catch (_error) {
								throw new NodeOperationError(this.getNode(), 'Query Parameters (JSON) must be a valid JSON object', { itemIndex });
							}
						}
					}
					
					// Add headers
					const headers: Record<string, string> = {};
					const sendHeaders = this.getNodeParameter('sendHeaders', itemIndex, false) as boolean;
					const lowercaseHeaders = options.lowercaseHeaders !== false; // 默認為 true
					
					if (sendHeaders) {
						const specifyHeaders = this.getNodeParameter('specifyHeaders', itemIndex, 'keypair') as string;
						
						if (specifyHeaders === 'keypair') {
							const headerParameters = this.getNodeParameter('headers.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
							for (const header of headerParameters) {
								// 確保標頭名稱不為空
								if (header.name && header.name.trim() !== '') {
									const headerName = lowercaseHeaders ? header.name.toLowerCase() : header.name;
									headers[headerName] = header.value;
								}
							}
						} else {
							// JSON headers
							const headersJson = this.getNodeParameter('headersJson', itemIndex, '{}') as string;
							try {
								const parsedHeaders = JSON.parse(headersJson);
								// 將解析的頭部合併到 headers 對象中
								for (const key in parsedHeaders) {
									if (Object.prototype.hasOwnProperty.call(parsedHeaders, key)) {
										const headerName = lowercaseHeaders ? key.toLowerCase() : key;
										headers[headerName] = parsedHeaders[key];
									}
								}
							} catch (_error) {
								throw new NodeOperationError(this.getNode(), 'Headers (JSON) must be a valid JSON object', { itemIndex });
							}
						}
					}
					
					// Add proxy auth header if needed
					if (proxyAuthHeader) {
						headers['Proxy-Authorization'] = proxyAuthHeader;
					}
					
					requestOptions.headers = headers;
					
					// Handle body parameters if needed
					if (this.getNodeParameter('sendBody', itemIndex, true) as boolean) {
						
						const contentType = this.getNodeParameter('contentType', itemIndex, 'json') as string;
						
						if (contentType === 'json' || contentType === 'form-urlencoded') {
							const specifyBody = this.getNodeParameter('specifyBody', itemIndex, 'keypair') as string;
							
							if (contentType === 'json') {
								headers['Content-Type'] = 'application/json';
							} else {
								headers['Content-Type'] = 'application/x-www-form-urlencoded';
							}
							
							if (specifyBody === 'keypair') {
								const bodyParameters = this.getNodeParameter('bodyParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
								
								if (bodyParameters.length) {
									const bodyParams: Record<string, string> = {};
									for (const parameter of bodyParameters) {
										// 確保參數名稱不為空
										if (parameter.name && parameter.name.trim() !== '') {
											bodyParams[parameter.name] = parameter.value;
										}
									}
									
									if (contentType === 'json') {
										requestOptions.data = bodyParams;
									} else {
										// Form-urlencoded: Convert to query string
										const queryString = Object.entries(bodyParams)
											.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
											.join('&');
										requestOptions.data = queryString;
									}
								}
							} else {
								// JSON parameters
								const bodyJson = this.getNodeParameter('bodyParametersJson', itemIndex, '{}') as string;
								if (contentType === 'json') {
									try {
										requestOptions.data = JSON.parse(bodyJson);
									} catch (_error) {
										requestOptions.data = bodyJson;
									}
								} else {
									// Form-urlencoded: Use as string
									requestOptions.data = bodyJson;
								}
							}
						} else if (contentType === 'raw' || contentType === 'multipart-form-data') {
							const body = this.getNodeParameter('body', itemIndex, '') as string;
							
							if (contentType === 'raw') {
								requestOptions.data = body;
							} else {
								// Simple implementation of multipart/form-data
								headers['Content-Type'] = 'multipart/form-data';
								requestOptions.data = body;
							}
						}
					}
					
					// 配置代理
					const allowUnauthorizedCerts = options.allowUnauthorizedCerts || false;
					
					// 只有在啟用代理時才使用代理
					if (proxySettings && proxySettings.useProxy && cleanProxyHost) {
						// 配置 HTTPS 代理
						if (url.startsWith('https:')) {
							// 使用 https-proxy-agent 處理 HTTPS over HTTP 代理的問題
							const proxyUrl = proxyAuth 
								? `http://${proxySettings.proxyUsername}:${proxySettings.proxyPassword}@${cleanProxyHost}:${proxySettings.proxyPort || 8080}`
								: `http://${cleanProxyHost}:${proxySettings.proxyPort || 8080}`;
							
							const httpsProxyAgent = new HttpsProxyAgent(proxyUrl, {
								rejectUnauthorized: !allowUnauthorizedCerts,
								timeout: options.timeout || 30000,
							});
							
							// 將代理 agent 應用於請求
							requestOptions.httpsAgent = httpsProxyAgent;
						} else {
							// 使用 HTTP 代理
							const httpAgent = new http.Agent({
								timeout: options.timeout || 30000,
							});
							
							// 設置代理
							requestOptions.proxy = {
								host: cleanProxyHost,
								port: proxySettings.proxyPort || 8080,
								protocol: 'http:',
							};
							
							requestOptions.httpAgent = httpAgent;
						}
					} else if (allowUnauthorizedCerts) {
						// 如果沒有使用代理，但需要忽略SSL問題
						requestOptions.httpsAgent = new https.Agent({
							rejectUnauthorized: !allowUnauthorizedCerts,
							timeout: options.timeout || 30000,
						});
					}
					
					// Set response type
					requestOptions.responseType = 'text';
					
					// Set redirect options
					if (options.redirect === 'doNotFollow') {
						requestOptions.maxRedirects = 0;
					} else if (options.maxRedirects !== undefined) {
						requestOptions.maxRedirects = options.maxRedirects;
					}
					
					// Set never error option
					if (options.neverError === true) {
						requestOptions.validateStatus = () => true;
					}
					
					// Make the request
					const response = await Promise.race([
						axios(requestOptions),
						new Promise<never>((_, reject) => {
							// 強制超時機制，確保即使底層連接沒有超時，也會在指定時間內終止請求
							const timeoutMs = options.timeout || 30000;
							setTimeout(() => {
								reject(new Error(`請求強制超時：${timeoutMs}毫秒內未完成。這是由節點設置的強制超時機制觸發的，而不是由底層HTTP客戶端觸發的。`));
							}, timeoutMs);
						})
					]);
					
					// Process the response
					let responseData;
					const contentType = response.headers['content-type'] || '';
					
					// 獲取響應格式，如果未指定則默認為autodetect
					const responseFormat = options.responseFormat || 'autodetect';
					
					if (responseFormat === 'file') {
						// Handle as binary data
						const outputFieldName = options.outputFieldName || 'data';
						responseData = {} as Record<string, unknown>;
						responseData[outputFieldName] = await this.helpers.prepareBinaryData(
							Buffer.from(response.data),
							undefined,
							contentType,
						);
					} else if (responseFormat === 'json' || (responseFormat === 'autodetect' && contentType.includes('application/json'))) {
						// Handle JSON data
						try {
							responseData = JSON.parse(response.data);
						} catch (_error) {
							if (responseFormat === 'json') {
								throw new NodeOperationError(
									this.getNode(),
									'Response is not valid JSON. Try using "Auto-detect" or "Text" response format.',
									{ itemIndex },
								);
							}
							responseData = response.data;
						}
					} else {
						// Default to text
						if (responseFormat === 'text') {
							const outputFieldName = options.outputFieldName || 'data';
							responseData = {} as Record<string, unknown>;
							responseData[outputFieldName] = response.data;
						} else {
							responseData = response.data;
						}
					}
					
					// Return the response
					let executionData;
					if (options.fullResponse === true) {
						executionData = {
							status: response.status,
							statusText: response.statusText,
							headers: response.headers,
							data: responseData,
						};
					} else {
						executionData = responseData;
					}
					
					// Add the response to the returned items
					returnData.push({
						json: executionData,
						pairedItem: { item: itemIndex },
					});
					
				} catch (error) {
					if (this.continueOnFail()) {
						let errorMessage = error.message;
						
						// 提供更詳細的錯誤信息
						if (errorMessage.includes('tunneling socket could not be established')) {
							const proxySettings = this.getNodeParameter('options.proxy.settings', itemIndex, {}) as {
								proxyHost?: string;
								proxyPort?: number;
							};
							const proxyHost = proxySettings?.proxyHost || '';
							const proxyPort = proxySettings?.proxyPort || 0;
							
							// 檢測代理地址格式錯誤
							if (proxyHost.startsWith('http://') || proxyHost.startsWith('https://')) {
								errorMessage = `代理地址格式錯誤：請不要在代理主機地址中包含協議前綴 (http:// 或 https://)。正確格式應為 "${proxyHost.replace(/^(http|https):\/\//, '')}"，而不是 "${proxyHost}"。`;
							} else if (errorMessage.includes('ENOTFOUND')) {
								errorMessage = `無法連接到代理服務器：找不到主機 "${proxyHost}"。請檢查代理地址是否正確，或嘗試使用IP地址替代域名。`;
							} else if (errorMessage.includes('ECONNREFUSED')) {
								errorMessage = `代理服務器連接被拒絕：${proxyHost}:${proxyPort}。請確認代理服務器正在運行且端口號正確。`;
							} else if (errorMessage.includes('ETIMEDOUT')) {
								errorMessage = `連接代理服務器超時：${proxyHost}:${proxyPort}。請檢查網絡連接或代理服務器是否可用。`;
							}
						} else if (errorMessage.includes('timeout') && error.code === 'ECONNABORTED') {
							// 獲取當前的超時設置
							const currentOptions = this.getNodeParameter('options', itemIndex, {}) as {
								timeout?: number;
							};
							const timeout = currentOptions.timeout || 30000;
							errorMessage = `請求超時：${timeout}毫秒內未收到回應。請檢查網絡連接、代理服務器和目標網站是否正常，或增加超時時間。`;
						} else if (errorMessage.includes('ECONNRESET')) {
							errorMessage = `連接被重置：服務器可能關閉了連接。請檢查目標服務器是否正常運行。`;
						} else if (errorMessage.includes('certificate')) {
							errorMessage = `SSL證書錯誤：${errorMessage}。如果您信任此網站，可以在選項中啟用"忽略SSL問題"。`;
						}
						
						// 創建安全的錯誤對象，避免暴露敏感信息
						let safeUrl = '';
						if (error.config && error.config.url) {
							try {
								const parsedUrl = new URL(error.config.url);
								// 移除用戶名和密碼
								parsedUrl.username = '';
								parsedUrl.password = '';
								safeUrl = parsedUrl.toString();
							} catch (_e) {
								// 如果URL解析失敗，返回原始URL但去除查詢參數
								safeUrl = error.config.url.split('?')[0];
							}
						}
						
						const safeErrorResponse = {
							error: errorMessage,
							code: error.code || 'UNKNOWN_ERROR',
							// 只包含必要的非敏感配置信息
							request: error.config ? {
								url: safeUrl,
								method: error.config.method,
								timeout: error.config.timeout
							} : undefined
						};
						
						returnData.push({
							json: safeErrorResponse,
							pairedItem: { item: itemIndex },
						});
						continue;
					}
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				}
			}
			
			return returnData;
		};
		
		// Process all items in batches
		for (let i = 0; i < items.length; i += batchSize) {
			if (i !== 0 && batchInterval > 0) {
				// Wait between batches if a batch interval is set
				await new Promise((resolve) => setTimeout(resolve, batchInterval));
			}
			
			const batchItems = await processBatch(i);
			returnItems.push(...batchItems);
		}
		
		return [returnItems];
	}
}