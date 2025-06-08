import * as cheerio from 'cheerio';
import { convert } from 'html-to-text';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import get from 'lodash/get';
import set from 'lodash/set';
import unset from 'lodash/unset';
import {
	type IDataObject,
	type IExecuteFunctions,
	NodeOperationError,
	jsonParse,
} from 'n8n-workflow';

type ResponseOptimizerFn = (
	x: IDataObject | IDataObject[] | string,
) => IDataObject | IDataObject[] | string;

function htmlOptimizer(
	ctx: IExecuteFunctions,
	itemIndex: number,
	maxLength: number,
): ResponseOptimizerFn {
	const options = ctx.getNodeParameter('options', itemIndex, {}) as any;
	const cssSelector = options.cssSelector || '';
	const onlyContent = options.onlyContent || false;
	let elementsToOmit: string[] = [];

	if (onlyContent) {
		const elementsToOmitUi = options.elementsToOmit || '';

		if (typeof elementsToOmitUi === 'string') {
			elementsToOmit = elementsToOmitUi
				.split(',')
				.filter((s) => s)
				.map((s) => s.trim());
		}
	}

	return (response) => {
		if (typeof response !== 'string') {
			throw new NodeOperationError(
				ctx.getNode(),
				`The response type must be a string. Received: ${typeof response}`,
				{ itemIndex },
			);
		}
		const returnData: string[] = [];

		const html = cheerio.load(response);
		const htmlElements = html(cssSelector);

		htmlElements.each((_, el) => {
			let value = html(el).html() || '';

			if (onlyContent) {
				let htmlToTextOptions;

				if (elementsToOmit?.length) {
					htmlToTextOptions = {
						selectors: elementsToOmit.map((selector) => ({
							selector,
							format: 'skip',
						})),
					};
				}

				value = convert(value, htmlToTextOptions);
			}

			value = value
				.trim()
				.replace(/^\s+|\s+$/g, '')
				.replace(/(\r\n|\n|\r)/gm, '')
				.replace(/\s+/g, ' ');

			returnData.push(value);
		});

		const text = JSON.stringify(returnData, null, 2);

		if (maxLength > 0 && text.length > maxLength) {
			return text.substring(0, maxLength);
		}

		return text;
	};
}

const textOptimizer = (
	ctx: IExecuteFunctions,
	itemIndex: number,
	maxLength: number,
): ResponseOptimizerFn => {
	return (response) => {
		if (typeof response === 'object') {
			try {
				response = JSON.stringify(response, null, 2);
			} catch (_error) {}
		}

		if (typeof response !== 'string') {
			throw new NodeOperationError(
				ctx.getNode(),
				`The response type must be a string. Received: ${typeof response}`,
				{ itemIndex },
			);
		}

		const dom = new JSDOM(response);
		const article = new Readability(dom.window.document, {
			keepClasses: true,
		}).parse();

		const text = article?.textContent || '';

		if (maxLength > 0 && text.length > maxLength) {
			return text.substring(0, maxLength);
		}

		return text;
	};
};

