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
			placeholder: 'https://example.com',
			description: 'The URL to make the request to',
			required: true,
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
			description: 'The authentication method to use',
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
			default: '{\n}',
			description: 'Headers as JSON object',
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
				},
				{
					name: 'Form-Data',
					value: 'multipart-form-data',
				},
				{
					name: 'JSON',
					value: 'json',
				},
				{
					name: 'n8n Binary File',
					value: 'binaryData',
				},
				{
					name: 'Raw',
					value: 'raw',
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
			default: '{\n}',
			description: 'Body parameters as JSON object',
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
			default: '',
			placeholder: 'text/plain',
			description: 'Content-Type to use for the raw body',
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
			description: 'The body of the request',
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
					placeholder: 'Add Redirect',
					type: 'fixedCollection',
					typeOptions: {
						multipleValues: false,
					},
					default: {
						redirect: {},
					},
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
									description: 'Whether to follow all redirects',
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
									description: 'Max number of redirects to follow',
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
					description: 'Request timeout in milliseconds. Increase this value if the proxy or target website is slow',
				},
				{
					displayName: 'Batching',
					name: 'batching',
					placeholder: 'Add Batching',
					type: 'fixedCollection',
					typeOptions: {
						multipleValues: false,
					},
					default: {
						batch: {},
					},
					options: [
						{
							displayName: 'Batching',
							name: 'batch',
							values: [
								{
									displayName: 'Items per Batch',
									name: 'batchSize',
									type: 'number',
									typeOptions: {
										minValue: -1,
									},
									default: 50,
									description:
										'Input will be split in batches to throttle requests. -1 for disabled. 0 will be treated as 1.',
								},
								{
									displayName: 'Batch Interval (ms)',
									name: 'batchInterval',
									type: 'number',
									typeOptions: {
										minValue: 0,
									},
									default: 1000,
									description:
										'Time (in milliseconds) between each batch of requests. 0 for disabled.',
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
										},
										{
											name: 'Update a Parameter in Each Request',
											value: 'updateAParameterInEachRequest',
										},
										{
											name: 'Response Contains Next URL',
											value: 'responseContainsNextURL',
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