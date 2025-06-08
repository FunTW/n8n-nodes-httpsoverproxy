import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	sleep,
	BINARY_ENCODING,
} from 'n8n-workflow';

import axios, { AxiosRequestConfig } from 'axios';
import * as https from 'https';
import * as http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { IDataObject } from 'n8n-workflow';
import type { Readable } from 'stream';
import FormData from 'form-data';
import { httpsOverProxyDescription } from './description';
import { configureResponseOptimizer } from './optimizeResponse';

// Connection pool management for better performance
class ConnectionPoolManager {
	private static instance: ConnectionPoolManager;
	private httpAgents: Map<string, http.Agent> = new Map();
	private httpsAgents: Map<string, https.Agent> = new Map();
	private proxyAgents: Map<string, HttpsProxyAgent<string>> = new Map();

	static getInstance(): ConnectionPoolManager {
		if (!ConnectionPoolManager.instance) {
			ConnectionPoolManager.instance = new ConnectionPoolManager();
		}
		return ConnectionPoolManager.instance;
	}

	getHttpAgent(options: { 
		timeout?: number; 
		keepAlive?: boolean;
		maxSockets?: number;
		maxFreeSockets?: number;
	} = {}): http.Agent {
		const key = `http_${options.timeout || 30000}_${options.keepAlive !== false}_${options.maxSockets || 50}_${options.maxFreeSockets || 10}`;
		
		if (!this.httpAgents.has(key)) {
			this.httpAgents.set(key, new http.Agent({
				keepAlive: options.keepAlive !== false,
				timeout: options.timeout || 30000,
				maxSockets: options.maxSockets || 50, // Maximum concurrent connections per host
				maxFreeSockets: options.maxFreeSockets || 10, // Maximum idle connections per host
			}));
		}
		
		return this.httpAgents.get(key)!;
	}

	getHttpsAgent(options: { 
		timeout?: number; 
		keepAlive?: boolean; 
		rejectUnauthorized?: boolean;
		maxSockets?: number;
		maxFreeSockets?: number;
	} = {}): https.Agent {
		const key = `https_${options.timeout || 30000}_${options.keepAlive !== false}_${options.rejectUnauthorized !== false}_${options.maxSockets || 50}_${options.maxFreeSockets || 10}`;
		
		if (!this.httpsAgents.has(key)) {
			this.httpsAgents.set(key, new https.Agent({
				keepAlive: options.keepAlive !== false,
				timeout: options.timeout || 30000,
				maxSockets: options.maxSockets || 50, // Maximum concurrent connections per host
				maxFreeSockets: options.maxFreeSockets || 10, // Maximum idle connections per host
				rejectUnauthorized: options.rejectUnauthorized !== false,
			}));
		}
		
		return this.httpsAgents.get(key)!;
	}

	getProxyAgent(proxyUrl: string, options: {
		timeout?: number;
		rejectUnauthorized?: boolean;
		maxSockets?: number;
		maxFreeSockets?: number;
	} = {}): HttpsProxyAgent<string> {
		const key = `proxy_${proxyUrl}_${options.timeout || 30000}_${options.rejectUnauthorized !== false}_${options.maxSockets || 50}_${options.maxFreeSockets || 10}`;
		
		if (!this.proxyAgents.has(key)) {
			this.proxyAgents.set(key, new HttpsProxyAgent(proxyUrl, {
				rejectUnauthorized: options.rejectUnauthorized !== false,
				timeout: options.timeout || 30000,
				maxSockets: options.maxSockets || 50, // Maximum concurrent connections per host
				maxFreeSockets: options.maxFreeSockets || 10, // Maximum idle connections per host
			}));
		}
		
		return this.proxyAgents.get(key)!;
	}

	// Clean up unused agents periodically
	cleanup(): void {
		// Clear all agents to free memory
		this.httpAgents.forEach(agent => agent.destroy());
		this.httpsAgents.forEach(agent => agent.destroy());
		this.proxyAgents.forEach(agent => agent.destroy());
		
		this.httpAgents.clear();
		this.httpsAgents.clear();
		this.proxyAgents.clear();
	}
}

