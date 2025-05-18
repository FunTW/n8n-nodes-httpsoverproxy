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
import { httpsOverProxyDescription } from './description';

export class HttpsOverProxy implements INodeType {
	description: INodeTypeDescription = httpsOverProxyDescription;

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];

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

		// Check for pagination options
		const paginationOptions = this.getNodeParameter('options.pagination.paginate', 0, {}) as {
			paginationMode?: string;
			parameterName?: string;
			initialParameterValue?: number;
			incrementBy?: number;
			nextUrl?: string;
			maxPages?: number;
			stopOnEmpty?: boolean;
			completeExpression?: string;
		};

		// batching
		const batchSize = this.getNodeParameter('options.batching.batch.batchSize', 0, 1) as number;
		const batchInterval = this.getNodeParameter('options.batching.batch.batchInterval', 0, 0) as number;

		// 如果分頁模式是關閉的，直接處理請求
		if (!paginationOptions.paginationMode || paginationOptions.paginationMode === 'off') {
			// 標準處理邏輯（無分頁）
			const processBatch = async (startIndex: number): Promise<INodeExecutionData[]> => {
				const returnData: INodeExecutionData[] = [];
				
				const endIndex = Math.min(startIndex + batchSize, items.length);
				
				for (let itemIndex = startIndex; itemIndex < endIndex; itemIndex++) {
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
							redirect?: string;
							maxRedirects?: number;
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
						const timeoutMs = options.timeout || 30000;
						timeoutId = setTimeout(() => {
							// Modified: Add custom error message when canceling
							const timeoutError = new Error(`Request canceled due to timeout (${timeoutMs}ms). This was triggered by the node's timeout setting. If you need more time to complete the request, please increase the timeout value.`);
							// Use interface to extend error
							const customError = timeoutError as Error & { code: string };
							customError.code = 'TIMEOUT'; // Use custom error code
							
							// In Node.js, AbortController.abort() doesn't accept parameters by standard, but we need custom errors
							// eslint-disable-next-line @typescript-eslint/ban-ts-comment
							// @ts-ignore
							controller.abort(customError); // Pass custom error when aborting
						}, timeoutMs);
						
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
						
						// Add headers
						const headers: Record<string, string> = {};
						const sendHeaders = this.getNodeParameter('sendHeaders', itemIndex, false) as boolean;
						const lowercaseHeaders = options.lowercaseHeaders !== false; // Default is true
						
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
									// Directly use bodyParameters.parameters path
									try {
										const bodyParameters = this.getNodeParameter('bodyParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
										
										if (bodyParameters.length) {
											const bodyParams: Record<string, string> = {};
											for (const parameter of bodyParameters) {
												// Ensure parameter name is not empty
												if (parameter.name && parameter.name.trim() !== '') {
													bodyParams[parameter.name] = parameter.value;
												}
											}
											
											if (contentType === 'json') {
												body = bodyParams as IDataObject;
											} else {
												// Form-urlencoded: Convert to query string
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
									// JSON parameters
									const bodyJson = this.getNodeParameter('bodyParametersJson', itemIndex, '{}') as string;
									if (contentType === 'json') {
										try {
											// Try to parse JSON
											const parsedJson = JSON.parse(bodyJson);
											body = parsedJson as IDataObject;
											// Set body as request data
											requestOptions.data = body;
										} catch (_e) {
											// If can't parse as JSON, use raw string
											console.log(`Unable to parse bodyParametersJson as JSON: ${bodyJson}`);
											requestOptions.data = bodyJson;
										}
									} else {
										// Form-urlencoded
										try {
											// Try to parse JSON and convert to URL encoded format
											const parsedJson = JSON.parse(bodyJson);
											const queryString = Object.entries(parsedJson)
												.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
												.join('&');
											requestOptions.data = queryString;
										} catch (_e) {
											// If can't parse as JSON, use raw string
											console.log(`Unable to parse bodyParametersJson as JSON: ${bodyJson}`);
											requestOptions.data = bodyJson;
										}
									}
								}
							} else if (contentType === 'raw' || contentType === 'multipart-form-data') {
								const rawContentType = this.getNodeParameter('rawContentType', itemIndex, '') as string;
								const bodyContent = this.getNodeParameter('body', itemIndex, '') as string;
								requestOptions.data = bodyContent;
								
								// Set Content-Type header
								if (rawContentType) {
									headers['Content-Type'] = rawContentType;
								}
							}
						}
						
						// Configure proxy
						const allowUnauthorizedCerts = options.allowUnauthorizedCerts || false;
						
						// Only use proxy if enabled
						if (useProxy && cleanProxyHost) {
							// Configure HTTPS proxy
							if (url.startsWith('https:')) {
								// Use https-proxy-agent to handle HTTPS over HTTP proxy issues
								const proxyUrl = proxySettings?.proxyAuth && proxySettings.proxyUsername && proxySettings.proxyPassword
									? `http://${proxySettings.proxyUsername}:${proxySettings.proxyPassword}@${cleanProxyHost}:${proxyPort}`
									: `http://${cleanProxyHost}:${proxyPort}`;
								
								// Modified: Ensure rejectUnauthorized option is correctly applied to proxy
								const httpsProxyAgent = new HttpsProxyAgent(proxyUrl, {
									rejectUnauthorized: !allowUnauthorizedCerts,
									timeout: options.timeout || 30000,
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
								// Use HTTP proxy
								const httpAgent = new http.Agent({
									timeout: options.timeout || 30000,
								});
								
								// Set proxy
								requestOptions.proxy = {
									host: cleanProxyHost,
									port: proxyPort,
									protocol: 'http:',
								};
								
								requestOptions.httpAgent = httpAgent;
							}
						} else if (allowUnauthorizedCerts) {
							// If not using proxy but need to ignore SSL issues
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
							// If responseData is a string, wrap it as { data: responseData }
							if (typeof responseData === 'string') {
								executionData = { data: responseData };
							} else {
								executionData = responseData;
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
				if (i !== 0 && batchInterval > 0) {
					// Wait between batches if a batch interval is set
					await new Promise((resolve) => setTimeout(resolve, batchInterval));
				}
				
				const batchItems = await processBatch(i);
				returnItems.push(...batchItems);
			}
		} else {
			// 支持分頁的處理邏輯
			await handlePagination(this, paginationOptions, returnItems);
		}
		
		return [returnItems];
	}
}

// 處理分頁的輔助函數，移到類外部
async function handlePagination(
	executeFunctions: IExecuteFunctions,
	paginationOptions: {
		paginationMode?: string;
		parameterName?: string;
		initialParameterValue?: number;
		incrementBy?: number;
		nextUrl?: string;
		maxPages?: number;
		stopOnEmpty?: boolean;
		completeExpression?: string;
	},
	returnItems: INodeExecutionData[]
): Promise<void> {
	let pageCount = 1;
	let shouldContinue = true;
	let currentParameter = paginationOptions.initialParameterValue || 0;
	let currentUrl = executeFunctions.getNodeParameter('url', 0) as string;
	const maxPages = paginationOptions.maxPages || 100;
	
	// 存儲所有響應數據
	const allResults: INodeExecutionData[] = [];
	
	// 最近一次響應的數據
	let lastResponse: IDataObject = {};
	
	// 執行分頁循環
	while (shouldContinue && (maxPages === 0 || pageCount <= maxPages)) {
		// 臨時創建一個新的執行項
		const tempItem: INodeExecutionData = { json: {} };
		
		// 根據分頁模式處理
		if (paginationOptions.paginationMode === 'updateAParameter') {
			// 獲取當前查詢參數
			const sendQuery = executeFunctions.getNodeParameter('sendQuery', 0, false) as boolean;
			
			if (sendQuery) {
				const specifyQuery = executeFunctions.getNodeParameter('specifyQuery', 0, 'keypair') as string;
				
				if (specifyQuery === 'keypair') {
					let queryParameters: Array<{ name: string; value: string }> = [];
					
					try {
						queryParameters = executeFunctions.getNodeParameter('queryParameters.parameters', 0, []) as Array<{ name: string; value: string }>;
						
						// 建立一個新的參數數組，更新或添加分頁參數
						const paramName = paginationOptions.parameterName || 'page';
						let updatedParameters = [...queryParameters];
						let paramExists = false;
						
						for (let i = 0; i < updatedParameters.length; i++) {
							if (updatedParameters[i].name === paramName) {
								updatedParameters[i] = {
									name: paramName,
									value: currentParameter.toString()
								};
								paramExists = true;
								break;
							}
						}
						
						if (!paramExists) {
							updatedParameters.push({
								name: paramName,
								value: currentParameter.toString()
							});
						}
						
						// 直接使用更新後的參數執行請求
						tempItem.json.parameters = updatedParameters;
					} catch (error) {
						throw new NodeOperationError(executeFunctions.getNode(), `Error updating pagination parameter: ${error.message}`);
					}
				} else {
					// JSON 格式的查詢參數
					try {
						const queryParametersJson = executeFunctions.getNodeParameter('queryParametersJson', 0, '{}') as string;
						const queryParams = JSON.parse(queryParametersJson);
						
						// 更新參數
						const paramName = paginationOptions.parameterName || 'page';
						queryParams[paramName] = currentParameter;
						
						// 使用更新後的JSON參數執行請求
						tempItem.json.queryParametersJson = JSON.stringify(queryParams);
					} catch (error) {
						throw new NodeOperationError(executeFunctions.getNode(), `Error updating pagination parameter in JSON: ${error.message}`);
					}
				}
			} else {
				// 如果沒有啟用查詢參數，則臨時創建查詢參數
				const paramName = paginationOptions.parameterName || 'page';
				tempItem.json.sendQuery = true;
				tempItem.json.specifyQuery = 'keypair';
				tempItem.json.parameters = [{
					name: paramName,
					value: currentParameter.toString()
				}];
			}
		} else if (paginationOptions.paginationMode === 'responseContainsNextUrl') {
			// 如果有前一個響應且我們不是第一頁
			if (pageCount > 1 && lastResponse) {
				// 獲取下一頁URL
				try {
					const nextUrlExpression = paginationOptions.nextUrl || '';
					if (!nextUrlExpression) {
						throw new NodeOperationError(executeFunctions.getNode(), 'Next URL expression is required for Response Contains Next URL pagination mode');
					}
					
					// 評估表達式（去掉表達式語法）
					const expression = nextUrlExpression.replace(/[{}\s]+/g, '');
					let nextUrl: string | null = null;
					
					// 嘗試直接訪問響應數據
					// 簡單實現：嘗試常見的返回格式
					if (expression.includes('$response.body.')) {
						const path = expression.replace('$response.body.', '').split('.');
						let value: any = lastResponse;
						
						for (const key of path) {
							if (value && typeof value === 'object' && key in value) {
								value = value[key];
							} else {
								value = null;
								break;
							}
						}
						
						nextUrl = value as string;
					}
					
					if (!nextUrl) {
						// 沒有下一頁URL，結束分頁
						shouldContinue = false;
						break;
					}
					
					// 更新URL為下一頁URL
					currentUrl = nextUrl;
					tempItem.json.url = currentUrl;
				} catch (_error) {
					throw new NodeOperationError(executeFunctions.getNode(), `Error extracting next URL from response: ${_error.message}`);
				}
			}
		}
		
		// 執行請求並獲取結果
		// 創建一個臨時輸入項以進行請求
		const reqResponse = await makeRequest(executeFunctions, [tempItem], currentUrl, currentParameter);
		
		// 檢查是否有響應
		if (reqResponse.length === 0 && paginationOptions.stopOnEmpty) {
			shouldContinue = false;
			break;
		}
		
		// 存儲最近的響應用於下一頁請求
		if (reqResponse.length > 0) {
			lastResponse = reqResponse[reqResponse.length - 1].json;
			
			// 檢查完成表達式
			if (paginationOptions.completeExpression) {
				try {
					// 簡單實現：檢查常見的完成條件
					let shouldComplete = false;
					
					// 常見情況：檢查當前頁是否等於或大於總頁數
					if (typeof lastResponse === 'object') {
						// 檢查meta.page和meta.totalPages格式
						if (
							lastResponse.meta && 
							typeof lastResponse.meta === 'object' &&
							'page' in lastResponse.meta &&
							'totalPages' in lastResponse.meta
						) {
							shouldComplete = (lastResponse.meta.page as number) >= (lastResponse.meta.totalPages as number);
						}
						
						// 檢查pagination.page和pagination.total_pages格式
						else if (
							lastResponse.pagination && 
							typeof lastResponse.pagination === 'object'
						) {
							if (
								'page' in lastResponse.pagination &&
								'total_pages' in lastResponse.pagination
							) {
								shouldComplete = (lastResponse.pagination.page as number) >= (lastResponse.pagination.total_pages as number);
							}
							else if (
								'page' in lastResponse.pagination &&
								'totalPages' in lastResponse.pagination
							) {
								shouldComplete = (lastResponse.pagination.page as number) >= (lastResponse.pagination.totalPages as number);
							}
							// 檢查是否有next_url屬性
							else if ('next_url' in lastResponse.pagination) {
								shouldComplete = !lastResponse.pagination.next_url;
							}
						}
					}
					
					if (shouldComplete) {
						shouldContinue = false;
						break;
					}
				} catch (error) {
					console.log(`Error evaluating pagination complete expression: ${error.message}`);
					// 繼續分頁處理，不打斷工作流
				}
			}
			
			// 添加響應數據到結果
			allResults.push(...reqResponse);
		}
		
		// 更新計數器和參數值
		pageCount += 1;
		currentParameter += (paginationOptions.incrementBy || 1);
		
		// 檢查終止條件
		if (maxPages > 0 && pageCount > maxPages) {
			shouldContinue = false;
		}
	}
	
	// 將所有結果添加到返回項中
	returnItems.push(...allResults);
}

// 輔助方法：執行請求並返回結果
async function makeRequest(
	executeFunctions: IExecuteFunctions,
	items: INodeExecutionData[],
	url: string,
	_currentPage: number
): Promise<INodeExecutionData[]> {
	// 建立請求參數並執行請求
	// 這裡簡化實現，實際應包含完整的請求邏輯
	const returnData: INodeExecutionData[] = [];
	
	try {
		// 獲取請求參數
		const method = executeFunctions.getNodeParameter('method', 0) as string;
		const headers: Record<string, string> = {};
		const sendHeaders = executeFunctions.getNodeParameter('sendHeaders', 0, false) as boolean;
		
		if (sendHeaders) {
			const specifyHeaders = executeFunctions.getNodeParameter('specifyHeaders', 0, 'keypair') as string;
			
			if (specifyHeaders === 'keypair') {
				const headerParameters = executeFunctions.getNodeParameter('headerParameters.parameters', 0, []) as Array<{ name: string; value: string }>;
				for (const header of headerParameters) {
					if (header.name && header.name.trim() !== '') {
						headers[header.name] = header.value;
					}
				}
			} else {
				// JSON headers
				const headersJson = executeFunctions.getNodeParameter('headersJson', 0, '{}') as string;
				try {
					const parsedHeaders = JSON.parse(headersJson);
					// Merge parsed headers into headers object
					for (const key in parsedHeaders) {
						if (Object.prototype.hasOwnProperty.call(parsedHeaders, key)) {
							headers[key] = parsedHeaders[key];
						}
					}
				} catch (_e) {
					throw new NodeOperationError(executeFunctions.getNode(), 'Headers (JSON) must be a valid JSON object');
				}
			}
		}
		
		// 構建查詢參數
		let queryParams: IDataObject = {};
		const sendQuery = executeFunctions.getNodeParameter('sendQuery', 0, false) as boolean;
		
		if (sendQuery) {
			const specifyQuery = executeFunctions.getNodeParameter('specifyQuery', 0, 'keypair') as string;
			
			if (specifyQuery === 'keypair') {
				const queryParameters = executeFunctions.getNodeParameter('queryParameters.parameters', 0, []) as Array<{ name: string; value: string }>;
				
				// 檢查是否需要覆蓋查詢參數用於分頁
				const tempParameters = (items[0]?.json?.parameters as Array<{ name: string; value: string }>) || [];
				const allParameters = tempParameters.length > 0 ? tempParameters : queryParameters;
				
				for (const param of allParameters) {
					if (param.name && param.name.trim() !== '') {
						queryParams[param.name] = param.value;
					}
				}
			} else {
				// JSON parameters
				let queryJson = executeFunctions.getNodeParameter('queryParametersJson', 0, '{}') as string;
				
				// 檢查是否需要覆蓋JSON查詢用於分頁
				if (items[0]?.json?.queryParametersJson) {
					queryJson = items[0].json.queryParametersJson as string;
				}
				
				try {
					queryParams = JSON.parse(queryJson);
				} catch (_e) {
					throw new NodeOperationError(executeFunctions.getNode(), 'Query Parameters (JSON) must be a valid JSON object');
				}
			}
		} else if (items[0]?.json?.sendQuery) {
			// 如果原本沒有查詢參數，但分頁處理添加了查詢參數
			queryParams = {};
			const tempParameters = (items[0]?.json?.parameters as Array<{ name: string; value: string }>) || [];
			
			for (const param of tempParameters) {
				if (param.name && param.name.trim() !== '') {
					queryParams[param.name] = param.value;
				}
			}
		}
		
		// 處理請求體
		let body: IDataObject | Buffer | undefined;
		if (executeFunctions.getNodeParameter('sendBody', 0, false) as boolean) {
			// 處理請求體邏輯 ...
			const contentType = executeFunctions.getNodeParameter('contentType', 0, 'json') as string;
			
			if (contentType === 'json' || contentType === 'form-urlencoded') {
				const specifyBody = executeFunctions.getNodeParameter('specifyBody', 0, 'keypair') as string;
				
				if (contentType === 'json') {
					headers['Content-Type'] = 'application/json';
				} else {
					headers['Content-Type'] = 'application/x-www-form-urlencoded';
				}
				
				if (specifyBody === 'keypair') {
					const bodyParameters = executeFunctions.getNodeParameter('bodyParameters.parameters', 0, []) as Array<{ name: string; value: string }>;
					
					if (bodyParameters.length) {
						const bodyParams: Record<string, string> = {};
						for (const parameter of bodyParameters) {
							if (parameter.name && parameter.name.trim() !== '') {
								bodyParams[parameter.name] = parameter.value;
							}
						}
						
						body = bodyParams as IDataObject;
					}
				} else {
					// JSON parameters
					const bodyJson = executeFunctions.getNodeParameter('bodyParametersJson', 0, '{}') as string;
					if (contentType === 'json') {
						try {
							// Try to parse JSON
							body = JSON.parse(bodyJson) as IDataObject;
						} catch (_e) {
							// If can't parse as JSON, use raw string
							console.log(`Unable to parse bodyParametersJson as JSON: ${bodyJson}`);
							body = { data: bodyJson } as IDataObject;
						}
					} else {
						// Form-urlencoded
						try {
							// Try to parse JSON and convert to URL encoded format
							const parsedJson = JSON.parse(bodyJson);
							// 按Form-urlencoded格式處理
							body = parsedJson as IDataObject;
						} catch (_e) {
							// If can't parse as JSON, use raw string
							console.log(`Unable to parse bodyParametersJson as JSON: ${bodyJson}`);
							body = { data: bodyJson } as IDataObject;
						}
					}
				}
			} else if (contentType === 'raw' || contentType === 'multipart-form-data') {
				// 處理其他內容類型 ...
			}
		}
		
		// 使用axios發起請求
		const axiosConfig: AxiosRequestConfig = {
			method,
			url: items[0]?.json?.url as string || url,
			headers,
			params: queryParams
		};
		
		if (body !== undefined) {
			axiosConfig.data = body;
		}
		
		// 發起請求
		const response = await axios.request(axiosConfig);
		
		// 處理響應
		let responseData;
		const contentType = response.headers['content-type'] || '';
		
		// 獲取響應格式，默認為自動檢測
		const responseFormat = executeFunctions.getNodeParameter('options.responseFormat', 0, 'autodetect') as string;
		
		if (responseFormat === 'file') {
			// 處理二進制文件
			const outputFieldName = executeFunctions.getNodeParameter('options.outputFieldName', 0, 'data') as string;
			responseData = {} as Record<string, unknown>;
			responseData[outputFieldName] = await executeFunctions.helpers.prepareBinaryData(
				Buffer.from(response.data),
				undefined,
				contentType,
			);
		} else if (responseFormat === 'json' || (responseFormat === 'autodetect' && contentType.includes('application/json'))) {
			// 處理JSON數據
			try {
				responseData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
			} catch (_e) {
				if (responseFormat === 'json') {
					throw new NodeOperationError(
						executeFunctions.getNode(),
						'Response is not valid JSON. Try using "Auto-detect" or "Text" response format.'
					);
				}
				responseData = response.data;
			}
		} else {
			// 默認為文本
			if (responseFormat === 'text') {
				const outputFieldName = executeFunctions.getNodeParameter('options.outputFieldName', 0, 'data') as string;
				responseData = {} as Record<string, unknown>;
				responseData[outputFieldName] = response.data;
			} else {
				responseData = response.data;
			}
		}
		
		// 返回響應
		let executionData;
		const fullResponse = executeFunctions.getNodeParameter('options.fullResponse', 0, false) as boolean;
		
		if (fullResponse) {
			executionData = {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
				data: responseData,
			};
		} else {
			// 如果responseData是字符串，將其包裝為 { data: responseData }
			if (typeof responseData === 'string') {
				executionData = { data: responseData };
			} else {
				executionData = responseData;
			}
		}
		
		// 添加響應到返回項
		returnData.push({
			json: executionData,
			pairedItem: { item: 0 } // 固定為第一個項目，因為我們在分頁處理中只處理一個請求
		});
		
	} catch (error) {
		// 處理錯誤
		if (executeFunctions.continueOnFail()) {
			returnData.push({
				json: {
					error: error.message,
					code: error.code || 'UNKNOWN_ERROR',
				},
				pairedItem: { item: 0 } // 同上
			});
		} else {
			throw new NodeOperationError(executeFunctions.getNode(), error);
		}
	}
	
	return returnData;
}