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
							// Predefined credential types will be handled by n8n's built-in authentication system
							// This is a placeholder for future implementation
							console.log(`Using predefined credential type: ${nodeCredentialType}`);
							// TODO: Implement predefined credential type handling
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
		
		return [returnItems];
	}
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
	_returnItems: INodeExecutionData[]
): Promise<void> {
	// 暫時實作簡化版分頁，後續可以完善
	// 目前先返回，避免編譯錯誤
	console.log('Pagination feature is under development');
	
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

	// TODO: 實作完整的分頁邏輯
	// 目前暫時返回空，避免編譯錯誤
	console.log('Continue expression:', continueExpression);
	console.log('Pagination request data:', paginationRequestData);
}

// TODO: 實作完整的分頁請求邏輯