// Helper function to process parameters for multipart-form-data and file uploads
async function parametersToKeyValue(
	executeFunctions: IExecuteFunctions,
	accumulator: { [key: string]: any },
	cur: { 
		name: string; 
		value: string; 
		parameterType?: string; 
		inputDataFieldName?: string 
	},
	itemIndex: number,
	items: INodeExecutionData[]
): Promise<{ [key: string]: any }> {
	if (cur.parameterType === 'formBinaryData') {
		if (!cur.inputDataFieldName) return accumulator;
		
		try {
			const binaryData = executeFunctions.helpers.assertBinaryData(itemIndex, cur.inputDataFieldName);
			let uploadData: Buffer | Readable;
			const itemBinaryData = items[itemIndex].binary![cur.inputDataFieldName];
			
			if (itemBinaryData.id) {
				uploadData = await executeFunctions.helpers.getBinaryStream(itemBinaryData.id);
			} else {
				uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);
			}

			accumulator[cur.name] = {
				value: uploadData,
				options: {
					filename: binaryData.fileName,
					contentType: binaryData.mimeType,
				},
			};
			return accumulator;
		} catch (error) {
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Error processing binary data for field "${cur.name}": ${error.message}`,
				{ itemIndex }
			);
		}
	}
	accumulator[cur.name] = cur.value;
	return accumulator;
}

export class HttpsOverProxy implements INodeType {
	description: INodeTypeDescription = httpsOverProxyDescription;

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];
		const connectionPool = ConnectionPoolManager.getInstance();
		
		// Get connection pool settings
		const connectionPoolSettings = this.getNodeParameter('options.connectionPool.settings', 0, {}) as {
			keepAlive?: boolean;
			maxSockets?: number;
			maxFreeSockets?: number;
		};

		// Add debug logs to check node parameters
		try {
			console.log('===== HTTPS Over Proxy Node Execution =====');
			
			// Check Method and URL
			const method = this.getNodeParameter('method', 0) as string;
			const url = this.getNodeParameter('url', 0) as string;
			console.log('Method:', method);
			console.log('URL:', url);
			
			// Check Headers
			const sendHeaders = this.getNodeParameter('sendHeaders', 0, false) as boolean;
			console.log('Send Headers:', sendHeaders);
			
			if (sendHeaders) {
				try {
					const specifyHeaders = this.getNodeParameter('specifyHeaders', 0, 'keypair') as string;
					console.log('Specify Headers:', specifyHeaders);
					
					if (specifyHeaders === 'keypair') {
						const headerParameters = this.getNodeParameter('headerParameters.parameters', 0, []) as Array<{ name: string; value: string }>;
						console.log('Header Parameters:', JSON.stringify(headerParameters, null, 2));
					} else {
						const headersJson = this.getNodeParameter('headersJson', 0, '{}') as string;
						console.log('Headers JSON:', headersJson);
					}
				} catch (e) {
					console.log('Error getting header parameters:', e.message);
				}
			}
			
			// Check Body
			const sendBody = this.getNodeParameter('sendBody', 0, false) as boolean;
			console.log('Send Body:', sendBody);
			
			if (sendBody) {
				try {
					const contentType = this.getNodeParameter('contentType', 0, 'json') as string;
					console.log('Content Type:', contentType);
					
					if (contentType === 'json' || contentType === 'form-urlencoded') {
						const specifyBody = this.getNodeParameter('specifyBody', 0, 'keypair') as string;
						console.log('Specify Body:', specifyBody);
						
						if (specifyBody === 'keypair') {
							const bodyParameters = this.getNodeParameter('bodyParameters.parameters', 0, []) as Array<{ name: string; value: string }>;
							console.log('Body Parameters:', JSON.stringify(bodyParameters, null, 2));
						} else {
							const bodyJson = this.getNodeParameter('bodyParametersJson', 0, '{}') as string;
							console.log('Body JSON:', bodyJson);
						}
					}
				} catch (e) {
					console.log('Error getting body parameters:', e.message);
				}
			}
		} catch (e) {
			console.log('Error in debug section:', e.message);
		}
		
		// Handle cURL import
		// Note: cURL import functionality is handled in the n8n frontend
		// When users import a cURL command, the frontend will parse the command into parameters and set them in the node
		// These parameters will be automatically retrieved during execution, e.g., this.getNodeParameter('method', itemIndex)
		// So we don't need to handle cURL import parameters separately here

		// Check for pagination options (compatible with HttpRequestV3 format)
		const pagination = this.getNodeParameter('options.pagination.pagination', 0, null, {
			rawExpressions: true,
		}) as {
			paginationMode: 'off' | 'updateAParameterInEachRequest' | 'responseContainsNextURL';
			nextURL?: string;
			parameters: {
				parameters: Array<{
					type: 'body' | 'headers' | 'qs';
					name: string;
					value: string;
				}>;
			};
			paginationCompleteWhen: 'responseIsEmpty' | 'receiveSpecificStatusCodes' | 'other';
			statusCodesWhenComplete: string;
			completeExpression: string;
			limitPagesFetched: boolean;
			maxRequests: number;
			requestInterval: number;
		};

		// Get batching options (compatible with HttpRequestV3 format)
		const batchingOptions = this.getNodeParameter('options.batching.batch', 0, {}) as {
			batchSize?: number;
			batchInterval?: number;
		};
		
		// defaults batch size to 1 if it's set to 0, -1 means disabled
		const batchSize = batchingOptions.batchSize !== undefined && batchingOptions.batchSize > 0 
			? batchingOptions.batchSize 
			: (batchingOptions.batchSize === -1 ? items.length : 1);
		const batchInterval = batchingOptions.batchInterval || 0;

		// 如果分頁模式是關閉的，直接處理請求
		if (!pagination || pagination.paginationMode === 'off') {
			// 標準處理邏輯（無分頁）
			const processBatch = async (startIndex: number): Promise<INodeExecutionData[]> => {
				const returnData: INodeExecutionData[] = [];
				
				const endIndex = Math.min(startIndex + batchSize, items.length);
				
				for (let itemIndex = startIndex; itemIndex < endIndex; itemIndex++) {
					// HttpRequestV3 compatible batching logic: wait between batches based on item index
					if (itemIndex > 0 && batchSize > 0 && batchInterval > 0) {
						if (itemIndex % batchSize === 0) {
							await sleep(batchInterval);
						}
					}
					// Declare timeoutId variable to ensure it's available throughout the function block
					let timeoutId: NodeJS.Timeout | undefined;
					
					try {
						// Check if proxy settings exist
						const proxySettings = this.getNodeParameter('options.proxy.settings', itemIndex, null) as {
							proxyUrl?: string;
							proxyAuth?: boolean;
							proxyUsername?: string;
							proxyPassword?: string;
						} | null;
						
						// Check if proxy settings are enabled
						const useProxy = !!(proxySettings && proxySettings.proxyUrl && proxySettings.proxyUrl.trim() !== '');
						
						if (useProxy && (!proxySettings?.proxyUrl)) {
							throw new NodeOperationError(
								this.getNode(),
								'When using a proxy, you must provide a valid proxy URL in the format http://myproxy:3128',
								{ itemIndex },
							);
						}
						
						// Process proxy URL
						let proxyHost = '';
						let proxyPort = 8080; // Default port
						
						if (useProxy && proxySettings?.proxyUrl) {
							try {
								// Try to parse proxy URL
								const proxyUrlObj = new URL(proxySettings.proxyUrl);
								proxyHost = proxyUrlObj.hostname;
								proxyPort = parseInt(proxyUrlObj.port || '8080', 10);
							} catch (_error) {
								// If URL parsing fails, try direct splitting
								const urlParts = proxySettings.proxyUrl.split(':');
								if (urlParts.length === 2) {
									proxyHost = urlParts[0];
									proxyPort = parseInt(urlParts[1], 10) || 8080;
								} else {
									// Incorrect format
									throw new NodeOperationError(
										this.getNode(),
										`Invalid proxy URL format: ${proxySettings.proxyUrl}. The correct format should be http://myproxy:3128 or myproxy:3128`,
										{ itemIndex },
									);
								}
							}
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
							redirect?: {
								redirect?: {
									followRedirects?: boolean;
									maxRedirects?: number;
								};
							};
							neverError?: boolean;
						};
						
						// Remove possible protocol prefix from proxy host
						let cleanProxyHost = '';
						if (proxyHost) {
							cleanProxyHost = proxyHost.replace(/^(http|https):\/\//, '');
						}
						
						// Build request options
						const requestOptions: AxiosRequestConfig = {
							method: requestMethod,
							url,
							headers: {},
							timeout: options.timeout || 30000,
							proxy: false, // Disable axios built-in proxy handling
						};
						
						// Use AbortController to control timeout
						const controller = new AbortController();
						requestOptions.signal = controller.signal;
						
						// Set timeout timer
						const requestTimeoutMs = options.timeout || 30000;
						timeoutId = setTimeout(() => {
							// Modified: Add custom error message when canceling
							const timeoutError = new Error(`Request canceled due to timeout (${requestTimeoutMs}ms). This was triggered by the node's timeout setting. If you need more time to complete the request, please increase the timeout value.`);
							// Use interface to extend error
							const customError = timeoutError as Error & { code: string };
							customError.code = 'TIMEOUT'; // Use custom error code
							
							// In Node.js, AbortController.abort() doesn't accept parameters by standard, but we need custom errors
							// eslint-disable-next-line @typescript-eslint/ban-ts-comment
							// @ts-ignore
							controller.abort(customError); // Pass custom error when aborting
						}, requestTimeoutMs);
						
						// Proxy authentication if needed
						let proxyAuthHeader = '';
						if (useProxy && proxySettings?.proxyAuth) {
							if (proxySettings.proxyUsername && proxySettings.proxyPassword) {
								// Use a more secure way to handle passwords - avoid exposing passwords directly in strings
								const username = String(proxySettings.proxyUsername);
								const password = String(proxySettings.proxyPassword);
								const auth = Buffer.from(`${username}:${password}`).toString('base64');
								proxyAuthHeader = `Basic ${auth}`;
								
								// Clear password variable immediately after use
								// Note: This can't completely prevent the password from existing in memory, but it reduces exposure time
								setTimeout(() => {
									password.replace(/./g, '*');
								}, 0);
							}
						}
						
						// Validate URL to prevent SSRF attacks
						try {
							const parsedUrl = new URL(url);
							
							// Check if it's an internal IP or localhost
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
								// If it's an internal address, check if access to internal network is explicitly allowed
								const allowInternalNetworkAccess = this.getNodeParameter(
									'options.allowInternalNetworkAccess',
									itemIndex,
									false
								) as boolean;
								
								if (!allowInternalNetworkAccess) {
									throw new Error(
										`Security restriction: Access to internal network address "${hostname}" is not allowed. If you need to access internal networks, please enable "Allow Internal Network Access" in the options.`
									);
								}
							}
						} catch (error) {
							if (error.code === 'ERR_INVALID_URL') {
								throw new NodeOperationError(this.getNode(), `Invalid URL: ${url}`, { itemIndex });
							}
							throw error;
						}
						
						// Add query parameters if any
						if (sendQuery) {
							const specifyQuery = this.getNodeParameter('specifyQuery', itemIndex, 'keypair') as string;
							if (specifyQuery === 'keypair') {
								let queryParameters: Array<{ name: string; value: string }> = [];
								try {
									queryParameters = this.getNodeParameter('queryParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
								} catch (_e) {
									// If the path above doesn't exist, try using queryParameters parameter
									try {
										const queryParams = this.getNodeParameter('queryParameters', itemIndex, {}) as { parameters?: Array<{ name: string; value: string }> };
										if (queryParams && queryParams.parameters) {
											queryParameters = queryParams.parameters;
										}
									} catch (_e2) {
										// eslint requires unused error variables to be named with _e
										// If both methods fail, use an empty array
										queryParameters = [];
									}
								}
								if (queryParameters.length) {
									const queryParams: Record<string, string> = {};
									for (const parameter of queryParameters) {
										// Ensure parameter name is not empty
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
								} catch (_e) {
									throw new NodeOperationError(this.getNode(), 'Query Parameters (JSON) must be a valid JSON object', { itemIndex });
								}
							}
						}
						
						// Handle authentication (compatible with HttpRequestV3 format)
						let authentication;
						try {
							authentication = this.getNodeParameter('authentication', itemIndex) as
								| 'predefinedCredentialType'
								| 'genericCredentialType'
								| 'none';
						} catch {
							authentication = 'none';
						}

						let httpBasicAuth;
						let httpBearerAuth;
						let httpDigestAuth;
						let httpHeaderAuth;
						let httpQueryAuth;
						let httpCustomAuth;
						let nodeCredentialType: string | undefined;
						let genericCredentialType: string | undefined;
						
						// Add headers
						const headers: Record<string, string> = {};
						const sendHeaders = this.getNodeParameter('sendHeaders', itemIndex, false) as boolean;
						const lowercaseHeaders = options.lowercaseHeaders !== false; // Default is true
						
						// Apply authentication
						if (authentication === 'genericCredentialType') {
							try {
								genericCredentialType = this.getNodeParameter('genericAuthType', itemIndex) as string;

								if (genericCredentialType === 'httpBasicAuth') {
									httpBasicAuth = await this.getCredentials('httpBasicAuth', itemIndex);
									const auth = Buffer.from(`${httpBasicAuth.user}:${httpBasicAuth.password}`).toString('base64');
									headers['Authorization'] = `Basic ${auth}`;
								} else if (genericCredentialType === 'httpBearerAuth') {
									httpBearerAuth = await this.getCredentials('httpBearerAuth', itemIndex);
									headers['Authorization'] = `Bearer ${httpBearerAuth.token}`;
								} else if (genericCredentialType === 'httpDigestAuth') {
									httpDigestAuth = await this.getCredentials('httpDigestAuth', itemIndex);
									// Note: Digest auth requires special handling, for now we'll use basic auth format
									const auth = Buffer.from(`${httpDigestAuth.user}:${httpDigestAuth.password}`).toString('base64');
									headers['Authorization'] = `Basic ${auth}`;
								} else if (genericCredentialType === 'httpHeaderAuth') {
									httpHeaderAuth = await this.getCredentials('httpHeaderAuth', itemIndex);
									headers[httpHeaderAuth.name as string] = httpHeaderAuth.value as string;
								} else if (genericCredentialType === 'httpQueryAuth') {
									httpQueryAuth = await this.getCredentials('httpQueryAuth', itemIndex);
									// Query auth will be handled in query parameters section
									if (!requestOptions.params) {
										requestOptions.params = {};
									}
									requestOptions.params[httpQueryAuth.name as string] = httpQueryAuth.value;
								} else if (genericCredentialType === 'httpCustomAuth') {
									httpCustomAuth = await this.getCredentials('httpCustomAuth', itemIndex);
									try {
										const customAuth = JSON.parse((httpCustomAuth.json as string) || '{}');
										
										// Apply custom headers
										if (customAuth.headers) {
											for (const [key, value] of Object.entries(customAuth.headers)) {
												const headerName = lowercaseHeaders ? key.toLowerCase() : key;
												headers[headerName] = value as string;
											}
										}
										
										// Apply custom query parameters
										if (customAuth.qs) {
											if (!requestOptions.params) {
												requestOptions.params = {};
											}
											for (const [key, value] of Object.entries(customAuth.qs)) {
												requestOptions.params[key] = value;
											}
										}
										
										// Custom body will be handled later in the body processing section
										if (customAuth.body) {
											// Store custom body for later processing
											(requestOptions as any).customAuthBody = customAuth.body;
										}
									} catch (_error) {
										throw new NodeOperationError(
											this.getNode(),
											'Invalid Custom Auth JSON configuration',
											{ itemIndex }
										);
									}
								}
								// OAuth1 and OAuth2 would require more complex implementation
								// For now, we'll skip them as they need special handling
							} catch (error) {
								if (error instanceof NodeOperationError) {
									throw error;
								}
								throw new NodeOperationError(
									this.getNode(),
									`Authentication error: ${(error as Error).message}`,
									{ itemIndex }
								);
							}
						} else if (authentication === 'predefinedCredentialType') {
							nodeCredentialType = this.getNodeParameter('nodeCredentialType', itemIndex) as string;
							
							// Handle predefined credential types using n8n's built-in authentication system
							if (nodeCredentialType) {
								try {
									// Get the credentials for the specified type
									const credentials = await this.getCredentials(nodeCredentialType, itemIndex);
									
									// Apply authentication based on credential type
									if (credentials) {
										// For OAuth2 credentials, the token is usually in access_token
										if (credentials.access_token) {
											headers['Authorization'] = `Bearer ${credentials.access_token}`;
										}
										// For OAuth1 credentials, n8n handles the signing automatically
										else if (credentials.oauth_token && credentials.oauth_token_secret) {
											// OAuth1 will be handled by n8n's request helper
											(requestOptions as any).auth = {
												oauth: {
													consumer_key: credentials.consumer_key as string,
													consumer_secret: credentials.consumer_secret as string,
													token: credentials.oauth_token as string,
													token_secret: credentials.oauth_token_secret as string,
												}
											};
										}
										// For API key based credentials
										else if (credentials.apiKey) {
											// Check if there's a specific header name for the API key
											const headerName = credentials.headerName as string || 'Authorization';
											const prefix = credentials.prefix as string || 'Bearer';
											headers[headerName] = `${prefix} ${credentials.apiKey}`;
										}
										// For basic auth credentials
										else if (credentials.username && credentials.password) {
											const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
											headers['Authorization'] = `Basic ${auth}`;
										}
										// For custom authentication, merge any custom headers
										if (credentials.customHeaders) {
											Object.assign(headers, credentials.customHeaders);
										}
									}
									
									console.log(`Successfully applied predefined credential type: ${nodeCredentialType}`);
								} catch (error) {
									throw new NodeOperationError(
										this.getNode(),
										`Failed to apply predefined credential type "${nodeCredentialType}": ${(error as Error).message}`,
										{ itemIndex }
									);
								}
							}
						}
						
						if (sendHeaders) {
							const specifyHeaders = this.getNodeParameter('specifyHeaders', itemIndex, 'keypair') as string;
							
							if (specifyHeaders === 'keypair') {
								// Directly use headerParameters.parameters path
								try {
									const headerParameters = this.getNodeParameter('headerParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
									for (const header of headerParameters) {
										// Ensure header name is not empty
										if (header.name && header.name.trim() !== '') {
											const headerName = lowercaseHeaders ? header.name.toLowerCase() : header.name;
											headers[headerName] = header.value;
										}
									}
								} catch (_e) {
									// Error handling
								}
							} else {
								// JSON headers
								const headersJson = this.getNodeParameter('headersJson', itemIndex, '{}') as string;
								try {
									const parsedHeaders = JSON.parse(headersJson);
									// Merge parsed headers into headers object
									for (const key in parsedHeaders) {
										if (Object.prototype.hasOwnProperty.call(parsedHeaders, key)) {
											const headerName = lowercaseHeaders ? key.toLowerCase() : key;
											headers[headerName] = parsedHeaders[key];
										}
									}
								} catch (_e) {
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
						let body: IDataObject | Buffer | undefined;
						
						// Check if there's custom auth body to merge
						const customAuthBody = (requestOptions as any).customAuthBody;
						
						if (this.getNodeParameter('sendBody', itemIndex, false) as boolean) {
							const contentType = this.getNodeParameter('contentType', itemIndex, 'json') as string;
							
							if (contentType === 'json' || contentType === 'form-urlencoded') {
								const specifyBody = this.getNodeParameter('specifyBody', itemIndex, 'keypair') as string;
								
								if (contentType === 'json') {
									headers['Content-Type'] = 'application/json';
								} else {
									headers['Content-Type'] = 'application/x-www-form-urlencoded';
								}
								
								if (specifyBody === 'keypair') {
									try {
										const bodyParameters = this.getNodeParameter('bodyParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
										
										if (bodyParameters.length) {
											const bodyParams: Record<string, string> = {};
											for (const parameter of bodyParameters) {
												if (parameter.name && parameter.name.trim() !== '') {
													bodyParams[parameter.name] = parameter.value;
												}
											}
											
											if (contentType === 'json') {
												body = bodyParams as IDataObject;
												if (customAuthBody) {
													body = { ...body, ...customAuthBody };
												}
											} else {
												const queryString = Object.entries(bodyParams)
													.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
													.join('&');
												requestOptions.data = queryString;
											}
										}
									} catch (_e) {
										// Error handling
									}
								} else {
									const bodyJson = this.getNodeParameter('bodyParametersJson', itemIndex, '{}') as string;
									if (contentType === 'json') {
										try {
											const parsedJson = JSON.parse(bodyJson);
											body = parsedJson as IDataObject;
											if (customAuthBody) {
												body = { ...body, ...customAuthBody };
											}
											requestOptions.data = body;
										} catch (_e) {
											console.log(`Unable to parse bodyParametersJson as JSON: ${bodyJson}`);
											requestOptions.data = bodyJson;
										}
									} else {
										try {
											const parsedJson = JSON.parse(bodyJson);
											const queryString = Object.entries(parsedJson)
												.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
												.join('&');
											requestOptions.data = queryString;
										} catch (_e) {
											console.log(`Unable to parse bodyParametersJson as JSON: ${bodyJson}`);
											requestOptions.data = bodyJson;
										}
									}
								}
							} else if (contentType === 'multipart-form-data') {
								// Handle multipart-form-data with file uploads
								try {
									const bodyParameters = this.getNodeParameter('bodyParameters.parameters', itemIndex, []) as Array<{ 
										name: string; 
										value: string; 
										parameterType?: string; 
										inputDataFieldName?: string 
									}>;
									
									if (bodyParameters.length) {
										const formData = new FormData();
										
										// Process each parameter using the helper function
										for (const parameter of bodyParameters) {
											if (parameter.name && parameter.name.trim() !== '') {
												const processedParam = await parametersToKeyValue(
													this,
													{}, 
													parameter, 
													itemIndex, 
													items
												);
												
												const value = processedParam[parameter.name];
												if (value && typeof value === 'object' && value.value !== undefined) {
													// Binary data with options
													formData.append(parameter.name, value.value, value.options);
												} else {
													// Regular form data
													formData.append(parameter.name, String(value || parameter.value));
												}
											}
										}
										
										// Set the form data as request data
										requestOptions.data = formData;
										// Let FormData set the Content-Type header with boundary
										headers['Content-Type'] = `multipart/form-data; boundary=${formData.getBoundary()}`;
									}
								} catch (error) {
									throw new NodeOperationError(
										this.getNode(),
										`Error processing multipart-form-data: ${error.message}`,
										{ itemIndex }
									);
								}
							} else if (contentType === 'binaryData') {
								// Handle binary data upload
								try {
									const inputDataFieldName = this.getNodeParameter('inputDataFieldName', itemIndex) as string;
									
									if (!inputDataFieldName) {
										throw new NodeOperationError(
											this.getNode(),
											'Input Data Field Name is required for binary data upload',
											{ itemIndex }
										);
									}
									
									const binaryData = this.helpers.assertBinaryData(itemIndex, inputDataFieldName);
									let uploadData: Buffer | Readable;
									let contentLength: number;
									
									const itemBinaryData = items[itemIndex].binary![inputDataFieldName];
									if (itemBinaryData.id) {
										uploadData = await this.helpers.getBinaryStream(itemBinaryData.id);
										const metadata = await this.helpers.getBinaryMetadata(itemBinaryData.id);
										contentLength = metadata.fileSize;
									} else {
										uploadData = Buffer.from(itemBinaryData.data, BINARY_ENCODING);
										contentLength = uploadData.length;
									}
									
									requestOptions.data = uploadData;
									headers['Content-Length'] = contentLength.toString();
									headers['Content-Type'] = binaryData.mimeType ?? 'application/octet-stream';
								} catch (error) {
									throw new NodeOperationError(
										this.getNode(),
										`Error processing binary data: ${error.message}`,
										{ itemIndex }
									);
								}
							} else if (contentType === 'raw') {
								const rawContentType = this.getNodeParameter('rawContentType', itemIndex, '') as string;
								const bodyContent = this.getNodeParameter('body', itemIndex, '') as string;
								requestOptions.data = bodyContent;
								
								if (rawContentType) {
									headers['Content-Type'] = rawContentType;
								}
							}
						} else if (customAuthBody) {
							// If no body is being sent but custom auth has body, use custom auth body
							body = customAuthBody as IDataObject;
							requestOptions.data = body;
							if (!headers['Content-Type'] && !headers['content-type']) {
								headers['Content-Type'] = 'application/json';
							}
						}
						
						// Configure proxy with connection pooling
						const allowUnauthorizedCerts = options.allowUnauthorizedCerts || false;
						const timeoutMs = options.timeout || 30000;
						
						// Only use proxy if enabled
						if (useProxy && cleanProxyHost) {
							// Configure HTTPS proxy
							if (url.startsWith('https:')) {
								// Use https-proxy-agent to handle HTTPS over HTTP proxy issues
								const proxyUrl = proxySettings?.proxyAuth && proxySettings.proxyUsername && proxySettings.proxyPassword
									? `http://${proxySettings.proxyUsername}:${proxySettings.proxyPassword}@${cleanProxyHost}:${proxyPort}`
									: `http://${cleanProxyHost}:${proxyPort}`;
								
								// Use connection pool for proxy agent
								const httpsProxyAgent = connectionPool.getProxyAgent(proxyUrl, {
									rejectUnauthorized: !allowUnauthorizedCerts,
									timeout: timeoutMs,
									maxSockets: connectionPoolSettings.maxSockets,
									maxFreeSockets: connectionPoolSettings.maxFreeSockets,
								});
								
								// Apply proxy agent to request
								requestOptions.httpsAgent = httpsProxyAgent;
								
								// Also set SSL verification options for target server
								// Note: This is crucial! Even with correctly configured proxy, we need to ensure target server certificate validation matches the options
								
								// Apply these options to the underlying HTTPS module, ensuring all HTTPS requests use the same SSL verification settings
								// eslint-disable-next-line @typescript-eslint/ban-ts-comment
								// @ts-ignore
								process.env.NODE_TLS_REJECT_UNAUTHORIZED = allowUnauthorizedCerts ? '0' : '1';
							} else {
								// Use HTTP proxy with connection pooling
								const httpAgent = connectionPool.getHttpAgent({
									timeout: timeoutMs,
									keepAlive: connectionPoolSettings.keepAlive !== false,
									maxSockets: connectionPoolSettings.maxSockets,
									maxFreeSockets: connectionPoolSettings.maxFreeSockets,
								});
								
								// Set proxy
								requestOptions.proxy = {
									host: cleanProxyHost,
									port: proxyPort,
									protocol: 'http:',
								};
								
								requestOptions.httpAgent = httpAgent;
							}
						} else {
							// Configure agents for direct connections (no proxy)
							if (url.startsWith('https:')) {
								// Use HTTPS agent with connection pooling
								requestOptions.httpsAgent = connectionPool.getHttpsAgent({
									timeout: timeoutMs,
									keepAlive: connectionPoolSettings.keepAlive !== false,
									rejectUnauthorized: !allowUnauthorizedCerts,
									maxSockets: connectionPoolSettings.maxSockets,
									maxFreeSockets: connectionPoolSettings.maxFreeSockets,
								});
							} else {
								// Use HTTP agent with connection pooling
								requestOptions.httpAgent = connectionPool.getHttpAgent({
									timeout: timeoutMs,
									keepAlive: connectionPoolSettings.keepAlive !== false,
									maxSockets: connectionPoolSettings.maxSockets,
									maxFreeSockets: connectionPoolSettings.maxFreeSockets,
								});
							}
						}
						
						// Set response type
						requestOptions.responseType = 'text';
						
						// Set redirect options (compatible with HttpRequestV3 format)
						const redirectSettings = options.redirect?.redirect;
						if (redirectSettings?.followRedirects === false) {
							requestOptions.maxRedirects = 0;
						} else if (redirectSettings?.followRedirects === true && redirectSettings?.maxRedirects !== undefined) {
							requestOptions.maxRedirects = redirectSettings.maxRedirects;
						} else {
							// Default behavior: follow redirects with default max
							requestOptions.maxRedirects = 21;
						}
						
						// Set never error option
						if (options.neverError === true) {
							requestOptions.validateStatus = () => true;
						}
						
						// 在 axios 調用前添加
						if (body !== undefined) {
							requestOptions.data = body;
						}
						
						// Make the request
						const response = await axios(requestOptions);
						
						// Clear timeout timer
						if (timeoutId) {
							clearTimeout(timeoutId);
						}
						
						// Configure response optimizer
						const optimizeResponse = configureResponseOptimizer(this, itemIndex);
						
						// Process the response
						let responseData;
						const contentType = response.headers['content-type'] || '';
						
						// Get response format, default to autodetect if not specified
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
							} catch (_e) {
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
						
						// Apply response optimization if enabled
						let executionData: any;
						if (options.fullResponse === true) {
							// For full response, optimize the data field
							const optimizedData = optimizeResponse(responseData);
							executionData = {
								status: response.status,
								statusText: response.statusText,
								headers: response.headers,
								data: optimizedData,
							};
						} else {
							// For simple response, optimize the entire response
							const optimizedResponse = optimizeResponse(responseData);
							// If optimizedResponse is a string, wrap it as { data: optimizedResponse }
							if (typeof optimizedResponse === 'string') {
								executionData = { data: optimizedResponse };
							} else {
								executionData = optimizedResponse;
							}
						}
						
						// Add the response to the returned items
						returnData.push({
							json: executionData,
							pairedItem: { item: itemIndex },
						});
						
					} catch (error) {
						if (this.continueOnFail()) {
							let errorMessage = error.message;
							
							// Special handling for "canceled" errors
							if (errorMessage === 'canceled' || error.code === 'ERR_CANCELED') {
								const currentOptions = this.getNodeParameter('options', itemIndex, {}) as {
									timeout?: number;
								};
								const timeout = currentOptions.timeout || 30000;
								
								// Modified: Don't use "canceled" as error message, provide detailed timeout explanation
								errorMessage = `Request canceled due to timeout (${timeout}ms). This was triggered by the node's timeout setting. If you need more time to complete the request, please increase the timeout value.`;
								error.message = errorMessage; // Replace original error message
								error.code = 'TIMEOUT'; // Reset error code to TIMEOUT
								
								// Create error object with more detailed timeout message
								const safeErrorResponse = {
									errorMessage: errorMessage, // Modified: Use more explicit property name
									error: errorMessage, // Keep for compatibility
									code: 'TIMEOUT',
									request: error.config ? {
										url: error.config.url,
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
							
							// Provide more detailed error information
							if (errorMessage.includes('tunneling socket could not be established')) {
								// Get proxy settings to handle error
								const errorProxySettings = this.getNodeParameter('options.proxy.settings', itemIndex, {}) as {
									proxyUrl?: string;
									proxyAuth?: boolean;
									proxyUsername?: string;
									proxyPassword?: string;
								};
								
								const proxyUrl = errorProxySettings?.proxyUrl || '';
								let errorProxyHost = '';
								let errorProxyPort = 8080;
								
								// Try to parse proxy URL
								try {
									const errorProxyUrlObj = new URL(proxyUrl.startsWith('http') ? proxyUrl : `http://${proxyUrl}`);
									errorProxyHost = errorProxyUrlObj.hostname;
									errorProxyPort = parseInt(errorProxyUrlObj.port || '8080', 10);
								} catch (_parseError) {
									// Try simple splitting if parsing fails
									const parts = proxyUrl.split(':');
									if (parts.length >= 2) {
										errorProxyHost = parts[0];
										errorProxyPort = parseInt(parts[1], 10) || 8080;
									} else {
										errorProxyHost = proxyUrl;
									}
								}
								
								// Detect proxy address format errors
								if (!proxyUrl.includes(':')) {
									errorMessage = `Invalid proxy address format: missing port number. The correct format should be "myproxy:3128" or "http://myproxy:3128".`;
								} else if (errorMessage.includes('ENOTFOUND')) {
									errorMessage = `Unable to connect to proxy server: host "${errorProxyHost}" not found. Please check if the proxy address is correct, or try using an IP address instead of a domain name.`;
								} else if (errorMessage.includes('ECONNREFUSED')) {
									errorMessage = `Proxy server connection refused: ${errorProxyHost}:${errorProxyPort}. Please verify the proxy server is running and the port number is correct.`;
								} else if (errorMessage.includes('ETIMEDOUT')) {
									errorMessage = `Proxy server connection timeout: ${errorProxyHost}:${errorProxyPort}. Please check your network connection or if the proxy server is available.`;
								}
							} else if (errorMessage.includes('timeout') && error.code === 'ECONNABORTED') {
								// Get current timeout settings
								const currentOptions = this.getNodeParameter('options', itemIndex, {}) as {
									timeout?: number;
								};
								const timeout = currentOptions.timeout || 30000;
								errorMessage = `Request timeout: No response received within ${timeout} milliseconds. Please check your network connection, proxy server and target website, or increase the timeout value.`;
							} else if (errorMessage.includes('ECONNRESET')) {
								errorMessage = `Connection reset: The server may have closed the connection. Please check if the target server is running properly.`;
							} else if (errorMessage.includes('certificate') || errorMessage.includes('self-signed')) {
								// More explicit SSL certificate error message, reminding users to enable "Ignore SSL Issues (Insecure)" option
								errorMessage = `SSL certificate error: ${errorMessage}\n\n[SOLUTION] Please enable the "Ignore SSL Issues (Insecure)" option in the node settings to ignore SSL certificate problems.\n\nNote: This will reduce connection security and is only recommended in trusted environments.`;
							}
							
							// Create safe error object, avoiding exposure of sensitive information
							let safeUrl = '';
							if (error.config && error.config.url) {
								try {
									const parsedUrl = new URL(error.config.url);
									// Remove username and password
									parsedUrl.username = '';
									parsedUrl.password = '';
									safeUrl = parsedUrl.toString();
								} catch (_e) {
									// If URL parsing fails, return original URL but remove query parameters
									safeUrl = error.config.url.split('?')[0];
								}
							}
							
							const safeErrorResponse = {
								error: errorMessage,
								code: error.code || 'UNKNOWN_ERROR',
								// Only include necessary non-sensitive configuration information
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
						
						// Modified: If it's a canceled error, replace with more detailed message before throwing
						if (error.message === 'canceled' || error.code === 'ERR_CANCELED') {
							const currentOptions = this.getNodeParameter('options', itemIndex, {}) as {
								timeout?: number;
							};
							const timeout = currentOptions.timeout || 30000;
							const detailedMessage = `Request canceled due to timeout (${timeout}ms). This was triggered by the node's timeout setting. If you need more time to complete the request, please increase the timeout value.`;
							throw new NodeOperationError(this.getNode(), detailedMessage, { itemIndex });
						}
						
						// Special handling for SSL certificate errors
						if (error.message.includes('certificate') || error.message.includes('self-signed')) {
							const sslErrorMessage = `SSL certificate error: ${error.message}\n\n[SOLUTION] Please enable the "Ignore SSL Issues (Insecure)" option in the node settings to ignore SSL certificate problems.\n\nNote: This will reduce connection security and is only recommended in trusted environments.`;
							throw new NodeOperationError(this.getNode(), sslErrorMessage, { itemIndex });
						}
						
						throw new NodeOperationError(this.getNode(), error, { itemIndex });
					}
				}
				
				return returnData;
			};
			
			// Process all items in batches
			for (let i = 0; i < items.length; i += batchSize) {
				const batchItems = await processBatch(i);
				returnItems.push(...batchItems);
			}
		} else {
			// 支持分頁的處理邏輯
			await handlePagination(this, pagination, returnItems);
		}
		
		// 實作批次結果聚合功能
		const aggregationOptions = this.getNodeParameter('options.batchAggregation', 0, {}) as {
			enabled?: boolean;
			aggregationType?: 'merge' | 'array' | 'summary';
			mergeStrategy?: 'shallow' | 'deep';
			includeMetadata?: boolean;
		};
		
		if (aggregationOptions.enabled && returnItems.length > 1) {
			const aggregatedResult = aggregateBatchResults(returnItems, aggregationOptions);
			return [aggregatedResult];
		}
		
		return [returnItems];
	}
}

// 批次結果聚合函數
function aggregateBatchResults(
	items: INodeExecutionData[],
	options: {
		aggregationType?: 'merge' | 'array' | 'summary';
		mergeStrategy?: 'shallow' | 'deep';
		includeMetadata?: boolean;
	}
): INodeExecutionData[] {
	const { aggregationType = 'array', mergeStrategy = 'shallow', includeMetadata = false } = options;
	
	if (aggregationType === 'merge') {
		// 合併所有結果到單一物件
		const mergedData: any = {};
		const metadata: any = {
			totalItems: items.length,
			aggregationType: 'merge',
			mergeStrategy,
		};
		
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (item.json) {
				if (mergeStrategy === 'deep') {
					// 深度合併
					deepMerge(mergedData, item.json);
				} else {
					// 淺層合併
					Object.assign(mergedData, item.json);
				}
			}
		}
		
		if (includeMetadata) {
			mergedData._metadata = metadata;
		}
		
		return [{
			json: mergedData,
			pairedItem: { item: 0 },
		}];
		
	} else if (aggregationType === 'array') {
		// 將所有結果包裝在陣列中
		const arrayData = items.map((item, index) => ({
			...item.json,
			_itemIndex: index,
		}));
		
		const metadata: any = {
			totalItems: items.length,
			aggregationType: 'array',
		};
		
		const result: any = {
			items: arrayData,
		};
		
		if (includeMetadata) {
			result._metadata = metadata;
		}
		
		return [{
			json: result,
			pairedItem: { item: 0 },
		}];
		
	} else if (aggregationType === 'summary') {
		// 創建摘要統計
		const summary: any = {
			totalItems: items.length,
			successfulItems: items.filter(item => !item.json || !(item.json as any).error).length,
			failedItems: items.filter(item => item.json && (item.json as any).error).length,
			aggregationType: 'summary',
		};
		
		// 統計回應狀態碼
		const statusCodes: Record<number, number> = {};
		const errors: string[] = [];
		
		for (const item of items) {
			if (item.json) {
				const json = item.json as any;
				if (json.error) {
					errors.push(json.error);
				}
				if (json.statusCode) {
					statusCodes[json.statusCode] = (statusCodes[json.statusCode] || 0) + 1;
				}
			}
		}
		
		summary.statusCodeDistribution = statusCodes;
		if (errors.length > 0) {
			summary.errors = errors;
		}
		
		if (includeMetadata) {
			summary._metadata = {
				aggregationType: 'summary',
				generatedAt: new Date().toISOString(),
			};
		}
		
		return [{
			json: summary,
			pairedItem: { item: 0 },
		}];
	}
	
	// 預設返回原始項目
	return items;
}

// 深度合併輔助函數
function deepMerge(target: any, source: any): any {
	for (const key in source) {
		if (source.hasOwnProperty(key)) {
			if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
				if (!target[key] || typeof target[key] !== 'object') {
					target[key] = {};
				}
				deepMerge(target[key], source[key]);
			} else {
				target[key] = source[key];
			}
		}
	}
	return target;
}

// 處理分頁的輔助函數，與 HttpRequestV3 相容
async function handlePagination(
	executeFunctions: IExecuteFunctions,
	pagination: {
		paginationMode: 'off' | 'updateAParameterInEachRequest' | 'responseContainsNextURL';
		nextURL?: string;
		parameters: {
			parameters: Array<{
				type: 'body' | 'headers' | 'qs';
				name: string;
				value: string;
			}>;
		};
		paginationCompleteWhen: 'responseIsEmpty' | 'receiveSpecificStatusCodes' | 'other';
		statusCodesWhenComplete: string;
		completeExpression: string;
		limitPagesFetched: boolean;
		maxRequests: number;
		requestInterval: number;
	},
	returnItems: INodeExecutionData[]
): Promise<void> {
	// 實作完整的分頁邏輯
	let requestCount = 0;
	let continueRequests = true;
	
	// 構建分頁條件表達式
	let continueExpression = '={{false}}';
	if (pagination.paginationCompleteWhen === 'receiveSpecificStatusCodes') {
		// 分割逗號分隔的狀態碼列表
		const statusCodesWhenCompleted = pagination.statusCodesWhenComplete
			.split(',')
			.map((item) => parseInt(item.trim()));

		continueExpression = `={{ !${JSON.stringify(
			statusCodesWhenCompleted,
		)}.includes($response.statusCode) }}`;
	} else if (pagination.paginationCompleteWhen === 'responseIsEmpty') {
		continueExpression =
			'={{ Array.isArray($response.body) ? $response.body.length : !!$response.body }}';
	} else {
		// Other
		if (!pagination.completeExpression.length || pagination.completeExpression[0] !== '=') {
			throw new NodeOperationError(executeFunctions.getNode(), 'Invalid or empty Complete Expression');
		}
		continueExpression = `={{ !(${pagination.completeExpression.trim().slice(3, -2)}) }}`;
	}

	// 構建分頁請求數據
	const paginationRequestData: any = {};

	if (pagination.paginationMode === 'updateAParameterInEachRequest') {
		// 迭代所有參數並添加到請求中
		const { parameters } = pagination.parameters;
		if (
			parameters.length === 1 &&
			parameters[0].name === '' &&
			parameters[0].value === ''
		) {
			throw new NodeOperationError(
				executeFunctions.getNode(),
				"At least one entry with 'Name' and 'Value' filled must be included in 'Parameters' to use 'Update a Parameter in Each Request' mode ",
			);
		}
		pagination.parameters.parameters.forEach((parameter, index) => {
			if (!paginationRequestData[parameter.type]) {
				paginationRequestData[parameter.type] = {};
			}
			const parameterName = parameter.name;
			if (parameterName === '') {
				throw new NodeOperationError(
					executeFunctions.getNode(),
					`Parameter name must be set for parameter [${index + 1}] in pagination settings`,
				);
			}
			const parameterValue = parameter.value;
			if (parameterValue === '') {
				throw new NodeOperationError(
					executeFunctions.getNode(),
					`Some value must be provided for parameter [${
						index + 1
					}] in pagination settings, omitting it will result in an infinite loop`,
				);
			}
			paginationRequestData[parameter.type]![parameterName] = parameterValue;
		});
	} else if (pagination.paginationMode === 'responseContainsNextURL') {
		paginationRequestData.url = pagination.nextURL;
	}

	// 實作分頁請求邏輯
	while (continueRequests) {
		// 檢查是否達到最大請求數限制
		if (pagination.limitPagesFetched && requestCount >= pagination.maxRequests) {
			console.log(`Reached maximum number of requests: ${pagination.maxRequests}`);
			break;
		}

		try {
			// 執行真實的 HTTP 請求
			console.log(`Executing pagination request ${requestCount + 1}`);
			console.log('Continue expression:', continueExpression);
			console.log('Pagination request data:', paginationRequestData);
			
			// 構建分頁覆蓋參數
			const paginationOverrides: {
				url?: string;
				queryParams?: Record<string, any>;
				headers?: Record<string, any>;
				body?: any;
			} = {};
			
			if (pagination.paginationMode === 'updateAParameterInEachRequest') {
				// 更新參數模式
				if (paginationRequestData.qs) {
					paginationOverrides.queryParams = paginationRequestData.qs;
				}
				if (paginationRequestData.headers) {
					paginationOverrides.headers = paginationRequestData.headers;
				}
				if (paginationRequestData.body) {
					paginationOverrides.body = paginationRequestData.body;
				}
			} else if (pagination.paginationMode === 'responseContainsNextURL') {
				// 下一個 URL 模式
				if (paginationRequestData.url) {
					paginationOverrides.url = paginationRequestData.url;
				}
			}
			
			// 執行 HTTP 請求
			const items = executeFunctions.getInputData();
			const result = await executeHttpRequest(executeFunctions, 0, items[0], items, paginationOverrides);
			
			// 從結果中提取回應數據
			const response = (result.json as any).$response;
			
			// 評估繼續條件
			if (pagination.paginationCompleteWhen === 'responseIsEmpty') {
				continueRequests = Array.isArray(response.body) ? response.body.length > 0 : !!response.body;
			} else if (pagination.paginationCompleteWhen === 'receiveSpecificStatusCodes') {
				const statusCodesWhenCompleted = pagination.statusCodesWhenComplete
					.split(',')
					.map((item) => parseInt(item.trim()));
				continueRequests = !statusCodesWhenCompleted.includes(response.statusCode);
			} else {
				// 對於 'other' 類型，需要評估自訂表達式
				// 這裡簡化處理，實際實作時需要使用 n8n 的表達式評估器
				continueRequests = false;
			}
			
			// 將結果添加到返回項目中
			const cleanedResult = { ...result };
			if (cleanedResult.json && (cleanedResult.json as any).$response) {
				delete (cleanedResult.json as any).$response;
			}
			returnItems.push(cleanedResult);
			
			// 更新分頁參數以準備下一次請求
			if (continueRequests) {
				if (pagination.paginationMode === 'updateAParameterInEachRequest') {
					// 更新分頁參數
					updatePaginationParameters(paginationRequestData, response, pagination.parameters.parameters);
				} else if (pagination.paginationMode === 'responseContainsNextURL') {
					// 提取下一個 URL
					const nextUrl = extractNextUrlFromResponse(response, pagination.nextURL);
					if (nextUrl) {
						paginationRequestData.url = nextUrl;
					} else {
						continueRequests = false;
					}
				}
			}
			
			requestCount++;
			
			// 如果設置了請求間隔，等待指定時間
			if (pagination.requestInterval > 0 && continueRequests) {
				await sleep(pagination.requestInterval);
			}
			
		} catch (error) {
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Pagination request failed: ${(error as Error).message}`,
				{ itemIndex: 0 }
			);
		}
	}
	
	console.log(`Pagination completed after ${requestCount} requests`);
}

// 更新分頁參數的輔助函數
function updatePaginationParameters(
	paginationOverrides: any,
	response: any,
	parameters: Array<{
		type: 'body' | 'headers' | 'qs';
		name: string;
		value: string;
	}>
): void {
	for (const parameter of parameters) {
		const { type, name, value } = parameter;
		
		// 評估參數值（可能包含表達式）
		let evaluatedValue = value;
		
		// 簡化的表達式評估（實際實作中應使用 n8n 的表達式評估器）
		if (value.includes('$response')) {
			// 處理 $response 相關的表達式
			if (value.includes('$response.body')) {
				// 例如：$response.body.nextPage
				const bodyPath = value.replace('$response.body.', '');
				const pathParts = bodyPath.split('.');
				let currentValue = response.body;
				
				for (const part of pathParts) {
					if (currentValue && typeof currentValue === 'object' && part in currentValue) {
						currentValue = currentValue[part];
					} else {
						currentValue = undefined;
						break;
					}
				}
				
				evaluatedValue = currentValue;
			} else if (value.includes('$response.headers')) {
				// 例如：$response.headers.nextPageUrl
				const headerName = value.replace('$response.headers.', '');
				evaluatedValue = response.headers[headerName] || response.headers[headerName.toLowerCase()];
			}
		}
		
		// 更新對應的參數類型
		if (type === 'qs') {
			if (!paginationOverrides.queryParams) {
				paginationOverrides.queryParams = {};
			}
			paginationOverrides.queryParams[name] = evaluatedValue;
		} else if (type === 'headers') {
			if (!paginationOverrides.headers) {
				paginationOverrides.headers = {};
			}
			paginationOverrides.headers[name] = evaluatedValue;
		} else if (type === 'body') {
			if (!paginationOverrides.body) {
				paginationOverrides.body = {};
			}
			paginationOverrides.body[name] = evaluatedValue;
		}
	}
}

// 從回應中提取下一個 URL 的輔助函數
function extractNextUrlFromResponse(response: any, nextUrlExpression?: string): string | null {
	if (!nextUrlExpression) {
		return null;
	}
	
	// 簡化的表達式評估
	if (nextUrlExpression.includes('$response.body')) {
		const bodyPath = nextUrlExpression.replace('$response.body.', '');
		const pathParts = bodyPath.split('.');
		let currentValue = response.body;
		
		for (const part of pathParts) {
			if (currentValue && typeof currentValue === 'object' && part in currentValue) {
				currentValue = currentValue[part];
			} else {
				return null;
			}
		}
		
		return typeof currentValue === 'string' ? currentValue : null;
	} else if (nextUrlExpression.includes('$response.headers')) {
		const headerName = nextUrlExpression.replace('$response.headers.', '');
		const headerValue = response.headers[headerName] || response.headers[headerName.toLowerCase()];
		return typeof headerValue === 'string' ? headerValue : null;
	}
	
	return null;
}

// 通用的 HTTP 請求執行函數
async function executeHttpRequest(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
	item: INodeExecutionData,
	items: INodeExecutionData[],
	paginationOverrides?: {
		url?: string;
		queryParams?: Record<string, any>;
		headers?: Record<string, any>;
		body?: any;
	}
): Promise<INodeExecutionData> {
	const connectionPool = ConnectionPoolManager.getInstance();
	let timeoutId: NodeJS.Timeout | undefined;
	
	try {
		// 檢查代理設定
		const proxySettings = executeFunctions.getNodeParameter('options.proxy.settings', itemIndex, null) as {
			proxyUrl?: string;
			proxyAuth?: boolean;
			proxyUsername?: string;
			proxyPassword?: string;
		} | null;
		
		const useProxy = !!(proxySettings && proxySettings.proxyUrl && proxySettings.proxyUrl.trim() !== '');
		
		if (useProxy && (!proxySettings?.proxyUrl)) {
			throw new NodeOperationError(
				executeFunctions.getNode(),
				'When using a proxy, you must provide a valid proxy URL in the format http://myproxy:3128',
				{ itemIndex },
			);
		}
		
		// 處理代理 URL
		let proxyHost = '';
		let proxyPort = 8080;
		
		if (useProxy && proxySettings?.proxyUrl) {
			try {
				const proxyUrlObj = new URL(proxySettings.proxyUrl);
				proxyHost = proxyUrlObj.hostname;
				proxyPort = parseInt(proxyUrlObj.port || '8080', 10);
			} catch (_error) {
				const urlParts = proxySettings.proxyUrl.split(':');
				if (urlParts.length === 2) {
					proxyHost = urlParts[0];
					proxyPort = parseInt(urlParts[1], 10) || 8080;
				} else {
					throw new NodeOperationError(
						executeFunctions.getNode(),
						`Invalid proxy URL format: ${proxySettings.proxyUrl}. The correct format should be http://myproxy:3128 or myproxy:3128`,
						{ itemIndex },
					);
				}
			}
		}
		
		// 獲取請求參數（支援分頁覆蓋）
		const requestMethod = executeFunctions.getNodeParameter('method', itemIndex) as string;
		const baseUrl = paginationOverrides?.url || executeFunctions.getNodeParameter('url', itemIndex) as string;
		const sendQuery = executeFunctions.getNodeParameter('sendQuery', itemIndex, false) as boolean;
		const options = executeFunctions.getNodeParameter('options', itemIndex, {}) as {
			allowUnauthorizedCerts?: boolean;
			fullResponse?: boolean;
			responseFormat?: string;
			outputFieldName?: string;
			timeout?: number;
			lowercaseHeaders?: boolean;
			redirect?: {
				redirect?: {
					followRedirects?: boolean;
					maxRedirects?: number;
				};
			};
			neverError?: boolean;
		};
		
		// 清理代理主機名
		let cleanProxyHost = '';
		if (proxyHost) {
			cleanProxyHost = proxyHost.replace(/^(http|https):\/\//, '');
		}
		
		// 構建請求選項
		const requestOptions: AxiosRequestConfig = {
			method: requestMethod,
			url: baseUrl,
			headers: {},
			timeout: options.timeout || 30000,
			proxy: false,
		};
		
		// 使用 AbortController 控制超時
		const controller = new AbortController();
		requestOptions.signal = controller.signal;
		
		const requestTimeoutMs = options.timeout || 30000;
		timeoutId = setTimeout(() => {
			const timeoutError = new Error(`Request canceled due to timeout (${requestTimeoutMs}ms). This was triggered by the node's timeout setting. If you need more time to complete the request, please increase the timeout value.`);
			const customError = timeoutError as Error & { code: string };
			customError.code = 'TIMEOUT';
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			controller.abort(customError);
		}, requestTimeoutMs);
		
		// 代理認證
		let proxyAuthHeader = '';
		if (useProxy && proxySettings?.proxyAuth) {
			if (proxySettings.proxyUsername && proxySettings.proxyPassword) {
				const username = String(proxySettings.proxyUsername);
				const password = String(proxySettings.proxyPassword);
				const auth = Buffer.from(`${username}:${password}`).toString('base64');
				proxyAuthHeader = `Basic ${auth}`;
				
				setTimeout(() => {
					password.replace(/./g, '*');
				}, 0);
			}
		}
		
		// URL 驗證（防止 SSRF 攻擊）
		try {
			const parsedUrl = new URL(baseUrl);
			
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
				const allowInternalNetworkAccess = executeFunctions.getNodeParameter(
					'options.allowInternalNetworkAccess',
					itemIndex,
					false
				) as boolean;
				
				if (!allowInternalNetworkAccess) {
					throw new Error(
						`Security restriction: Access to internal network address "${hostname}" is not allowed. If you need to access internal networks, please enable "Allow Internal Network Access" in the options.`
					);
				}
			}
		} catch (error) {
			if (error.code === 'ERR_INVALID_URL') {
				throw new NodeOperationError(executeFunctions.getNode(), `Invalid URL: ${baseUrl}`, { itemIndex });
			}
			throw error;
		}
		
		// 添加查詢參數（支援分頁覆蓋）
		if (sendQuery || paginationOverrides?.queryParams) {
			let queryParams: Record<string, string> = {};
			
			// 添加基本查詢參數
			if (sendQuery) {
				const specifyQuery = executeFunctions.getNodeParameter('specifyQuery', itemIndex, 'keypair') as string;
				if (specifyQuery === 'keypair') {
					let queryParameters: Array<{ name: string; value: string }> = [];
					try {
						queryParameters = executeFunctions.getNodeParameter('queryParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
					} catch (_e) {
						try {
							const queryParams = executeFunctions.getNodeParameter('queryParameters', itemIndex, {}) as { parameters?: Array<{ name: string; value: string }> };
							if (queryParams && queryParams.parameters) {
								queryParameters = queryParams.parameters;
							}
						} catch (_e2) {
							queryParameters = [];
						}
					}
					if (queryParameters.length) {
						for (const parameter of queryParameters) {
							if (parameter.name && parameter.name.trim() !== '') {
								queryParams[parameter.name] = parameter.value;
							}
						}
					}
				} else {
					const queryJson = executeFunctions.getNodeParameter('queryParametersJson', itemIndex, '{}') as string;
					try {
						queryParams = JSON.parse(queryJson);
					} catch (_e) {
						throw new NodeOperationError(executeFunctions.getNode(), 'Query Parameters (JSON) must be a valid JSON object', { itemIndex });
					}
				}
			}
			
			// 合併分頁查詢參數
			if (paginationOverrides?.queryParams) {
				Object.assign(queryParams, paginationOverrides.queryParams);
			}
			
			if (Object.keys(queryParams).length > 0) {
				const url = new URL(baseUrl);
				for (const [key, value] of Object.entries(queryParams)) {
					url.searchParams.set(key, String(value));
				}
				requestOptions.url = url.toString();
			}
		}
		
		// 處理標頭（支援分頁覆蓋）
		const lowercaseHeaders = options.lowercaseHeaders || false;
		let headers: Record<string, string> = {};
		
		const sendHeaders = executeFunctions.getNodeParameter('sendHeaders', itemIndex, false) as boolean;
		if (sendHeaders) {
			const specifyHeaders = executeFunctions.getNodeParameter('specifyHeaders', itemIndex, 'keypair') as string;
			if (specifyHeaders === 'keypair') {
				try {
					const headerParameters = executeFunctions.getNodeParameter('headerParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
					if (headerParameters.length) {
						for (const parameter of headerParameters) {
							if (parameter.name && parameter.name.trim() !== '') {
								const headerName = lowercaseHeaders ? parameter.name.toLowerCase() : parameter.name;
								headers[headerName] = parameter.value;
							}
						}
					}
				} catch (_e) {
					// Error handling
				}
			} else {
				const headersJson = executeFunctions.getNodeParameter('headersJson', itemIndex, '{}') as string;
				try {
					const parsedHeaders = JSON.parse(headersJson);
					for (const key in parsedHeaders) {
						if (Object.prototype.hasOwnProperty.call(parsedHeaders, key)) {
							const headerName = lowercaseHeaders ? key.toLowerCase() : key;
							headers[headerName] = parsedHeaders[key];
						}
					}
				} catch (_e) {
					throw new NodeOperationError(executeFunctions.getNode(), 'Headers (JSON) must be a valid JSON object', { itemIndex });
				}
			}
		}
		
		// 合併分頁標頭
		if (paginationOverrides?.headers) {
			Object.assign(headers, paginationOverrides.headers);
		}
		
		// 添加代理認證標頭
		if (proxyAuthHeader) {
			headers['Proxy-Authorization'] = proxyAuthHeader;
		}
		
		requestOptions.headers = headers;
		
		// 處理請求體（支援分頁覆蓋）
		if (paginationOverrides?.body) {
			requestOptions.data = paginationOverrides.body;
			if (!headers['Content-Type'] && !headers['content-type']) {
				headers['Content-Type'] = 'application/json';
			}
		} else if (executeFunctions.getNodeParameter('sendBody', itemIndex, false) as boolean) {
			const contentType = executeFunctions.getNodeParameter('contentType', itemIndex, 'json') as string;
			
			if (contentType === 'json' || contentType === 'form-urlencoded') {
				const specifyBody = executeFunctions.getNodeParameter('specifyBody', itemIndex, 'keypair') as string;
				
				if (contentType === 'json') {
					headers['Content-Type'] = 'application/json';
				} else {
					headers['Content-Type'] = 'application/x-www-form-urlencoded';
				}
				
				if (specifyBody === 'keypair') {
					try {
						const bodyParameters = executeFunctions.getNodeParameter('bodyParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
						
						if (bodyParameters.length) {
							const bodyParams: Record<string, string> = {};
							for (const parameter of bodyParameters) {
								if (parameter.name && parameter.name.trim() !== '') {
									bodyParams[parameter.name] = parameter.value;
								}
							}
							
							if (contentType === 'json') {
								requestOptions.data = bodyParams;
							} else {
								const queryString = Object.entries(bodyParams)
									.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
									.join('&');
								requestOptions.data = queryString;
							}
						}
					} catch (_e) {
						// Error handling
					}
				} else {
					const bodyJson = executeFunctions.getNodeParameter('bodyParametersJson', itemIndex, '{}') as string;
					if (contentType === 'json') {
						try {
							requestOptions.data = JSON.parse(bodyJson);
						} catch (_e) {
							requestOptions.data = bodyJson;
						}
					} else {
						try {
							const parsedJson = JSON.parse(bodyJson);
							const queryString = Object.entries(parsedJson)
								.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
								.join('&');
							requestOptions.data = queryString;
						} catch (_e) {
							requestOptions.data = bodyJson;
						}
					}
				}
			}
		}
		
		// 配置代理和代理
		const allowUnauthorizedCerts = options.allowUnauthorizedCerts || false;
		const timeoutMs = options.timeout || 30000;
		
		const connectionPoolSettings = executeFunctions.getNodeParameter('options.connectionPool', itemIndex, {
			keepAlive: true,
			maxSockets: 50,
			maxFreeSockets: 10,
		}) as {
			keepAlive?: boolean;
			maxSockets?: number;
			maxFreeSockets?: number;
		};
		
		if (useProxy && cleanProxyHost) {
			if (baseUrl.startsWith('https:')) {
				const proxyUrl = proxySettings?.proxyAuth && proxySettings.proxyUsername && proxySettings.proxyPassword
					? `http://${proxySettings.proxyUsername}:${proxySettings.proxyPassword}@${cleanProxyHost}:${proxyPort}`
					: `http://${cleanProxyHost}:${proxyPort}`;
				
				const httpsProxyAgent = connectionPool.getProxyAgent(proxyUrl, {
					rejectUnauthorized: !allowUnauthorizedCerts,
					timeout: timeoutMs,
					maxSockets: connectionPoolSettings.maxSockets,
					maxFreeSockets: connectionPoolSettings.maxFreeSockets,
				});
				
				requestOptions.httpsAgent = httpsProxyAgent;
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				process.env.NODE_TLS_REJECT_UNAUTHORIZED = allowUnauthorizedCerts ? '0' : '1';
			} else {
				const httpAgent = connectionPool.getHttpAgent({
					timeout: timeoutMs,
					keepAlive: connectionPoolSettings.keepAlive !== false,
					maxSockets: connectionPoolSettings.maxSockets,
					maxFreeSockets: connectionPoolSettings.maxFreeSockets,
				});
				
				requestOptions.proxy = {
					host: cleanProxyHost,
					port: proxyPort,
					protocol: 'http:',
				};
				
				requestOptions.httpAgent = httpAgent;
			}
		} else {
			if (baseUrl.startsWith('https:')) {
				requestOptions.httpsAgent = connectionPool.getHttpsAgent({
					timeout: timeoutMs,
					keepAlive: connectionPoolSettings.keepAlive !== false,
					rejectUnauthorized: !allowUnauthorizedCerts,
					maxSockets: connectionPoolSettings.maxSockets,
					maxFreeSockets: connectionPoolSettings.maxFreeSockets,
				});
			} else {
				requestOptions.httpAgent = connectionPool.getHttpAgent({
					timeout: timeoutMs,
					keepAlive: connectionPoolSettings.keepAlive !== false,
					maxSockets: connectionPoolSettings.maxSockets,
					maxFreeSockets: connectionPoolSettings.maxFreeSockets,
				});
			}
		}
		
		// 設置回應類型
		requestOptions.responseType = 'text';
		
		// 設置重定向選項並追蹤重定向歷史
		const redirectSettings = options.redirect?.redirect;
		const redirectHistory: Array<{ url: string; statusCode: number; headers: Record<string, any> }> = [];
		
		if (redirectSettings?.followRedirects === false) {
			requestOptions.maxRedirects = 0;
		} else if (redirectSettings?.followRedirects === true && redirectSettings?.maxRedirects !== undefined) {
			requestOptions.maxRedirects = redirectSettings.maxRedirects;
		} else {
			requestOptions.maxRedirects = 21;
		}
		
		// 創建 axios 實例以追蹤重定向
		const axiosInstance = axios.create();
		
		// 添加請求攔截器來記錄重定向歷史
		axiosInstance.interceptors.request.use((config) => {
			// 記錄每個請求的 URL（包括重定向）
			if (redirectHistory.length === 0) {
				// 第一個請求
				redirectHistory.push({
					url: config.url || baseUrl,
					statusCode: 0, // 請求階段，還沒有狀態碼
					headers: config.headers || {},
				});
			}
			return config;
		});
		
		// 添加回應攔截器來記錄重定向歷史
		axiosInstance.interceptors.response.use(
			(response) => {
				// 記錄最終回應
				if (response.request && response.request.res && response.request.res.responseUrl) {
					// 如果有重定向，記錄最終 URL
					const finalUrl = response.request.res.responseUrl;
					if (finalUrl !== baseUrl) {
						redirectHistory.push({
							url: finalUrl,
							statusCode: response.status,
							headers: response.headers,
						});
					}
				}
				
				// 更新第一個記錄的狀態碼
				if (redirectHistory.length > 0) {
					redirectHistory[0].statusCode = response.status;
				}
				
				return response;
			},
			(error) => {
				// 處理重定向錯誤
				if (error.response && [301, 302, 303, 307, 308].includes(error.response.status)) {
					redirectHistory.push({
						url: error.config?.url || error.request?.path || baseUrl,
						statusCode: error.response.status,
						headers: error.response.headers,
					});
				}
				return Promise.reject(error);
			}
		);
		
		// 設置 never error 選項
		if (options.neverError === true) {
			requestOptions.validateStatus = () => true;
		}
		
		// 執行請求（使用自訂的 axios 實例）
		const response = await axiosInstance(requestOptions);
		
		// 清除超時計時器
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		
		// 處理回應
		let responseData;
		const contentType = response.headers['content-type'] || '';
		
		const responseFormat = options.responseFormat || 'autodetect';
		
		if (responseFormat === 'file') {
			const outputFieldName = options.outputFieldName || 'data';
			responseData = {} as Record<string, unknown>;
			responseData[outputFieldName] = await executeFunctions.helpers.prepareBinaryData(
				Buffer.from(response.data),
				undefined,
				contentType,
			);
		} else if (responseFormat === 'json' || (responseFormat === 'autodetect' && contentType.includes('application/json'))) {
			try {
				responseData = JSON.parse(response.data);
			} catch (_e) {
				if (responseFormat === 'json') {
					throw new NodeOperationError(
						executeFunctions.getNode(),
						'Response is not valid JSON. Try using "Auto-detect" or "Text" response format.',
						{ itemIndex },
					);
				}
				responseData = response.data;
			}
		} else {
			if (responseFormat === 'text') {
				const outputFieldName = options.outputFieldName || 'data';
				responseData = {} as Record<string, unknown>;
				responseData[outputFieldName] = response.data;
			} else {
				responseData = response.data;
			}
		}
		
		// 應用回應優化
		let executionData: any;
		if (options.fullResponse === true) {
			executionData = {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
				data: responseData,
			};
		} else {
			if (typeof responseData === 'string') {
				executionData = { data: responseData };
			} else {
				executionData = responseData;
			}
		}
		
		// 返回回應數據，包含分頁所需的額外元數據和重定向歷史
		return {
			json: {
				...executionData,
				$response: {
					statusCode: response.status,
					statusText: response.statusText,
					headers: response.headers,
					body: responseData,
					redirectHistory: redirectHistory.length > 1 ? redirectHistory : undefined, // 只有在有重定向時才包含歷史
				}
			},
			pairedItem: { item: itemIndex },
		};
		
	} catch (error) {
		// 清除超時計時器
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		
		// 增強錯誤處理
		let errorMessage = error.message;
		
		if (errorMessage === 'canceled' || error.code === 'ERR_CANCELED') {
			const currentOptions = executeFunctions.getNodeParameter('options', itemIndex, {}) as {
				timeout?: number;
			};
			const timeout = currentOptions.timeout || 30000;
			errorMessage = `Request canceled due to timeout (${timeout}ms). This was triggered by the node's timeout setting. If you need more time to complete the request, please increase the timeout value.`;
		} else if (errorMessage.includes('tunneling socket could not be established')) {
			const errorProxySettings = executeFunctions.getNodeParameter('options.proxy.settings', itemIndex, {}) as {
				proxyUrl?: string;
			};
			const proxyUrl = errorProxySettings?.proxyUrl || '';
			
			if (!proxyUrl.includes(':')) {
				errorMessage = `Invalid proxy address format: missing port number. The correct format should be "myproxy:3128" or "http://myproxy:3128".`;
			} else if (errorMessage.includes('ENOTFOUND')) {
				errorMessage = `Unable to connect to proxy server: host not found. Please check if the proxy address is correct.`;
			} else if (errorMessage.includes('ECONNREFUSED')) {
				errorMessage = `Proxy server connection refused. Please verify the proxy server is running and the port number is correct.`;
			} else if (errorMessage.includes('ETIMEDOUT')) {
				errorMessage = `Proxy server connection timeout. Please check your network connection or if the proxy server is available.`;
			}
		} else if (errorMessage.includes('certificate') || errorMessage.includes('self-signed')) {
			errorMessage = `SSL certificate error: ${errorMessage}\n\n[SOLUTION] Please enable the "Ignore SSL Issues (Insecure)" option in the node settings to ignore SSL certificate problems.\n\nNote: This will reduce connection security and is only recommended in trusted environments.`;
		}
		
		throw new NodeOperationError(executeFunctions.getNode(), errorMessage, { itemIndex });
	}
}

// 條件式重定向輔助函數
export function shouldApplyRedirectCondition(
	condition: {
		type: 'statusCode' | 'header' | 'url';
		operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
		value: string;
		action: 'follow' | 'stop' | 'custom';
		customUrl?: string;
	},
	responseDetails: any
): boolean {
	const { type, operator, value } = condition;
	
	let targetValue: string;
	
	switch (type) {
		case 'statusCode':
			targetValue = String(responseDetails.statusCode || '');
			break;
		case 'header':
			// 假設 value 格式為 "header-name:expected-value"
			const [headerName, expectedValue] = value.split(':');
			if (!headerName || !expectedValue) return false;
			targetValue = String(responseDetails.headers?.[headerName.toLowerCase()] || '');
			// 更新比較值為期望值
			return evaluateCondition(targetValue, operator, expectedValue);
		case 'url':
			targetValue = String(responseDetails.url || '');
			break;
		default:
			return false;
	}
	
	return evaluateCondition(targetValue, operator, value);
}

// 條件評估輔助函數
export function evaluateCondition(targetValue: string, operator: string, expectedValue: string): boolean {
	switch (operator) {
		case 'equals':
			return targetValue === expectedValue;
		case 'contains':
			return targetValue.includes(expectedValue);
		case 'startsWith':
			return targetValue.startsWith(expectedValue);
		case 'endsWith':
			return targetValue.endsWith(expectedValue);
		case 'regex':
			try {
				const regex = new RegExp(expectedValue);
				return regex.test(targetValue);
			} catch (_error) {
				console.warn(`Invalid regex pattern: ${expectedValue}`);
				return false;
			}
		default:
			return false;
	}
}

// cURL 匯入增強功能
export function parseCurlCommand(curlCommand: string): {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: string;
	queryParams: Record<string, string>;
	proxySettings?: {
		proxyUrl: string;
		proxyAuth?: boolean;
		proxyUsername?: string;
		proxyPassword?: string;
	};
	authSettings?: {
		type: 'basic' | 'bearer' | 'custom';
		username?: string;
		password?: string;
		token?: string;
		customHeaders?: Record<string, string>;
	};
	options: {
		followRedirects?: boolean;
		maxRedirects?: number;
		timeout?: number;
		allowUnauthorizedCerts?: boolean;
	};
} {
	const result: {
		url: string;
		method: string;
		headers: Record<string, string>;
		body?: string;
		queryParams: Record<string, string>;
		proxySettings?: {
			proxyUrl: string;
			proxyAuth?: boolean;
			proxyUsername?: string;
			proxyPassword?: string;
		};
		authSettings?: {
			type: 'basic' | 'bearer' | 'custom';
			username?: string;
			password?: string;
			token?: string;
			customHeaders?: Record<string, string>;
		};
		options: {
			followRedirects?: boolean;
			maxRedirects?: number;
			timeout?: number;
			allowUnauthorizedCerts?: boolean;
		};
	} = {
		url: '',
		method: 'GET',
		headers: {},
		queryParams: {},
		options: {},
	};

	// 移除 curl 命令前綴
	let command = curlCommand.trim();
	if (command.startsWith('curl ')) {
		command = command.substring(5);
	}

	// 解析參數
	const args = parseCurlArguments(command);
	
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		
		switch (arg) {
			case '-X':
			case '--request':
				if (i + 1 < args.length) {
					result.method = args[++i].toUpperCase();
				}
				break;
				
			case '-H':
			case '--header':
				if (i + 1 < args.length) {
					const header = args[++i];
					const colonIndex = header.indexOf(':');
					if (colonIndex > 0) {
						const key = header.substring(0, colonIndex).trim();
						const value = header.substring(colonIndex + 1).trim();
						result.headers[key] = value;
						
						// 檢測認證標頭
						if (key.toLowerCase() === 'authorization') {
							if (value.startsWith('Bearer ')) {
								result.authSettings = {
									type: 'bearer',
									token: value.substring(7),
								};
							} else if (value.startsWith('Basic ')) {
								try {
									const decoded = Buffer.from(value.substring(6), 'base64').toString();
									const [username, password] = decoded.split(':');
									result.authSettings = {
										type: 'basic',
										username,
										password,
									};
								} catch (_error) {
									// 保留原始標頭
								}
							}
						}
					}
				}
				break;
				
			case '-d':
			case '--data':
			case '--data-raw':
				if (i + 1 < args.length) {
					result.body = args[++i];
					if (result.method === 'GET') {
						result.method = 'POST';
					}
				}
				break;
				
			case '-u':
			case '--user':
				if (i + 1 < args.length) {
					const userPass = args[++i];
					const colonIndex = userPass.indexOf(':');
					if (colonIndex > 0) {
						result.authSettings = {
							type: 'basic',
							username: userPass.substring(0, colonIndex),
							password: userPass.substring(colonIndex + 1),
						};
					}
				}
				break;
				
			case '--proxy':
				if (i + 1 < args.length) {
					result.proxySettings = {
						proxyUrl: args[++i],
					};
				}
				break;
				
			case '--proxy-user':
				if (i + 1 < args.length) {
					const userPass = args[++i];
					const colonIndex = userPass.indexOf(':');
					if (colonIndex > 0) {
						if (!result.proxySettings) {
							result.proxySettings = { proxyUrl: '' };
						}
						result.proxySettings.proxyAuth = true;
						result.proxySettings.proxyUsername = userPass.substring(0, colonIndex);
						result.proxySettings.proxyPassword = userPass.substring(colonIndex + 1);
					}
				}
				break;
				
			case '-L':
			case '--location':
				result.options.followRedirects = true;
				break;
				
			case '--max-redirs':
				if (i + 1 < args.length) {
					result.options.maxRedirects = parseInt(args[++i], 10);
				}
				break;
				
			case '--connect-timeout':
			case '--max-time':
				if (i + 1 < args.length) {
					result.options.timeout = parseInt(args[++i], 10) * 1000; // 轉換為毫秒
				}
				break;
				
			case '-k':
			case '--insecure':
				result.options.allowUnauthorizedCerts = true;
				break;
				
			default:
				// 如果不是選項且包含 http，可能是 URL
				if (!arg.startsWith('-') && (arg.includes('http://') || arg.includes('https://'))) {
					try {
						const url = new URL(arg);
						result.url = `${url.protocol}//${url.host}${url.pathname}`;
						
						// 解析查詢參數
						url.searchParams.forEach((value, key) => {
							result.queryParams[key] = value;
						});
					} catch (_error) {
						// 如果 URL 解析失敗，直接使用原始字串
						result.url = arg;
					}
				}
				break;
		}
	}

	return result;
}

// 解析 cURL 參數的輔助函數
export function parseCurlArguments(command: string): string[] {
	const args: string[] = [];
	let current = '';
	let inQuotes = false;
	let quoteChar = '';
	let escaped = false;

	for (let i = 0; i < command.length; i++) {
		const char = command[i];

		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}

		if (char === '\\') {
			escaped = true;
			continue;
		}

		if (!inQuotes && (char === '"' || char === "'")) {
			inQuotes = true;
			quoteChar = char;
			continue;
		}

		if (inQuotes && char === quoteChar) {
			inQuotes = false;
			quoteChar = '';
			continue;
		}

		if (!inQuotes && char === ' ') {
			if (current.trim()) {
				args.push(current.trim());
				current = '';
			}
			continue;
		}

		current += char;
	}

	if (current.trim()) {
		args.push(current.trim());
	}

	return args;
}

// 將解析的 cURL 資料轉換為節點參數
export function curlToNodeParameters(curlData: ReturnType<typeof parseCurlCommand>): Record<string, any> {
	const nodeParams: Record<string, any> = {
		method: curlData.method,
		url: curlData.url,
		sendQuery: Object.keys(curlData.queryParams).length > 0,
		sendHeaders: Object.keys(curlData.headers).length > 0,
		sendBody: !!curlData.body,
		options: {
			...curlData.options,
		},
	};

	// 設置查詢參數
	if (nodeParams.sendQuery) {
		nodeParams.specifyQuery = 'keypair';
		nodeParams.queryParameters = {
			parameters: Object.entries(curlData.queryParams).map(([name, value]) => ({
				name,
				value,
			})),
		};
	}

	// 設置標頭
	if (nodeParams.sendHeaders) {
		nodeParams.specifyHeaders = 'keypair';
		nodeParams.headerParameters = {
			parameters: Object.entries(curlData.headers).map(([name, value]) => ({
				name,
				value,
			})),
		};
	}

	// 設置請求體
	if (nodeParams.sendBody) {
		nodeParams.contentType = 'raw';
		nodeParams.rawContentType = 'text';
		nodeParams.body = curlData.body;
	}

	// 設置代理
	if (curlData.proxySettings) {
		nodeParams.options.proxy = {
			settings: curlData.proxySettings,
		};
	}

	// 設置認證
	if (curlData.authSettings) {
		nodeParams.authentication = curlData.authSettings.type;
		if (curlData.authSettings.type === 'basic') {
			nodeParams.basicAuth = {
				user: curlData.authSettings.username,
				password: curlData.authSettings.password,
			};
		} else if (curlData.authSettings.type === 'bearer') {
			nodeParams.bearerTokenAuth = {
				token: curlData.authSettings.token,
			};
		}
	}

	return nodeParams;
}