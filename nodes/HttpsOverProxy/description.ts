import type { INodeTypeDescription } from 'n8n-workflow';

export const httpsOverProxyDescription: INodeTypeDescription = {
	displayName: 'HTTPS Over Proxy',
	name: 'httpsOverProxy',
	icon: 'file:HttpsOverProxy.svg',
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
			name: 'httpBearerAuth',
			required: false,
			displayOptions: {
				show: {
					authentication: ['bearerAuth'],
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
		{
			name: 'httpCustomAuth',
			required: false,
			displayOptions: {
				show: {
					authentication: ['customAuth'],
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
			placeholder: 'https://api.example.com/endpoint',
			description: 'The URL to make the request to. Must be a valid HTTP or HTTPS URL.',
			required: true,
			typeOptions: {
				rows: 1,
			},
		},
		{
			displayName: 'This node specializes in making HTTPS requests through HTTP proxies, solving common proxy tunnel issues that the standard HTTP Request node cannot handle.',
			name: 'proxyNotice',
			type: 'notice',
			default: '',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			noDataExpression: true,
			type: 'options',
			options: [
				{
					name: 'None',
					value: 'none',
				},
				{
					name: 'Predefined Credential Type',
					value: 'predefinedCredentialType',
					description:
						"We've already implemented auth for many services so that you don't have to set it up manually",
				},
				{
					name: 'Generic Credential Type',
					value: 'genericCredentialType',
					description: 'Fully customizable. Choose between basic, header, OAuth2, etc.',
				},
			],
			default: 'none',
			description: 'The authentication method to use for the HTTP request',
		},
		{
			displayName: 'Credential Type',
			name: 'nodeCredentialType',
			type: 'credentialsSelect',
			noDataExpression: true,
			required: true,
			default: '',
			credentialTypes: ['extends:oAuth2Api', 'extends:oAuth1Api', 'has:authenticate'],
			displayOptions: {
				show: {
					authentication: ['predefinedCredentialType'],
				},
			},
		},
		{
			displayName:
				'Make sure you have specified the scope(s) for the Service Account in the credential',
			name: 'googleApiWarning',
			type: 'notice',
			default: '',
			displayOptions: {
				show: {
					nodeCredentialType: ['googleApi'],
				},
			},
		},
		{
			displayName: 'Generic Auth Type',
			name: 'genericAuthType',
			type: 'credentialsSelect',
			required: true,
			default: '',
			credentialTypes: ['has:genericAuth'],
			displayOptions: {
				show: {
					authentication: ['genericCredentialType'],
				},
			},
		},
		{
			displayName: 'Send Query Parameters',
			name: 'sendQuery',
			type: 'boolean',
			default: false,
			noDataExpression: true,
			description: 'Whether to include query parameters in the request URL (e.g., ?param1=value1&param2=value2)',
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
					description: 'Add parameters one by one using name-value pairs',
				},
				{
					name: 'Using JSON',
					value: 'json',
					description: 'Specify all parameters as a JSON object',
				},
			],
			default: 'keypair',
			description: 'How to specify the query parameters for the request',
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
			default: '{\n  "param1": "value1",\n  "param2": "value2"\n}',
			description: 'Query parameters as JSON object. Example: {"page": 1, "limit": 10}',
		},
		{
			displayName: 'Send Headers',
			name: 'sendHeaders',
			type: 'boolean',
			default: false,
			noDataExpression: true,
			description: 'Whether to include custom headers in the request (e.g., Authorization, Content-Type)',
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
					description: 'Add headers one by one using name-value pairs',
				},
				{
					name: 'Using JSON',
					value: 'json',
					description: 'Specify all headers as a JSON object',
				},
			],
			default: 'keypair',
			description: 'How to specify the headers for the request',
		},
		{
			displayName: 'Headers',
			name: 'headerParameters',
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
			default: '{\n  "Content-Type": "application/json"\n}',
			placeholder: '{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer token",\n  "User-Agent": "n8n"\n}',
			description: 'Headers to send with the request as JSON object. Common headers include Content-Type, Authorization, User-Agent',
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
					name: 'Form-Urlencoded',
					value: 'form-urlencoded',
					description: 'Send data as application/x-www-form-urlencoded (like HTML forms)',
				},
				{
					name: 'Form-Data',
					value: 'multipart-form-data',
					description: 'Send data as multipart/form-data (supports file uploads)',
				},
				{
					name: 'JSON',
					value: 'json',
					description: 'Send data as application/json (most common for APIs)',
				},
				{
					name: 'n8n Binary File',
					value: 'binaryData',
					description: 'Send a binary file from n8n workflow',
				},
				{
					name: 'Raw',
					value: 'raw',
					description: 'Send raw text data with custom content type',
				},
			],
			default: 'json',
			description: 'The format of the request body data',
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
					description: 'Add body parameters one by one using name-value pairs',
				},
				{
					name: 'Using JSON',
					value: 'json',
					description: 'Specify the entire body as a JSON object',
				},
			],
			default: 'keypair',
			description: 'How to specify the request body data',
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
			displayName: 'Body Parameters',
			name: 'bodyParameters',
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
							displayName: 'Parameter Type',
							name: 'parameterType',
							type: 'options',
							options: [
								{
									name: 'n8n Binary File',
									value: 'formBinaryData',
								},
								{
									name: 'Form Data',
									value: 'formData',
								},
							],
							default: 'formData',
						},
						{
							displayName: 'Name',
							name: 'name',
							type: 'string',
							default: '',
							description:
								'ID of the field to set. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
						},
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							displayOptions: {
								show: {
									parameterType: ['formData'],
								},
							},
							default: '',
							description: 'Value of the field to set',
						},
						{
							displayName: 'Input Data Field Name',
							name: 'inputDataFieldName',
							type: 'string',
							displayOptions: {
								show: {
									parameterType: ['formBinaryData'],
								},
							},
							default: '',
							description:
								'The name of the incoming field containing the binary file data to be processed',
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
			default: '{\n  "key": "value"\n}',
			placeholder: '{\n  "name": "John Doe",\n  "email": "john@example.com",\n  "age": 30\n}',
			description: 'Request body data as JSON object. For JSON requests, this becomes the request body. For form-urlencoded, this becomes form data.',
		},
		{
			displayName: 'Input Data Field Name',
			name: 'inputDataFieldName',
			type: 'string',
			displayOptions: {
				show: {
					sendBody: [true],
					contentType: ['binaryData'],
				},
			},
			default: '',
			description: 'The name of the incoming field containing the binary file data to be processed',
		},
		{
			displayName: 'Raw Content Type',
			name: 'rawContentType',
			type: 'string',
			displayOptions: {
				show: {
					sendBody: [true],
					contentType: ['raw'],
				},
			},
			default: 'text/plain',
			placeholder: 'text/plain, application/xml, text/csv',
			description: 'Content-Type header for the raw body data (e.g., text/plain, application/xml, text/csv)',
		},
		{
			displayName: 'Body',
			name: 'body',
			type: 'string',
			displayOptions: {
				show: {
					sendBody: [true],
					contentType: ['raw'],
				},
			},
			default: '',
			placeholder: 'Raw text content to send in the request body',
			description: 'The raw text content to send as the request body',
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
					description: 'Whether to allow access to internal network addresses (localhost, 127.0.0.1, 192.168.x.x, etc.). For security reasons, access to internal networks is disabled by default.',
				},
				{
					displayName: 'Batching',
					name: 'batching',
					placeholder: 'Add Batching',
					type: 'fixedCollection',
					default: {
						batch: {},
					},
					description: 'Control how multiple input items are processed in batches to avoid overwhelming the target server',
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
										minValue: -1,
									},
									default: 1,
									description: 'Number of items to process at once. Use -1 to disable batching and process all items simultaneously.',
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
										'Time (in milliseconds) to wait between each batch of requests. Use 0 for no delay. Useful to avoid rate limiting.',
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
					description: 'Configure HTTP/HTTPS proxy server for the request. Useful for corporate networks or when you need to route traffic through a specific server.',
					options: [
						{
							name: 'settings',
							displayName: 'Settings',
							values: [
								{
									displayName: 'Proxy URL',
									name: 'proxyUrl',
									type: 'string',
									default: '',
									placeholder: 'http://myproxy:3128',
									description: 'Proxy server URL in the format http://hostname:port, e.g. http://myproxy:3128',
								},
								{
									displayName: 'Proxy Authentication',
									name: 'proxyAuth',
									type: 'boolean',
									default: false,
									description: 'Whether the proxy server requires authentication',
								},
								{
									displayName: 'Proxy Username',
									name: 'proxyUsername',
									type: 'string',
									displayOptions: {
										show: {
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
					displayName: 'Ignore SSL Issues (Insecure)',
					name: 'allowUnauthorizedCerts',
					type: 'boolean',
					default: false,
					description: 'Whether to connect even if SSL certificate validation is not possible. ⚠️ Only use this for testing or trusted internal servers.',
				},
				{
					displayName: 'Lowercase Headers',
					name: 'lowercaseHeaders',
					type: 'boolean',
					default: true,
					description: 'Whether to convert all response header names to lowercase. Recommended for consistent header handling.',
				},
				{
					displayName: 'Redirects',
					name: 'redirect',
					placeholder: 'Add Redirect',
					type: 'fixedCollection',
					typeOptions: {
						multipleValues: false,
					},
					default: {
						redirect: {},
					},
					description: 'Control how HTTP redirects (3xx status codes) are handled',
					options: [
						{
							displayName: 'Redirect',
							name: 'redirect',
							values: [
								{
									displayName: 'Follow Redirects',
									name: 'followRedirects',
									type: 'boolean',
									default: true,
									noDataExpression: true,
									description: 'Whether to automatically follow HTTP redirects (301, 302, etc.)',
								},
								{
									displayName: 'Max Redirects',
									name: 'maxRedirects',
									type: 'number',
									displayOptions: {
										show: {
											followRedirects: [true],
										},
									},
									default: 21,
									description: 'Maximum number of redirects to follow before giving up (prevents infinite redirect loops)',
								},
							],
						},
					],
				},
				{
					displayName: 'Full Response',
					name: 'fullResponse',
					type: 'boolean',
					default: false,
					description: 'Whether to return the complete response object (including headers, status code, etc.) instead of just the response body',
				},
				{
					displayName: 'Never Error',
					name: 'neverError',
					type: 'boolean',
					default: false,
					description: 'Whether to treat HTTP error status codes (4xx, 5xx) as successful responses instead of throwing errors',
				},
				{
					displayName: 'Response Format',
					name: 'responseFormat',
					type: 'options',
					options: [
						{
							name: 'Autodetect',
							value: 'autodetect',
							description: 'Automatically detect the response format based on Content-Type header',
						},
						{
							name: 'File',
							value: 'file',
							description: 'Treat response as binary file data',
						},
						{
							name: 'JSON',
							value: 'json',
							description: 'Parse response as JSON object',
						},
						{
							name: 'Text',
							value: 'text',
							description: 'Treat response as plain text',
						},
					],
					default: 'autodetect',
					description: 'How to interpret and process the response data from the server',
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
					description: 'Request timeout in milliseconds (30000 = 30 seconds). Increase this value if the proxy or target website is slow to respond.',
				},
				{
					displayName: 'Connection Pool',
					name: 'connectionPool',
					type: 'fixedCollection',
					placeholder: 'Add Connection Pool Settings',
					default: {
						settings: {},
					},
					description: 'Configure HTTP connection pooling for better performance when making multiple requests',
					options: [
						{
							name: 'settings',
							displayName: 'Settings',
							values: [
								{
									displayName: 'Enable Keep-Alive',
									name: 'keepAlive',
									type: 'boolean',
									default: true,
									description: 'Whether to keep connections alive for reuse. Improves performance for multiple requests to the same host.',
								},
								{
									displayName: 'Max Sockets per Host',
									name: 'maxSockets',
									type: 'number',
									typeOptions: {
										minValue: 1,
										maxValue: 1000,
									},
									default: 50,
									description: 'Maximum number of concurrent connections per host. Higher values allow more parallel requests but use more resources.',
								},
								{
									displayName: 'Max Free Sockets per Host',
									name: 'maxFreeSockets',
									type: 'number',
									typeOptions: {
										minValue: 0,
										maxValue: 100,
									},
									default: 10,
									description: 'Maximum number of idle connections to keep open per host. Higher values reduce connection overhead but use more memory.',
								},
							],
						},
					],
				},

				{
					displayName: 'Pagination',
					name: 'pagination',
					placeholder: 'Add pagination',
					type: 'fixedCollection',
					typeOptions: {
						multipleValues: false,
					},
					default: {
						pagination: {},
					},
					description: 'Automatically handle paginated API responses by making multiple requests until all data is retrieved',
					options: [
						{
							displayName: 'Pagination',
							name: 'pagination',
							values: [
								{
									displayName: 'Pagination Mode',
									name: 'paginationMode',
									type: 'options',
									typeOptions: {
										noDataExpression: true,
									},
									options: [
										{
											name: 'Off',
											value: 'off',
											description: 'No pagination - make only one request',
										},
										{
											name: 'Update a Parameter in Each Request',
											value: 'updateAParameterInEachRequest',
											description: 'Update query/header/body parameters for each page (e.g., page number, offset)',
										},
										{
											name: 'Response Contains Next URL',
											value: 'responseContainsNextURL',
											description: 'Extract the next page URL from the response data',
										},
									],
									default: 'updateAParameterInEachRequest',
									description: 'If pagination should be used',
								},
								{
									displayName:
										'Use the $response variables to access the data of the previous response. Refer to the <a href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/#pagination/?utm_source=n8n_app&utm_medium=node_settings_modal-credential_link&utm_campaign=n8n-nodes-base.httpRequest" target="_blank">docs</a> for more info about pagination/',
									name: 'webhookNotice',
									displayOptions: {
										hide: {
											paginationMode: ['off'],
										},
									},
									type: 'notice',
									default: '',
								},
								{
									displayName: 'Next URL',
									name: 'nextURL',
									type: 'string',
									displayOptions: {
										show: {
											paginationMode: ['responseContainsNextURL'],
										},
									},
									default: '',
									description:
										'Should evaluate to the URL of the next page. <a href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/#pagination" target="_blank">More info</a>.',
								},
								{
									displayName: 'Parameters',
									name: 'parameters',
									type: 'fixedCollection',
									displayOptions: {
										show: {
											paginationMode: ['updateAParameterInEachRequest'],
										},
									},
									typeOptions: {
										multipleValues: true,
										noExpression: true,
									},
									placeholder: 'Add Parameter',
									default: {
										parameters: [
											{
												type: 'qs',
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
													displayName: 'Type',
													name: 'type',
													type: 'options',
													options: [
														{
															name: 'Body',
															value: 'body',
														},
														{
															name: 'Header',
															value: 'headers',
														},
														{
															name: 'Query',
															value: 'qs',
														},
													],
													default: 'qs',
													description: 'Where the parameter should be set',
												},
												{
													displayName: 'Name',
													name: 'name',
													type: 'string',
													default: '',
													placeholder: 'e.g page',
												},
												{
													displayName: 'Value',
													name: 'value',
													type: 'string',
													default: '',
													hint: 'Use expression mode and $response to access response data',
												},
											],
										},
									],
								},
								{
									displayName: 'Pagination Complete When',
									name: 'paginationCompleteWhen',
									type: 'options',
									typeOptions: {
										noDataExpression: true,
									},
									displayOptions: {
										hide: {
											paginationMode: ['off'],
										},
									},
									options: [
										{
											name: 'Response Is Empty',
											value: 'responseIsEmpty',
										},
										{
											name: 'Receive Specific Status Code(s)',
											value: 'receiveSpecificStatusCodes',
										},
										{
											name: 'Other',
											value: 'other',
										},
									],
									default: 'responseIsEmpty',
									description: 'When should no further requests be made?',
								},
								{
									displayName: 'Status Code(s) when Complete',
									name: 'statusCodesWhenComplete',
									type: 'string',
									typeOptions: {
										noDataExpression: true,
									},
									displayOptions: {
										show: {
											paginationCompleteWhen: ['receiveSpecificStatusCodes'],
										},
									},
									default: '',
									description: 'Accepts comma-separated values',
								},
								{
									displayName: 'Complete Expression',
									name: 'completeExpression',
									type: 'string',
									displayOptions: {
										show: {
											paginationCompleteWhen: ['other'],
										},
									},
									default: '',
									description:
										'Should evaluate to true when pagination is complete. <a href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/#pagination" target="_blank">More info</a>.',
								},
								{
									displayName: 'Limit Pages Fetched',
									name: 'limitPagesFetched',
									type: 'boolean',
									typeOptions: {
										noDataExpression: true,
									},
									displayOptions: {
										hide: {
											paginationMode: ['off'],
										},
									},
									default: false,
									noDataExpression: true,
									description: 'Whether the number of requests should be limited',
								},
								{
									displayName: 'Max Pages',
									name: 'maxRequests',
									type: 'number',
									typeOptions: {
										noDataExpression: true,
									},
									displayOptions: {
										show: {
											limitPagesFetched: [true],
										},
									},
									default: 100,
									description: 'Maximum amount of request to be make',
								},
								{
									displayName: 'Interval Between Requests (ms)',
									name: 'requestInterval',
									type: 'number',
									displayOptions: {
										hide: {
											paginationMode: ['off'],
										},
									},
									default: 0,
									description: 'Time in milliseconds to wait between requests',
									hint: 'At 0 no delay will be added',
									typeOptions: {
										minValue: 0,
									},
								},
							],
						},
					],
				},
				{
					displayName: 'Optimize Response',
					name: 'optimizeResponse',
					type: 'boolean',
					default: false,
					noDataExpression: true,
					description:
						'Whether to optimize the response to reduce amount of data passed to the LLM that could lead to better result and reduce cost',
				},
				{
					displayName: 'Expected Response Type',
					name: 'responseType',
					type: 'options',
					displayOptions: {
						show: {
							optimizeResponse: [true],
						},
					},
					options: [
						{
							name: 'JSON',
							value: 'json',
						},
						{
							name: 'HTML',
							value: 'html',
						},
						{
							name: 'Text',
							value: 'text',
						},
					],
					default: 'json',
				},
				{
					displayName: 'Field Containing Data',
					name: 'dataField',
					type: 'string',
					default: '',
					placeholder: 'e.g. records',
					description: 'Specify the name of the field in the response containing the data',
					hint: 'leave blank to use whole response',
					requiresDataPath: 'single',
					displayOptions: {
						show: {
							optimizeResponse: [true],
							responseType: ['json'],
						},
					},
				},
				{
					displayName: 'Include Fields',
					name: 'fieldsToInclude',
					type: 'options',
					description: 'What fields response object should include',
					default: 'all',
					displayOptions: {
						show: {
							optimizeResponse: [true],
							responseType: ['json'],
						},
					},
					options: [
						{
							name: 'All',
							value: 'all',
							description: 'Include all fields',
						},
						{
							name: 'Selected',
							value: 'selected',
							description: 'Include only fields specified below',
						},
						{
							name: 'Except',
							value: 'except',
							description: 'Exclude fields specified below',
						},
					],
				},
				{
					displayName: 'Fields',
					name: 'fields',
					type: 'string',
					default: '',
					placeholder: 'e.g. field1,field2',
					description:
						'Comma-separated list of the field names. Supports dot notation. You can drag the selected fields from the input panel.',
					requiresDataPath: 'multiple',
					displayOptions: {
						show: {
							optimizeResponse: [true],
							responseType: ['json'],
						},
						hide: {
							fieldsToInclude: ['all'],
						},
					},
				},
				{
					displayName: 'Selector (CSS)',
					name: 'cssSelector',
					type: 'string',
					description:
						'Select specific element(e.g. body) or multiple elements(e.g. div) of chosen type in the response HTML.',
					placeholder: 'e.g. body',
					default: 'body',
					displayOptions: {
						show: {
							optimizeResponse: [true],
							responseType: ['html'],
						},
					},
				},
				{
					displayName: 'Return Only Content',
					name: 'onlyContent',
					type: 'boolean',
					default: false,
					description:
						'Whether to return only content of html elements, stripping html tags and attributes',
					hint: 'Uses less tokens and may be easier for model to understand',
					displayOptions: {
						show: {
							optimizeResponse: [true],
							responseType: ['html'],
						},
					},
				},
				{
					displayName: 'Elements To Omit',
					name: 'elementsToOmit',
					type: 'string',
					displayOptions: {
						show: {
							optimizeResponse: [true],
							responseType: ['html'],
							onlyContent: [true],
						},
					},
					default: '',
					placeholder: 'e.g. img, .className, #ItemId',
					description: 'Comma-separated list of selectors that would be excluded when extracting content',
				},
				{
					displayName: 'Truncate Response',
					name: 'truncateResponse',
					type: 'boolean',
					default: false,
					hint: 'Helps save tokens',
					displayOptions: {
						show: {
							optimizeResponse: [true],
							responseType: ['text', 'html'],
						},
					},
				},
				{
					displayName: 'Max Response Characters',
					name: 'maxLength',
					type: 'number',
					default: 1000,
					typeOptions: {
						minValue: 1,
					},
					displayOptions: {
						show: {
							optimizeResponse: [true],
							responseType: ['text', 'html'],
							truncateResponse: [true],
						},
					},
				},
			],
		},
	],
}; 