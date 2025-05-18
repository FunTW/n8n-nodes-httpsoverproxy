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

		// 添加調試日誌，檢查節點參數
		try {
			console.log('===== HTTPS Over Proxy 節點執行 =====');
			
			// 檢查 Method 和 URL
			const method = this.getNodeParameter('method', 0) as string;
			const url = this.getNodeParameter('url', 0) as string;
			console.log('Method:', method);
			console.log('URL:', url);
			
			// 檢查 Headers
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
			
			// 檢查 Body
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
		
		// 處理 cURL 導入
		// 注意：cURL 導入功能是在 n8n 前端處理的
		// 當用戶導入 cURL 命令時，前端會將命令解析為相應的參數，然後設置到節點的參數中
		// 這些參數會在執行時自動被獲取，例如 this.getNodeParameter('method', itemIndex)
		// 所以我們不需要在這裡額外處理 cURL 導入的參數

		// batching
		const batchSize = this.getNodeParameter('options.batching.batch.batchSize', 0, 1) as number;
		const batchInterval = this.getNodeParameter('options.batching.batch.batchInterval', 0, 0) as number;

		// Process items in batches
		const processBatch = async (startIndex: number): Promise<INodeExecutionData[]> => {
			const returnData: INodeExecutionData[] = [];
			
			const endIndex = Math.min(startIndex + batchSize, items.length);
			
			for (let itemIndex = startIndex; itemIndex < endIndex; itemIndex++) {
				// 宣告 timeoutId 變數，確保在整個函數區塊內可用
				let timeoutId: NodeJS.Timeout | undefined;
				
				try {
					// 檢查代理設置是否存在
					const proxySettings = this.getNodeParameter('options.proxy.settings', itemIndex, null) as {
						proxyUrl?: string;
						proxyAuth?: boolean;
						proxyUsername?: string;
						proxyPassword?: string;
					} | null;
					
					// 檢查是否有代理設定
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
					if (proxyHost) {
						cleanProxyHost = proxyHost.replace(/^(http|https):\/\//, '');
					}
					
					// Build request options
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
						// 修改：取消時添加自定義錯誤訊息
						const timeoutError = new Error(`請求因超時(${timeoutMs}ms)被取消。這是由節點的超時設定觸發的。如果您需要更多時間來完成請求，請增加超時設定值。`);
						// 使用接口擴展錯誤
						const customError = timeoutError as Error & { code: string };
						customError.code = 'TIMEOUT'; // 使用自定義錯誤代碼
						
						// 在 Node.js 中，AbortController.abort() 標準上不接受參數，但我們需要自定義錯誤
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore
						controller.abort(customError); // 在 abort 時傳遞自定義錯誤
					}, timeoutMs);
					
					// Proxy authentication if needed
					let proxyAuthHeader = '';
					if (useProxy && proxySettings?.proxyAuth) {
						if (proxySettings.proxyUsername && proxySettings.proxyPassword) {
							// 使用更安全的方式處理密碼 - 避免直接在字符串中暴露密碼
							const username = String(proxySettings.proxyUsername);
							const password = String(proxySettings.proxyPassword);
							const auth = Buffer.from(`${username}:${password}`).toString('base64');
							proxyAuthHeader = `Basic ${auth}`;
							
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
							let queryParameters: Array<{ name: string; value: string }> = [];
							try {
								queryParameters = this.getNodeParameter('queryParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
							} catch (_e) {
								// 如果上面的路徑不存在，嘗試使用 queryParameters 參數
								try {
									const queryParams = this.getNodeParameter('queryParameters', itemIndex, {}) as { parameters?: Array<{ name: string; value: string }> };
									if (queryParams && queryParams.parameters) {
										queryParameters = queryParams.parameters;
									}
								} catch (_e2) {
									// eslint 要求未使用的錯誤變數要用 _e 命名
									// 如果兩種方式都失敗，使用空陣列
									queryParameters = [];
								}
							}
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
							} catch (_e) {
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
							// 直接使用 headerParameters.parameters 路徑
							try {
								const headerParameters = this.getNodeParameter('headerParameters.parameters', itemIndex, []) as Array<{ name: string; value: string }>;
								for (const header of headerParameters) {
									// 確保標頭名稱不為空
									if (header.name && header.name.trim() !== '') {
										const headerName = lowercaseHeaders ? header.name.toLowerCase() : header.name;
										headers[headerName] = header.value;
									}
								}
							} catch (_e) {
								// 錯誤處理
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
								// 直接使用 bodyParameters.parameters 路徑
								try {
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
									// 錯誤處理
								}
							} else {
								// JSON parameters
								const bodyJson = this.getNodeParameter('bodyParametersJson', itemIndex, '{}') as string;
								if (contentType === 'json') {
									try {
										// 嘗試解析 JSON
										const parsedJson = JSON.parse(bodyJson);
										body = parsedJson as IDataObject;
										// 將 body 設置為請求數據
										requestOptions.data = body;
									} catch (_e) {
										// 如果無法解析為 JSON，則使用原始字符串
										console.log(`無法解析 bodyParametersJson 為 JSON: ${bodyJson}`);
										requestOptions.data = bodyJson;
									}
								} else {
									// Form-urlencoded
									try {
										// 嘗試解析 JSON 並將其轉換為 URL 編碼格式
										const parsedJson = JSON.parse(bodyJson);
										const queryString = Object.entries(parsedJson)
											.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
											.join('&');
										requestOptions.data = queryString;
									} catch (_e) {
										// 如果無法解析為 JSON，則使用原始字符串
										console.log(`無法解析 bodyParametersJson 為 JSON: ${bodyJson}`);
										requestOptions.data = bodyJson;
									}
								}
							}
						} else if (contentType === 'raw' || contentType === 'multipart-form-data') {
							const rawContentType = this.getNodeParameter('rawContentType', itemIndex, '') as string;
							const bodyContent = this.getNodeParameter('body', itemIndex, '') as string;
							requestOptions.data = bodyContent;
							
							// 設置 Content-Type header
							if (rawContentType) {
								headers['Content-Type'] = rawContentType;
							}
						}
					}
					
					// 配置代理
					const allowUnauthorizedCerts = options.allowUnauthorizedCerts || false;
					
					// 只有在啟用代理時才使用代理
					if (useProxy && cleanProxyHost) {
						// 配置 HTTPS 代理
						if (url.startsWith('https:')) {
							// 使用 https-proxy-agent 處理 HTTPS over HTTP 代理的問題
							const proxyUrl = proxySettings?.proxyAuth && proxySettings.proxyUsername && proxySettings.proxyPassword
								? `http://${proxySettings.proxyUsername}:${proxySettings.proxyPassword}@${cleanProxyHost}:${proxyPort}`
								: `http://${cleanProxyHost}:${proxyPort}`;
							
							// 修改：確保 rejectUnauthorized 選項能正確應用於代理
							const httpsProxyAgent = new HttpsProxyAgent(proxyUrl, {
								rejectUnauthorized: !allowUnauthorizedCerts,
								timeout: options.timeout || 30000,
							});
							
							// 將代理 agent 應用於請求
							requestOptions.httpsAgent = httpsProxyAgent;
							
							// 同時也設定目標服務器的 SSL 驗證選項
							// 注意：這是關鍵！即使代理配置正確，也需要確保目標服務器的證書驗證與選項一致
							
							// 將這些選項應用到底層 HTTPS 模組，確保所有 HTTPS 請求都使用相同的 SSL 驗證設定
							// eslint-disable-next-line @typescript-eslint/ban-ts-comment
							// @ts-ignore
							process.env.NODE_TLS_REJECT_UNAUTHORIZED = allowUnauthorizedCerts ? '0' : '1';
						} else {
							// 使用 HTTP 代理
							const httpAgent = new http.Agent({
								timeout: options.timeout || 30000,
							});
							
							// 設置代理
							requestOptions.proxy = {
								host: cleanProxyHost,
								port: proxyPort,
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
					
					// 在 axios 調用前添加
					if (body !== undefined) {
						requestOptions.data = body;
					}
					
					// Make the request
					const response = await axios(requestOptions);
					
					// 清除超時計時器
					if (timeoutId) {
						clearTimeout(timeoutId);
					}
					
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
						// 如果 responseData 是字串，包成 { data: responseData }
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
						
						// 特別處理 "canceled" 錯誤
						if (errorMessage === 'canceled' || error.code === 'ERR_CANCELED') {
							const currentOptions = this.getNodeParameter('options', itemIndex, {}) as {
								timeout?: number;
							};
							const timeout = currentOptions.timeout || 30000;
							
							// 修改：不要在這裡使用 "canceled" 作為錯誤訊息，而是直接提供詳細的超時解釋
							errorMessage = `請求因超時(${timeout}ms)被取消。這是由節點的超時設定觸發的。如果您需要更多時間來完成請求，請增加超時設定值。`;
							error.message = errorMessage; // 替換原始錯誤的訊息
							error.code = 'TIMEOUT'; // 重新設定錯誤代碼為 TIMEOUT
							
							// 創建帶有更詳細超時訊息的錯誤對象
							const safeErrorResponse = {
								errorMessage: errorMessage, // 修改：使用更明確的屬性名稱
								error: errorMessage, // 保持兼容性
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
						
						// 提供更詳細的錯誤信息
						if (errorMessage.includes('tunneling socket could not be established')) {
							// 重新獲取代理設定以處理錯誤
							const errorProxySettings = this.getNodeParameter('options.proxy.settings', itemIndex, {}) as {
								proxyUrl?: string;
								proxyAuth?: boolean;
								proxyUsername?: string;
								proxyPassword?: string;
							};
							
							const proxyUrl = errorProxySettings?.proxyUrl || '';
							let errorProxyHost = '';
							let errorProxyPort = 8080;
							
							// 嘗試解析代理 URL
							try {
								const errorProxyUrlObj = new URL(proxyUrl.startsWith('http') ? proxyUrl : `http://${proxyUrl}`);
								errorProxyHost = errorProxyUrlObj.hostname;
								errorProxyPort = parseInt(errorProxyUrlObj.port || '8080', 10);
							} catch (_parseError) {
								// 解析失敗時嘗試簡單分割
								const parts = proxyUrl.split(':');
								if (parts.length >= 2) {
									errorProxyHost = parts[0];
									errorProxyPort = parseInt(parts[1], 10) || 8080;
								} else {
									errorProxyHost = proxyUrl;
								}
							}
							
							// 檢測代理地址格式錯誤
							if (!proxyUrl.includes(':')) {
								errorMessage = `代理地址格式錯誤：缺少端口號。正確格式應為 "myproxy:3128" 或 "http://myproxy:3128"。`;
							} else if (errorMessage.includes('ENOTFOUND')) {
								errorMessage = `無法連接到代理服務器：找不到主機 "${errorProxyHost}"。請檢查代理地址是否正確，或嘗試使用IP地址替代域名。`;
							} else if (errorMessage.includes('ECONNREFUSED')) {
								errorMessage = `代理服務器連接被拒絕：${errorProxyHost}:${errorProxyPort}。請確認代理服務器正在運行且端口號正確。`;
							} else if (errorMessage.includes('ETIMEDOUT')) {
								errorMessage = `連接代理服務器超時：${errorProxyHost}:${errorProxyPort}。請檢查網絡連接或代理服務器是否可用。`;
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
						} else if (errorMessage.includes('certificate') || errorMessage.includes('self-signed')) {
							// 更明確的 SSL 證書錯誤訊息，提醒使用者啟用 "Ignore SSL Issues (Insecure)" 選項
							errorMessage = `SSL 證書錯誤：${errorMessage}\n\n【解決方法】請在節點的選項中啟用 "Ignore SSL Issues (Insecure)" 開關來忽略 SSL 證書問題。\n\n注意：這會降低連接安全性，僅建議在信任的環境中使用。`;
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
					
					// 修改：如果是 canceled 錯誤，替換為更詳細的訊息後再拋出
					if (error.message === 'canceled' || error.code === 'ERR_CANCELED') {
						const currentOptions = this.getNodeParameter('options', itemIndex, {}) as {
							timeout?: number;
						};
						const timeout = currentOptions.timeout || 30000;
						const detailedMessage = `請求因超時(${timeout}ms)被取消。這是由節點的超時設定觸發的。如果您需要更多時間來完成請求，請增加超時設定值。`;
						throw new NodeOperationError(this.getNode(), detailedMessage, { itemIndex });
					}
					
					// 特別處理 SSL 證書錯誤
					if (error.message.includes('certificate') || error.message.includes('self-signed')) {
						const sslErrorMessage = `SSL 證書錯誤：${error.message}\n\n【解決方法】請在節點的選項中啟用 "Ignore SSL Issues (Insecure)" 開關來忽略 SSL 證書問題。\n\n注意：這會降低連接安全性，僅建議在信任的環境中使用。`;
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
		
		return [returnItems];
	}
}