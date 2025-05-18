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
					name: 'JSON',
					value: 'json',
				},
				{
					name: 'Multipart Form-Data',
					value: 'multipart-form-data',
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
					description: 'Request timeout in milliseconds. Increase this value if the proxy or target website is slow',
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