const jsonOptimizer = (ctx: IExecuteFunctions, itemIndex: number): ResponseOptimizerFn => {
	return (response) => {
		let responseData: IDataObject | IDataObject[] | string | null = response;

		if (typeof response === 'string') {
			try {
				responseData = jsonParse(response, { errorMessage: 'Invalid JSON response' });
			} catch (_error) {
				throw new NodeOperationError(
					ctx.getNode(),
					`Received invalid JSON from response. The response appears to be plain text: '${response.length > 100 ? response.substring(0, 100) + '...' : response}'. Please check if the response type should be set to 'Text' or 'HTML' instead of 'JSON'.`,
					{ 
						itemIndex,
						description: 'The response optimization is set to JSON mode, but the actual response is not valid JSON. Consider changing the response type in the optimization settings.'
					},
				);
			}
		}

		if (typeof responseData !== 'object' || !responseData) {
			throw new NodeOperationError(
				ctx.getNode(),
				'The response type must be an object or an array of objects',
				{ itemIndex },
			);
		}

		const options = ctx.getNodeParameter('options', itemIndex, {}) as any;
		const dataField = options.dataField || '';
		let returnData: IDataObject[] = [];

		if (!Array.isArray(responseData)) {
			if (dataField) {
				if (!Object.prototype.hasOwnProperty.call(responseData, dataField)) {
					throw new NodeOperationError(
						ctx.getNode(),
						`Target field "${dataField}" not found in response.`,
						{
							itemIndex,
							description: `The response contained these fields: [${Object.keys(responseData).join(', ')}]`,
						},
					);
				}

				const data = responseData[dataField] as IDataObject | IDataObject[];

				if (Array.isArray(data)) {
					responseData = data;
				} else {
					responseData = [data];
				}
			} else {
				responseData = [responseData];
			}
		} else {
			if (dataField) {
				responseData = responseData.map((data) => data[dataField]) as IDataObject[];
			}
		}

		const fieldsToInclude = options.fieldsToInclude || 'all';

		let fields: string | string[] = [];

		if (fieldsToInclude !== 'all') {
			fields = options.fields || [];

			if (typeof fields === 'string') {
				fields = fields.split(',').map((field) => field.trim());
			}
		} else {
			returnData = responseData;
		}

		if (fieldsToInclude === 'selected') {
			for (const item of responseData) {
				const newItem: IDataObject = {};

				for (const field of fields) {
					set(newItem, field, get(item, field));
				}

				returnData.push(newItem);
			}
		}

		if (fieldsToInclude === 'except') {
			for (const item of responseData) {
				for (const field of fields) {
					unset(item, field);
				}

				returnData.push(item);
			}
		}

		return returnData;
	};
};

// Helper function to auto-detect response type
function autoDetectResponseType(response: any): 'json' | 'html' | 'text' {
	if (typeof response === 'object') {
		return 'json';
	}
	
	if (typeof response === 'string') {
		const trimmed = response.trim();
		
		// Check if it's HTML
		if (trimmed.startsWith('<') && trimmed.includes('>')) {
			return 'html';
		}
		
		// Try to parse as JSON
		try {
			JSON.parse(trimmed);
			return 'json';
		} catch {
			// If not JSON and not HTML, treat as text
			return 'text';
		}
	}
	
	return 'text';
}

export const configureResponseOptimizer = (
	ctx: IExecuteFunctions,
	itemIndex: number,
): ResponseOptimizerFn => {
	// Get options object first
	const options = ctx.getNodeParameter('options', itemIndex, {}) as any;
	const optimizeResponse = options.optimizeResponse || false;

	if (optimizeResponse) {
		const responseType = options.responseType || 'json';

		let maxLength = 0;
		const truncateResponse = options.truncateResponse || false;

		if (truncateResponse) {
			maxLength = options.maxLength || 0;
		}

		// Return a function that can auto-detect and handle different response types
		return (response) => {
			// If user specified a type, try to use it, but fall back to auto-detection on error
			let actualResponseType = responseType;
			
			// For JSON type, try auto-detection if parsing fails
			if (responseType === 'json' && typeof response === 'string') {
				try {
					JSON.parse(response);
				} catch {
					// Auto-detect the actual type
					actualResponseType = autoDetectResponseType(response);
					console.warn(`Response optimization: Expected JSON but received ${actualResponseType}. Auto-switching to ${actualResponseType} mode.`);
				}
			}

			switch (actualResponseType) {
				case 'html':
					return htmlOptimizer(ctx, itemIndex, maxLength)(response);
				case 'text':
					return textOptimizer(ctx, itemIndex, maxLength)(response);
				case 'json':
					return jsonOptimizer(ctx, itemIndex)(response);
				default:
					return response;
			}
		};
	}

	return (x) => x;
}; 