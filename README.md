# HTTPS Over Proxy Node for n8n

> [繁體中文版說明文件](README.zh-TW.md)

This node allows you to make HTTPS requests through an HTTP proxy in n8n workflows with advanced features comparable to n8n's built-in HTTP Request node.

## Purpose

This project was created to solve a specific limitation in n8n's standard HTTP node: **the inability to connect to HTTPS websites when using an HTTP proxy**. 

While the standard HTTP node in n8n works well for most HTTP requests, it fails when trying to access HTTPS sites through an HTTP proxy. The HTTPS Over Proxy node addresses this gap while maintaining functionality similar to the built-in HTTP node.

## Features

### Core Functionality
- Make HTTPS requests through HTTP proxies
- Support for proxy authentication
- Configurable timeout settings
- Option to ignore SSL certificate validation issues
- Support for various request methods (GET, POST, PUT, DELETE, etc.)
- Support for query parameters, headers, and body data

### Advanced Authentication
- **Custom Authentication**: JSON-based custom auth configuration
- **Predefined Credential Types**: Support for OAuth2, OAuth1, API Key, Basic Auth, and other n8n credential types
- **Bearer Token**: Built-in Bearer token authentication
- Automatic credential application and token management

### Request Processing
- **Batch Processing**: Configurable batch size and intervals for processing multiple requests
- **Pagination Support**: Complete pagination system with multiple modes:
  - Update parameter in each request
  - Response contains next URL
  - Custom completion conditions
- **Response Optimization**: Intelligent response processing with HTML content extraction and JSON filtering
- **File Upload Support**: Complete multipart-form-data and binary file upload capabilities

### Performance & Reliability
- **Connection Pool Management**: HTTP/HTTPS connection pooling for improved performance
- **Smart Error Handling**: Detailed error messages with troubleshooting suggestions
- **Request Timeout Control**: Configurable timeout settings with intelligent error reporting
- **SSL Certificate Handling**: Flexible SSL certificate validation options

### Security Features
- Protection against SSRF attacks
- Restricted internal network access (localhost, 127.0.0.1, etc.) by default
- Secure proxy authentication handling
- Safe error reporting without exposing sensitive information

## Installation

### Local Installation

1. Go to your n8n installation directory
2. Install the node package:
```bash
npm install n8n-nodes-httpsoverproxy
```

### Global Installation

If you installed n8n globally, you can install this node globally too:

```bash
npm install -g n8n-nodes-httpsoverproxy
```

## Usage

After installation, you can find the "HTTPS Over Proxy" node in the n8n nodes panel under the "Network" category.

### Basic Configuration

1. Add the HTTPS Over Proxy node to your workflow
2. Set the request method (GET, POST, etc.)
3. Enter the target URL
4. Configure authentication if needed
5. Configure proxy settings in the Options section:
   - Enable "Use Proxy"
   - Enter Proxy Host (without http:// or https:// prefix)
   - Enter Proxy Port
   - Configure proxy authentication if needed

### Advanced Features

#### Authentication
- Choose from None, Predefined Credential Type, or Custom Auth
- For predefined types, select from available n8n credentials
- For custom auth, configure JSON-based authentication logic

#### Batch Processing
- Configure batch size for processing multiple items
- Set intervals between batches
- Control maximum number of requests

#### Pagination
- Enable pagination for APIs that return paginated results
- Configure pagination parameters and completion conditions
- Set request intervals and maximum page limits

#### Response Optimization
- Enable response optimization for better data processing
- Configure HTML content extraction using CSS selectors
- Set up JSON data filtering and text content optimization

### Advanced Options

- **Allow Internal Network Access**: Enable to allow requests to internal network addresses (disabled by default for security)
- **Connection Pool Settings**: Configure connection pooling for better performance
- **SSL Certificate Validation**: Control SSL certificate verification
- **Request Timeout**: Set custom timeout values

## Comparison with n8n HTTP Request Node

This node provides feature parity with n8n's built-in HTTP Request node while adding:
- ✅ HTTPS over HTTP proxy support
- ✅ Enhanced error handling with detailed troubleshooting
- ✅ Advanced connection pool management
- ✅ Complete pagination system implementation
- ✅ Comprehensive authentication support
- ✅ Intelligent response optimization

## License

[MIT](LICENSE)
